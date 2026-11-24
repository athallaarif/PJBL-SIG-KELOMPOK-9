document.addEventListener('DOMContentLoaded', () => {
    // 1. INISIALISASI PETA LEAFLET (Berpusat di Kota & Kab. Sorong)
    const map = L.map('map', {
        center: [-0.945, 131.325],
        zoom: 11,
        zoomControl: true
    });
    map.createPane('adminFillPane').style.zIndex = 390;
    map.createPane('districtFillPane').style.zIndex = 395;
    map.createPane('districtOutlinePane').style.zIndex = 420;
    map.createPane('parentOutlinePane').style.zIndex = 425;
    map.createPane('dailySmokePane').style.zIndex = 410;
    map.createPane('dailyWindPane').style.zIndex = 415;
    map.createPane('focusHaloPane').style.zIndex = 430;
    map.createPane('focusPane').style.zIndex = 440;
    map.createPane('dailyHotspotPane').style.zIndex = 450;
    map.createPane('firmsHotspotPane').style.zIndex = 450;
    map.createPane('dailyFacilityPane').style.zIndex = 455;
    map.createPane('verifiedFacilityPane').style.zIndex = 460;

    // Basemaps
    const darkBasemap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO | PjBL SIG ITB 2026',
        subdomains: 'abcd',
        maxZoom: 19
    });

    const osmBasemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    const satelliteBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 18
    });

    L.control.layers({
        "Dark Matter (Kontras Asap)": darkBasemap,
        "Citra Satelit (Esri)": satelliteBasemap,
        "OpenStreetMap": osmBasemap
    }, null, { position: 'topleft' }).addTo(map);

    // Skala Garis
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    // Update Koordinat Kursor
    map.on('mousemove', (e) => {
        document.getElementById('cursor-coords').textContent = `${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°`;
    });

    // 2. DATA SPASIAL SIMULASI REALISTIS WILAYAH KOTA & KABUPATEN SORONG
    // Data Distrik (Poligon representatif Kota Sorong & Distrik sekitar di Kab. Sorong)
    const districtsData = window.dataSkenario.districtsData;

    // Data Objek Vital & Infrastruktur (Kota & Kab. Sorong)
    const vitalFacilities = window.dataSkenario.vitalFacilities;

    // Data Titik Api Awal (Sumber Emisi di Zona Hutan/Semak Klamono, Salawati, Mariat)
    const initialHotspots = window.dataSkenario.initialHotspots;

    let hotspots = JSON.parse(JSON.stringify(initialHotspots));

    // State Simulasi
    let simState = {
        windDir: 315,    // Derajat (0 = Utara, 90 = Timur, 180 = Selatan, 270 = Barat, 315 = Barat Laut)
        windSpeed: 6.5,  // m/s
        frpMult: 1.0,    // Multiplier FRP
        plumeOpacity: 0.65
    };

    // Layer Groups Leaflet
    const layerGroups = {
        burned: L.layerGroup().addTo(map),
        aod: L.layerGroup(), // Default off, bisa dinyalakan user
        plume: L.layerGroup().addTo(map),
        wind: L.layerGroup().addTo(map),
        hotspots: L.layerGroup().addTo(map),
        firmsHotspots: L.layerGroup().addTo(map),
        facilities: L.layerGroup().addTo(map),
        adminParents: L.layerGroup(),
        adminDistricts: L.layerGroup(),
        regionFocus: L.layerGroup().addTo(map),
        dailySmoke: L.layerGroup(),
        dailyWind: L.layerGroup(),
        dailyHotspots: L.layerGroup(),
        dailyFacilities: L.layerGroup(),
        osmFacilities: L.layerGroup(),
        dailyOsmFacilities: L.layerGroup()
    };

    const parentStatus = document.getElementById('admin-parent-status');
    const districtStatus = document.getElementById('district-status');
    const parentLayerCheckbox = document.getElementById('layer-admin-parents');
    const districtLayerCheckbox = document.getElementById('layer-admin-districts');
    const regionFilter = document.getElementById('region-filter');
    const appModeSelect = document.getElementById('app-mode-select');
    const hotspotTimeFilter = document.getElementById('hotspot-time-filter');
    const firmsHotspotsToggle = document.getElementById('layer-firms-hotspots');
    const osmFacilitiesToggle = document.getElementById('layer-osm-facilities');
    const dailyDateSlider = document.getElementById('daily-date-slider');
    const dailyDatePicker = document.getElementById('daily-date-picker');
    const dailyPlayButton = document.getElementById('daily-play-btn');
    const dailySmokeMethod = document.getElementById('daily-smoke-method');
    const dailySmokeToggle = document.getElementById('daily-smoke-toggle');
    const dailyHotspotsToggle = document.getElementById('daily-hotspots-toggle');
    const dailyOpacitySlider = document.getElementById('daily-opacity-slider');
    let aoiBounds = null;
    const parentFeaturesByCode = new Map();
    const parentBoundsByCode = new Map();
    const districtFeaturesByCode = new Map();
    const districtBoundsByCode = new Map();
    const districtLabelsByCode = new Map();
    const districtMinZoom = 11;
    const dailyDates = [];
    for (let day = 0; day < 25; day++) {
        dailyDates.push(new Date(Date.UTC(2026, 8, 21 + day)).toISOString().slice(0, 10));
    }
    const dailyRecords = [];
    const dailyRecordKeys = new Set();
    let osmFacilityFeatures = [];
    const firmsCanvasRenderer = L.canvas({ padding: 0.5 });
    const importedFileHashes = new Set();
    const smokeBounds = L.latLngBounds([[-1.9, 130.35], [-0.55, 132.5]]);
    let manualSmokeOverlay = null;
    let dailySmokeOverlay = null;
    let manualPlumeProgress = 1;
    let manualAnimationTimer = null;
    let manualAnimationStart = 0;
    const manualScenarioDuration = 2600;
    const smokeSourceScale = 52;
    const windArrowLocations = [
        [-0.87, 131.25], [-0.93, 131.32], [-1.01, 131.38],
        [-1.07, 131.44], [-0.96, 131.26], [-1.04, 131.31]
    ];
    let dailyCurrentIndex = 0;
    let dailyTimer = null;
    let dailyPlaybackStartedAt = 0;
    let dailyPlaybackElapsed = 0;
    let dailyDateReady = true;
    let dailyPlumeProgress = 0;
    const dailyFrameHoldDuration = 800;
    let dailySmokeSources = [];
    let dailySmokeState = null;
    let dailySmokeVisible = false;
    let dailyWindManifestPromise = null;
    let dailyWindManifestError = null;
    let dailyChart = null;
    let dailySourceLabel = 'Data hotspot belum tersedia';
    let hysplitManifestPromise = null;
    let dailyModelRequestId = 0;
    let isDailyMode = false;
    let manualSettingsSnapshot = null;

    function setAdminStatus(element, message, isError) {
        element.textContent = message;
        element.classList.remove('hidden', 'text-amber-200', 'text-red-300', 'text-slate-500');
        element.classList.add(isError ? 'text-red-300' : 'text-amber-200');
    }

    function addAdminLabel(group, point, text, className) {
        const content = document.createElement('span');
        content.textContent = text;
        const label = L.tooltip({
            permanent: true,
            direction: 'center',
            className,
            opacity: 1
        }).setLatLng(point).setContent(content);
        group.addLayer(label);
        return label;
    }

    function validateAoiData(data) {
        const expected = {
            '96.71': { type: 5, displayName: 'Kota Sorong', sourceName: 'Kota Sorong' },
            '96.01': { type: 4, displayName: 'Kabupaten Sorong', sourceName: 'Sorong' }
        };
        if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length !== 2) {
            throw new Error('GeoJSON AOI harus berisi tepat dua fitur wilayah.');
        }

        const foundCodes = new Set();
        data.features.forEach(feature => {
            const properties = feature.properties || {};
            const code = String(properties.KDPKAB || '').trim();
            const expectedRegion = expected[code];
            const geometry = feature.geometry;
            if (!expectedRegion ||
                properties.TIPADM !== expectedRegion.type ||
                properties.NAMOBJ !== expectedRegion.sourceName ||
                properties.display_name !== expectedRegion.displayName ||
                properties.WADMPR !== 'Papua Barat Daya' ||
                !geometry ||
                (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') ||
                !Array.isArray(geometry.coordinates) ||
                geometry.coordinates.length === 0 ||
                !Array.isArray(properties.label_point) ||
                properties.label_point.length !== 2) {
                throw new Error('GeoJSON AOI berisi wilayah atau geometri yang tidak sesuai.');
            }
            if (foundCodes.has(code)) {
                throw new Error(`Kode wilayah AOI duplikat: ${code}.`);
            }
            foundCodes.add(code);
        });
        if (foundCodes.size !== 2) {
            throw new Error('GeoJSON AOI tidak memuat Kota Sorong dan Kabupaten Sorong.');
        }
    }

    function validateDistrictData(data) {
        if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length === 0) {
            throw new Error('GeoJSON distrik BIG tidak berisi fitur.');
        }
        const foundCodes = new Set();
        data.features.forEach(feature => {
            const properties = feature.properties || {};
            const code = String(properties.KDPKAB || '').trim();
            const districtCode = String(properties.KDCPUM || '').trim();
            const geometry = feature.geometry;
            if (properties.TIPADM !== 3 ||
                properties.WADMPR !== 'Papua Barat Daya' ||
                (code !== '96.01' && code !== '96.71') ||
                !districtCode ||
                districtCode.indexOf(`${code}.`) !== 0 ||
                !properties.WADMKC ||
                !geometry ||
                (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') ||
                !Array.isArray(geometry.coordinates) ||
                geometry.coordinates.length === 0 ||
                !Array.isArray(properties.label_point) ||
                properties.label_point.length !== 2) {
                throw new Error('GeoJSON distrik memuat atribut atau geometri yang tidak sesuai.');
            }
            if (foundCodes.has(districtCode)) {
                throw new Error(`Kode distrik BIG duplikat: ${districtCode}.`);
            }
            foundCodes.add(districtCode);
        });
    }

    function getPolygonRings(geometry) {
        if (geometry.type === 'Polygon') return [geometry.coordinates];
        return geometry.coordinates;
    }

    function addBoundaryLines(group, feature, style, popupContent) {
        getPolygonRings(feature.geometry).forEach(rings => {
            rings.forEach(ring => {
                const line = L.polyline(ring.map(coordinate => [coordinate[1], coordinate[0]]), style);
                if (popupContent) line.bindPopup(popupContent);
                group.addLayer(line);
            });
        });
    }

    function createBoundaryPopup(name, parentName, code, label) {
        const content = document.createElement('div');
        content.className = 'text-xs';
        const title = document.createElement('div');
        title.className = 'font-bold text-amber-300';
        title.textContent = name;
        const description = document.createElement('div');
        description.className = 'mt-1 text-slate-300';
        description.textContent = label;
        const parent = document.createElement('div');
        parent.className = 'mt-1 text-slate-400';
        parent.textContent = `${parentName} · Kode PUM ${code}`;
        content.append(title, description, parent);
        return content;
    }

    function parentStyle(code) {
        const isCity = code === '96.71';
        return {
            color: isCity ? '#75638f' : '#87966e',
            weight: 0,
            fillColor: isCity ? '#c4b5fd' : '#a3b18a',
            fillOpacity: 0.18
        };
    }

    function districtStyle(code, index) {
        const cityColors = ['#d9cff1', '#c4b5dc', '#e3dcf1', '#b8a7d7'];
        const countyColors = ['#d5dfc2', '#c1d0a6', '#e1e8d4', '#b0c28f', '#cbd8b8'];
        const colors = code === '96.71' ? cityColors : countyColors;
        return {
            color: code === '96.71' ? '#75638f' : '#74835b',
            weight: 0,
            fillColor: colors[index % colors.length],
            fillOpacity: 0.12
        };
    }

    function updateDistrictLayerVisibility() {
        const selectedDistrictCode = regionFilter.value.indexOf('district:') === 0
            ? regionFilter.value.slice('district:'.length)
            : null;
        const shouldShow = districtLayerCheckbox.checked &&
            districtFeaturesByCode.size > 0 &&
            (map.getZoom() >= districtMinZoom || districtFeaturesByCode.has(selectedDistrictCode));
        if (shouldShow && !map.hasLayer(layerGroups.adminDistricts)) {
            layerGroups.adminDistricts.addTo(map);
        } else if (!shouldShow && map.hasLayer(layerGroups.adminDistricts)) {
            map.removeLayer(layerGroups.adminDistricts);
        }
    }

    function loadParentBoundaries() {
    return fetch('data/aoi-sorong.geojson')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            validateAoiData(data);
            data.features.forEach(feature => {
                const properties = feature.properties;
                const code = String(properties.KDPKAB);
                const name = properties.display_name;
                const boundsLayer = L.geoJSON(feature);
                parentFeaturesByCode.set(code, feature);
                parentBoundsByCode.set(code, boundsLayer.getBounds());
                const fill = L.geoJSON(feature, {
                    pane: 'adminFillPane',
                    interactive: false,
                    style: parentStyle(code)
                });
                layerGroups.adminParents.addLayer(fill);
                addBoundaryLines(layerGroups.adminParents, feature, {
                    pane: 'parentOutlinePane',
                    color: code === '96.71' ? '#75638f' : '#74835b',
                    weight: 3.2,
                    opacity: 1
                }, createBoundaryPopup(name, 'Wilayah kajian dampak', code, 'Batas administrasi BIG'));
                addAdminLabel(layerGroups.adminParents, properties.label_point, name.toUpperCase(), 'admin-parent-label');
            });
            aoiBounds = L.geoJSON(data).getBounds();
            if (parentLayerCheckbox.checked) layerGroups.adminParents.addTo(map);
            setAdminStatus(parentStatus, 'Batas BIG aktif · edisi Juni 2026', false);
            map.fitBounds(aoiBounds, { padding: [36, 36], maxZoom: 11 });
        })
        .catch(error => {
            console.error('Gagal memuat batas kota/kabupaten BIG:', error);
            setAdminStatus(parentStatus, 'Batas administrasi belum tersedia.', true);
            parentLayerCheckbox.disabled = true;
            document.getElementById('focus-aoi-btn').disabled = true;
        });
    }

    function loadDistrictBoundaries() {
        return fetch('data/distrik-sorong.geojson')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                validateDistrictData(data);
                const counts = { '96.01': 0, '96.71': 0 };
                data.features.sort((first, second) =>
                    String(first.properties.KDPKAB).localeCompare(String(second.properties.KDPKAB)) ||
                    first.properties.WADMKC.localeCompare(second.properties.WADMKC)
                ).forEach((feature, index) => {
                    const properties = feature.properties;
                    const code = String(properties.KDCPUM);
                    const parentCode = String(properties.KDPKAB);
                    const parentName = parentCode === '96.71' ? 'Kota Sorong' : 'Kabupaten Sorong';
                    const name = `Distrik ${properties.WADMKC}`;
                    const fullLabel = `${name} · ${parentName}`;
                    const boundsLayer = L.geoJSON(feature);
                    counts[parentCode] += 1;
                    districtFeaturesByCode.set(code, feature);
                    districtBoundsByCode.set(code, boundsLayer.getBounds());
                    const fill = L.geoJSON(feature, {
                        pane: 'districtFillPane',
                        interactive: false,
                        style: districtStyle(parentCode, index)
                    });
                    layerGroups.adminDistricts.addLayer(fill);
                    addBoundaryLines(layerGroups.adminDistricts, feature, {
                        pane: 'districtOutlinePane',
                        color: parentCode === '96.71' ? '#88769f' : '#829269',
                        weight: 0.9,
                        opacity: 0.9
                    }, createBoundaryPopup(name, parentName, code, 'Batas distrik BIG'));
                    const districtLabel = addAdminLabel(layerGroups.adminDistricts, properties.label_point, properties.WADMKC, 'admin-district-label');
                    districtLabelsByCode.set(code, districtLabel);

                    const option = document.createElement('option');
                    option.value = `district:${code}`;
                    option.textContent = fullLabel;
                    regionFilter.querySelector('#district-filter-options').appendChild(option);
                });
                updateDistrictLayerVisibility();
                setAdminStatus(districtStatus, `${districtFeaturesByCode.size} distrik BIG tersedia (${counts['96.01']} Kabupaten Sorong, ${counts['96.71']} Kota Sorong); batas tampil mulai zoom ${districtMinZoom}.`, false);
            })
            .catch(error => {
                console.error('Gagal memuat batas distrik BIG:', error);
                setAdminStatus(districtStatus, 'Batas administrasi distrik belum tersedia.', true);
                districtLayerCheckbox.disabled = true;
                const option = document.createElement('option');
                option.disabled = true;
                option.textContent = 'Batas distrik belum tersedia';
                regionFilter.querySelector('#district-filter-options').appendChild(option);
            });
    }

    Promise.all([loadParentBoundaries(), loadDistrictBoundaries()]).then(() => {
        loadDailyHotspots();
        loadOsmFacilities();
    });
    map.on('zoomend', updateDistrictLayerVisibility);

    // 3. FUNGSI PEMODELAN DISPERSI ASAP (GAUSSIAN PLUME SEDERHANA)
    // Menghitung poligon elips memanjang searah vektor angin dari titik sumber api
    function generatePlumePolygon(lat, lng, distanceKm, spreadKm, bearingDeg) {
        const points = [];
        const radBearing = (bearingDeg * Math.PI) / 180;
        const steps = 36;

        // Konversi km ke derajat sekitar lintang Sorong (-1 deg)
        const kmPerDegLat = 110.574;
        const kmPerDegLng = 111.320 * Math.cos((lat * Math.PI) / 180);

        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * 2 * Math.PI;
            // Bentuk teardrop / plume memanjang ke arah downwind
            const along = (Math.cos(angle) + 1) * 0.5 * distanceKm; 
            // Lebar plume membesar seiring jarak downwind
            const widthFactor = Math.pow(along / distanceKm, 0.65);
            const cross = Math.sin(angle) * spreadKm * (0.25 + 0.75 * widthFactor);

            // Rotasi koordinat lokal ke arah angin (bearingDeg: 0 = Utara/+Lat, 90 = Timur/+Lng)
            const dNorth = along * Math.cos(radBearing) - cross * Math.sin(radBearing);
            const dEast = along * Math.sin(radBearing) + cross * Math.cos(radBearing);

            const pLat = lat + (dNorth / kmPerDegLat);
            const pLng = lng + (dEast / kmPerDegLng);
            points.push([pLat, pLng]);
        }
        return points;
    }

    // Helper Jarak Haversine (km)
    function getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function plumeContributionAtPoint(lat, lng, sources) {
        let total = 0;
        const radWind = (simState.windDir * Math.PI) / 180;

        sources.forEach(hs => {
            const frpValue = optionalNumber(hs.frp);
            const frp = frpValue == null ? 1 : frpValue;
            const dist = getDistanceKm(hs.lat, hs.lng, lat, lng);
            if (dist < 0.5) {
                total += frp * simState.frpMult * 4.5;
                return;
            }

            // Hitung sudut dari hotspot ke target
            const dLat = (lat - hs.lat) * 110.574;
            const dLng = (lng - hs.lng) * 111.320 * Math.cos((hs.lat * Math.PI) / 180);

            // Proyeksi searah angin (downwind) dan tegak lurus angin (crosswind)
            const downwind = dLat * Math.cos(radWind) + dLng * Math.sin(radWind);
            const crosswind = Math.abs(-dLat * Math.sin(radWind) + dLng * Math.cos(radWind));

            const maxReach = 8 + simState.windSpeed * 2.4; // Jangkauan max km
            if (downwind > -1 && downwind <= maxReach) {
                const effectiveDownwind = Math.max(0.5, downwind);
                const sigmaY = 1.2 + effectiveDownwind * (0.28 - simState.windSpeed * 0.008);

                // Persamaan Gaussian Plume 2D terkalibrasi
                const emission = (frp * simState.frpMult) * 16;
                const decay = Math.exp(-0.07 * effectiveDownwind);
                const crossFactor = Math.exp(-(crosswind * crosswind) / (2 * sigmaY * sigmaY));

                const contribution = (emission / (simState.windSpeed * 0.6 + 1.5)) * decay * crossFactor;
                total += contribution;
            }
        });

        return total;
    }

    function renderSmokeOverlay(group, sources, progress, sourceScale, pane, overlay, renderState = simState) {
        if (!sources.length) {
            if (overlay && group.hasLayer(overlay)) group.removeLayer(overlay);
            return null;
        }

        const width = 360;
        const height = 300;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        const image = context.createImageData(width, height);
        const north = smokeBounds.getNorth();
        const south = smokeBounds.getSouth();
        const east = smokeBounds.getEast();
        const west = smokeBounds.getWest();
        const windRadians = renderState.windDir * Math.PI / 180;
        const windNorth = Math.cos(windRadians);
        const windEast = Math.sin(windRadians);
        const boundsHeight = north - south;
        const boundsWidth = east - west;
        const sourcePlans = sources.map(source => {
            const frpValue = optionalNumber(source.frp);
            const speed = Math.max(0.5, renderState.windSpeed);
            return {
                lat: source.lat,
                lng: source.lng,
                lngScale: 111.32 * Math.cos(source.lat * Math.PI / 180),
                strength: ((frpValue == null ? 1 : frpValue) * renderState.frpMult) / sourceScale,
                maxReach: 9 + speed * 2.8,
                speed
            };
        });
        const palette = [
            { stop: 0.035, color: [255, 242, 168] },
            { stop: 0.24, color: [247, 151, 66] },
            { stop: 0.62, color: [225, 69, 45] },
            { stop: 1, color: [127, 29, 29] }
        ];
        const fixedIntensityScale = 1.35;
        const frontProgress = Math.max(0, Math.min(1, progress));

        for (let y = 0; y < height; y++) {
            const lat = north - (y + 0.5) / height * boundsHeight;
            for (let x = 0; x < width; x++) {
                const lng = west + (x + 0.5) / width * boundsWidth;
                let total = 0;
                sourcePlans.forEach(source => {
                    const dNorth = (lat - source.lat) * 110.574;
                    const dEast = (lng - source.lng) * source.lngScale;
                    const distanceSquared = dNorth * dNorth + dEast * dEast;
                    const downwind = dNorth * windNorth + dEast * windEast;
                    const crosswind = Math.abs(-dNorth * windEast + dEast * windNorth);

                    if (distanceSquared < 0.7 * 0.7) {
                        total += source.strength * 0.7 * Math.exp(-distanceSquared / 2.4);
                    }
                    if (downwind <= 0.3) return;

                    const frontDistance = source.maxReach * frontProgress;
                    const fadeDistance = Math.max(1.6, source.maxReach * 0.07);
                    if (downwind > frontDistance + fadeDistance) return;

                    const sigma = 2.6 + downwind * 0.18 + source.speed * 0.1;
                    const crosswindFactor = Math.exp(-(crosswind * crosswind) / (2 * sigma * sigma));
                    const frontPosition = Math.max(0, Math.min(1,
                        (downwind - (frontDistance - fadeDistance)) / (2 * fadeDistance)));
                    const smoothFront = frontPosition * frontPosition * (3 - 2 * frontPosition);
                    const decay = Math.exp(-downwind / (source.maxReach * 0.82));
                    total += source.strength * decay * crosswindFactor * (1 - smoothFront);
                });

                const intensity = Math.min(1, total / fixedIntensityScale);
                if (intensity < 0.008) continue;

                let lower = palette[0];
                let upper = palette[palette.length - 1];
                for (let p = 1; p < palette.length; p++) {
                    if (intensity <= palette[p].stop) {
                        lower = palette[p - 1];
                        upper = palette[p];
                        break;
                    }
                }
                const amount = Math.max(0, Math.min(1,
                    (intensity - lower.stop) / (upper.stop - lower.stop)));
                const offset = (y * width + x) * 4;
                for (let channel = 0; channel < 3; channel++) {
                    image.data[offset + channel] = Math.round(
                        lower.color[channel] + (upper.color[channel] - lower.color[channel]) * amount
                    );
                }
                const opacity = renderState.plumeOpacity * (0.22 + 0.66 * Math.pow(intensity, 0.48));
                image.data[offset + 3] = Math.round(Math.min(0.88, opacity) * 255);
            }
        }

        context.putImageData(image, 0, 0);
        const imageUrl = canvas.toDataURL('image/png');
        if (overlay && group.hasLayer(overlay)) {
            overlay.setUrl(imageUrl);
            return overlay;
        }
        return L.imageOverlay(imageUrl, smokeBounds, {
            opacity: 1,
            pane,
            interactive: false,
            className: 'smoke-overlay-image'
        }).addTo(group);
    }

    function renderAnimatedSmokeFrame(group, sources, progress, pane, overlay, renderState = simState) {
        return renderSmokeOverlay(group, sources, progress, smokeSourceScale, pane, overlay, renderState);
    }

    function renderDailySmokeFrame(progress) {
        dailyPlumeProgress = Math.max(0, Math.min(1, progress));
        if (!isDailyMode || dailySmokeMethod.value !== 'simulation' || !dailySmokeVisible ||
            !dailySmokeSources.length || !dailySmokeState || !map.hasLayer(layerGroups.dailySmoke)) {
            return;
        }
        dailySmokeOverlay = renderAnimatedSmokeFrame(
            layerGroups.dailySmoke,
            dailySmokeSources,
            dailyPlumeProgress,
            'dailySmokePane',
            dailySmokeOverlay,
            dailySmokeState
        );
    }

    function markDailyDateReady(requestId) {
        if (requestId !== dailyModelRequestId || !isDailyMode) return;
        dailyDateReady = true;
        if (dailyTimer !== null) {
            dailyPlaybackElapsed = 0;
            dailyPlaybackStartedAt = performance.now();
            renderDailySmokeFrame(0);
        }
    }

    // Estimasi Konsentrasi PM2.5 ilustratif untuk skenario manual.
    function estimatePM25AtPoint(lat, lng) {
        return Math.min(480, Math.round(12 + plumeContributionAtPoint(lat, lng, hotspots)));
    }

    function getAirQualityCategory(pm) {
        if (pm > 250) return { label: 'BERBAHAYA', color: '#ef4444', badge: 'bg-red-950 text-red-300 border-red-700' };
        if (pm > 150) return { label: 'SANGAT TIDAK SEHAT', color: '#f87171', badge: 'bg-red-900/60 text-red-200 border-red-500' };
        if (pm > 55)  return { label: 'TIDAK SEHAT', color: '#fb923c', badge: 'bg-orange-900/60 text-orange-200 border-orange-500' };
        if (pm > 15)  return { label: 'SEDANG', color: '#facc15', badge: 'bg-yellow-900/50 text-yellow-200 border-yellow-500' };
        return { label: 'BAIK', color: '#4ade80', badge: 'bg-emerald-900/50 text-emerald-200 border-emerald-500' };
    }

    // 4. RENDER SEMUA LAYER PETA
    let currentPlumeGeoJSON = { type: "FeatureCollection", features: [] };

    function renderAllLayers() {
        // Bersihkan layer dinamis
        layerGroups.burned.clearLayers();
        layerGroups.aod.clearLayers();
        layerGroups.plume.clearLayers();
        layerGroups.wind.clearLayers();
        layerGroups.hotspots.clearLayers();
        layerGroups.facilities.clearLayers();
        manualSmokeOverlay = null;

        currentPlumeGeoJSON.features = [];

        // A. Hitung estimasi paparan distrik tanpa menggambar poligon skenario.
        let totalExposedPop = 0;
        const districtPMList = [];

        districtsData.forEach(dist => {
            // Sampling beberapa titik dalam distrik untuk rata-rata & max PM2.5
            const pmCenter = estimatePM25AtPoint(dist.center[0], dist.center[1]);
            const pmCorner = estimatePM25AtPoint(dist.coords[0][0], dist.coords[0][1]);
            const peakPM = Math.max(pmCenter, pmCorner);
            const avgPM = Math.round((pmCenter + pmCorner) / 2);

            districtPMList.push({ name: dist.name, pm: peakPM });

            // Hitung estimasi populasi terpapar zona Tidak Sehat (> 55 ug/m3)
            let exposedRatio = 0;
            if (peakPM > 150) exposedRatio = 0.65;
            else if (peakPM > 55) exposedRatio = 0.30;
            else if (avgPM > 45) exposedRatio = 0.12;

            const exposedCount = Math.round(dist.pop * exposedRatio);
            totalExposedPop += exposedCount;

        });

        // B. Siapkan geometri ilustratif untuk unduhan; peta memakai satu hamparan raster.
        const baseLength = 7 + simState.windSpeed * 2.2;
        const baseSpread = Math.max(1.8, 5.2 - simState.windSpeed * 0.2);

        const plumeTiers = [
            { scaleL: 1.00, scaleW: 1.00, color: '#eab308', label: 'Sedang (15-55 µg/m³)', pmVal: 42, opMult: 0.55 },
            { scaleL: 0.72, scaleW: 0.72, color: '#f97316', label: 'Tidak Sehat (55-150 µg/m³)', pmVal: 115, opMult: 0.75 },
            { scaleL: 0.44, scaleW: 0.45, color: '#dc2626', label: 'Sangat Tidak Sehat (150-250 µg/m³)', pmVal: 195, opMult: 0.90 },
            { scaleL: 0.22, scaleW: 0.24, color: '#7f1d1d', label: 'Berbahaya (>250 µg/m³)', pmVal: 310, opMult: 1.0 }
        ];

        hotspots.forEach(hs => {
            const frpFactor = (hs.frp / 55) * simState.frpMult;
            const len = baseLength * Math.min(1.6, Math.max(0.6, frpFactor));
            const spr = baseSpread * Math.min(1.4, Math.max(0.7, frpFactor));

            // Area Terbakar (Burned Area polygon kecil di sekitar hotspot)
            const burnedRadius = 0.006 * Math.sqrt(frpFactor);
            L.circle([hs.lat, hs.lng], {
                radius: burnedRadius * 111000,
                color: '#b45309',
                weight: 1,
                fillColor: '#451a03',
                fillOpacity: 0.65
            }).addTo(layerGroups.burned).bindPopup(`
                <div class="text-xs">
                    <b class="text-amber-400">Bekas Area Terbakar (MCD64A1)</b><br>
                    Sumber: ${hs.id} • Tutupan: ${hs.land}
                </div>
            `);

            // Layer Validasi AOD Satelit (Grid kasar Himawari-9)
            L.rectangle([
                [hs.lat - 0.03, hs.lng - 0.04],
                [hs.lat + 0.09, hs.lng - 0.11]
            ], {
                color: '#a855f7',
                weight: 1,
                dashArray: '3,3',
                fillColor: '#9333ea',
                fillOpacity: 0.22
            }).addTo(layerGroups.aod).bindPopup(`
                <div class="text-xs">
                    <b class="text-purple-400">Validasi Aerosol Optical Depth (AOD)</b><br>
                    Sensor: Himawari-9 / TROPOMI<br>
                    Indeks AOD: <b>0.84 (Tinggi)</b> • Korelasi Model: <b>r = 0.81</b>
                </div>
            `);

            // Render Plume Tiers
            plumeTiers.forEach(tier => {
                const polyCoords = generatePlumePolygon(
                    hs.lat, hs.lng,
                    len * tier.scaleL,
                    spr * tier.scaleW,
                    simState.windDir
                );

                const adjustedPM = Math.round(tier.pmVal * simState.frpMult);

                // Simpan ke GeoJSON untuk fitur Unduh
                currentPlumeGeoJSON.features.push({
                    type: "Feature",
                    properties: {
                        source_id: hs.id,
                        zone: tier.label,
                        status: "skenario_ilustratif",
                        visualisasi: "poligon ilustratif untuk unduhan; bukan keluaran raster model",
                        nilai_pm25_skenario: adjustedPM,
                        wind_direction_deg: simState.windDir,
                        wind_direction_reference: "bearing tujuan asap; 0=utara, 90=timur",
                        wind_speed_ms: simState.windSpeed,
                        frp_mw: hs.frp
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [polyCoords.map(c => [c[1], c[0]])]
                    }
                });
            });

            // C. Render Titik Api (Hotspot Marker)
            const fireIcon = L.divIcon({
                className: 'custom-fire-icon',
                html: `<div class="w-4 h-4 fire-marker-icon flex items-center justify-center"><i class="fas fa-fire text-[8px] text-white"></i></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            L.marker([hs.lat, hs.lng], { icon: fireIcon })
                .addTo(layerGroups.hotspots)
                .bindPopup(`
                    <div class="text-xs space-y-1 min-w-[190px]">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-red-400"><i class="fas fa-fire"></i> Titik Api ${hs.id}</span>
                            <span class="px-1.5 py-0.5 bg-red-950 text-red-300 rounded text-[10px]">${hs.conf}</span>
                        </div>
                        <div>Koordinat: <b>${hs.lat.toFixed(4)}, ${hs.lng.toFixed(4)}</b></div>
                        <div>FRP: <b>${(hs.frp * simState.frpMult).toFixed(1)} MW</b></div>
                        <div>Tutupan: ${hs.land}</div>
                    </div>
                `);
        });

        manualSmokeOverlay = renderAnimatedSmokeFrame(
            layerGroups.plume, hotspots, manualPlumeProgress, 'overlayPane', manualSmokeOverlay
        );

        // D. Render Vektor Arah Angin di beberapa titik grid Sorong
        windArrowLocations.forEach(pt => {
            const arrowIcon = L.divIcon({
                className: 'wind-arrow-icon',
                html: `<div style="transform: rotate(${simState.windDir}deg);" class="text-cyan-400/90 text-sm drop-shadow"><i class="fas fa-arrow-up"></i></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            L.marker(pt, { icon: arrowIcon, interactive: false }).addTo(layerGroups.wind);
        });

        // E. Render Objek Vital & Hitung Dampak Fasilitas
        let affectedHealth = 0;
        let totalHealth = 0;
        let affectedSchools = 0;
        let airportPM = 15;
        const vitalListEl = document.getElementById('vital-list');
        vitalListEl.innerHTML = '';

        vitalFacilities.forEach(fac => {
            const pm = estimatePM25AtPoint(fac.lat, fac.lng);
            const cat = getAirQualityCategory(pm);
            const isAffected = pm > 55;

            if (fac.type === 'health') {
                totalHealth++;
                if (isAffected) affectedHealth++;
            }
            if (fac.type === 'school' && isAffected) {
                affectedSchools += (fac.count || 1);
            }
            if (fac.type === 'airport') {
                airportPM = pm;
            }

            const badgeColor = isAffected ? 'bg-red-600 border-yellow-300' : 'bg-slate-800 border-teal-400';
            const facIcon = L.divIcon({
                className: 'fac-marker',
                html: `<div class="w-6 h-6 rounded-full ${badgeColor} border-2 text-white flex items-center justify-center shadow-md text-[10px]">
                        <i class="fas ${fac.icon}"></i>
                       </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            L.marker([fac.lat, fac.lng], { icon: facIcon })
                .addTo(layerGroups.facilities)
                .bindPopup(`
                    <div class="text-xs space-y-1 min-w-[200px]">
                        <div class="text-[10px] text-slate-400">${fac.district}</div>
                        <div class="font-bold text-white">${fac.name}</div>
                        <div class="flex justify-between pt-1 border-t border-slate-700">
                            <span>Konsentrasi PM2.5:</span>
                            <b style="color:${cat.color}">${pm} µg/m³</b>
                        </div>
                        <div class="text-center py-1 rounded border text-[10px] font-bold ${cat.badge}">${cat.label}</div>
                    </div>
                `);

            // Tambah ke daftar sidebar kanan
            vitalListEl.innerHTML += `
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <i class="fas ${fac.icon} text-slate-400 text-[11px] shrink-0"></i>
                        <div class="truncate">
                            <div class="text-slate-200 font-medium truncate">${fac.name}</div>
                            <div class="text-[10px] text-slate-500">${fac.district}</div>
                        </div>
                    </div>
                    <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ml-2 ${cat.badge}">
                        ${pm} µg
                    </span>
                </div>
            `;
        });

        // 5. UPDATE KPI CARDS & CHART
        document.getElementById('kpi-pop').textContent = totalExposedPop.toLocaleString('id-ID');
        document.getElementById('kpi-health').innerHTML = `${affectedHealth} <span class="text-xs font-normal text-slate-400">/ ${totalHealth} Unit</span>`;
        document.getElementById('kpi-school').innerHTML = `${affectedSchools} <span class="text-xs font-normal text-slate-400">Sekolah</span>`;

        // Status Visibilitas Bandara DEO berdasarkan rumus empiris PM2.5 -> Visibility (km)
        const estVisKm = Math.max(0.6, (260 / Math.max(25, airportPM))).toFixed(1);
        const airportEl = document.getElementById('kpi-airport');
        if (airportPM > 150) {
            airportEl.textContent = `TERGANGGU (${estVisKm} km)`;
            airportEl.className = 'text-sm font-bold text-red-400 mt-0.5';
        } else if (airportPM > 55) {
            airportEl.textContent = `WASPADA (${estVisKm} km)`;
            airportEl.className = 'text-sm font-bold text-amber-400 mt-0.5';
        } else {
            airportEl.textContent = `NORMAL (> 8 km)`;
            airportEl.className = 'text-sm font-bold text-emerald-400 mt-0.5';
        }
        document.getElementById('kpi-airport-pm').textContent = `PM2.5: ${airportPM} µg/m³`;

        updateDistrictChart(districtPMList);
    }

    // 6. INISIALISASI CHART.JS
    const ctx = document.getElementById('districtChart').getContext('2d');
    const districtChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'PM2.5 (µg/m³)',
                data: [],
                backgroundColor: [],
                borderRadius: 6,
                barThickness: 18
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 350,
                    grid: { color: '#1e293b' },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#cbd5e1', font: { size: 9 } }
                }
            }
        }
    });

    function updateDistrictChart(list) {
        districtChart.data.labels = list.map(d => d.name.replace('Distrik ', ''));
        districtChart.data.datasets[0].data = list.map(d => d.pm);
        districtChart.data.datasets[0].backgroundColor = list.map(d => {
            if (d.pm > 250) return '#991b1b';
            if (d.pm > 150) return '#dc2626';
            if (d.pm > 55) return '#f97316';
            return '#eab308';
        });
        districtChart.update();
    }

    const monthNamesId = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthNamesShortId = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    function dailyDateLabel(index) {
        const date = new Date(`${dailyDates[index]}T00:00:00Z`);
        return `${date.getUTCDate()} ${monthNamesId[date.getUTCMonth()]} ${date.getUTCFullYear()} · Hari ${index + 1} dari 25`;
    }

    function dailyDateIndex(dateText) {
        return dailyDates.indexOf(dateText);
    }

    function normalizeAcquisitionTime(value) {
        const digits = String(value == null ? '' : value).trim().replace(':', '');
        if (!/^\d{1,4}$/.test(digits)) return null;
        const padded = digits.padStart(4, '0');
        const hour = Number(padded.slice(0, 2));
        const minute = Number(padded.slice(2, 4));
        if (hour > 23 || minute > 59) return null;
        return { hhmm: padded, hour, minute };
    }

    function acquisitionDateWit(dateText, timeValue) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText || '').trim());
        const time = normalizeAcquisitionTime(timeValue);
        if (!match || !time) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const utc = new Date(Date.UTC(year, month - 1, day, time.hour, time.minute));
        if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
        const wit = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
        return { date: wit.toISOString().slice(0, 10), hhmm: time.hhmm };
    }

    function optionalNumber(value) {
        if (value == null || String(value).trim() === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function pointInRing(lng, lat, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0];
            const yi = ring[i][1];
            const xj = ring[j][0];
            const yj = ring[j][1];
            const cross = (lng - xi) * (yj - yi) - (lat - yi) * (xj - xi);
            if (Math.abs(cross) < 1e-10 &&
                lng >= Math.min(xi, xj) - 1e-10 && lng <= Math.max(xi, xj) + 1e-10 &&
                lat >= Math.min(yi, yj) - 1e-10 && lat <= Math.max(yi, yj) + 1e-10) return true;
            if ((yi > lat) !== (yj > lat) &&
                lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    function pointInPolygonCoordinates(lng, lat, rings) {
        if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
        for (let i = 1; i < rings.length; i++) {
            if (pointInRing(lng, lat, rings[i])) return false;
        }
        return true;
    }

    function pointInGeometry(lng, lat, geometry) {
        if (!geometry) return false;
        if (geometry.type === 'Polygon') return pointInPolygonCoordinates(lng, lat, geometry.coordinates);
        if (geometry.type === 'MultiPolygon') {
            return geometry.coordinates.some(polygon => pointInPolygonCoordinates(lng, lat, polygon));
        }
        return false;
    }

    function classifyCoordinates(lat, lng) {
        for (const [parentCode, feature] of parentFeaturesByCode.entries()) {
            const bounds = parentBoundsByCode.get(parentCode);
            if ((!bounds || bounds.contains([lat, lng])) && pointInGeometry(lng, lat, feature.geometry)) {
                let districtCode = null;
                for (const [code, district] of districtFeaturesByCode.entries()) {
                    if (String(district.properties.KDPKAB) === parentCode &&
                        pointInGeometry(lng, lat, district.geometry)) {
                        districtCode = code;
                        break;
                    }
                }
                return { parentCode, districtCode };
            }
        }
        return null;
    }

    function dailyRecordKey(record) {
        const frpValue = optionalNumber(record.frp);
        const frp = frpValue == null ? '' : frpValue.toFixed(3);
        return [
            record.acqDateUtc,
            record.acqTimeUtc,
            Number(record.lat).toFixed(5),
            Number(record.lng).toFixed(5),
            String(record.satellite || '').toUpperCase(),
            String(record.instrument || '').toUpperCase(),
            frp,
            String(record.confidence || '').toLowerCase()
        ].join('|');
    }

    function addDailyRecord(record) {
        const key = dailyRecordKey(record);
        if (dailyRecordKeys.has(key)) return false;
        dailyRecordKeys.add(key);
        dailyRecords.push(record);
        return true;
    }

    function parentRegionName(code) {
        return code === '96.71' ? 'Kota Sorong' : code === '96.01' ? 'Kabupaten Sorong' : 'Di luar wilayah kajian';
    }

    function currentRegionLabel() {
        const value = regionFilter.value;
        if (value === 'all_download') return 'Seluruh area unduhan FIRMS';
        if (value === 'all') return 'Kota Sorong + Kabupaten Sorong';
        if (value === 'kota_sorong') return 'Kota Sorong';
        if (value === 'kabupaten_sorong') return 'Kabupaten Sorong';
        if (value.indexOf('district:') === 0) {
            const feature = districtFeaturesByCode.get(value.slice('district:'.length));
            if (feature) return `Distrik ${feature.properties.WADMKC} · ${parentRegionName(String(feature.properties.KDPKAB))}`;
        }
        return 'Seluruh area unduhan FIRMS';
    }

    function recordMatchesCurrentRegion(record) {
        const value = regionFilter.value;
        if (value === 'all_download') return true;
        if (value === 'all') return Boolean(record.parentCode);
        if (value === 'kota_sorong') return record.parentCode === '96.71';
        if (value === 'kabupaten_sorong') return record.parentCode === '96.01';
        if (value.indexOf('district:') === 0) return record.districtCode === value.slice('district:'.length);
        return false;
    }

    function recordsForDate(dateText) {
        return dailyRecords.filter(record => record.witDate === dateText);
    }

    function renderAllPeriodHotspots() {
        layerGroups.firmsHotspots.clearLayers();
        const visibleRecords = dailyRecords.filter(recordMatchesCurrentRegion);
        visibleRecords.forEach(record => {
            const marker = L.circleMarker([record.lat, record.lng], {
                renderer: firmsCanvasRenderer,
                pane: 'firmsHotspotPane',
                radius: 2.8,
                color: '#6b321d',
                weight: 0.65,
                fillColor: '#f5a45f',
                fillOpacity: 0.86
            });
            marker.bindPopup(makeDailyPopup(record), { maxWidth: 280 });
            layerGroups.firmsHotspots.addLayer(marker);
        });
        const periodLabel = hotspotTimeFilter.value === 'all'
            ? 'Akumulasi deteksi 25 hari'
            : dailyDates[dailyCurrentIndex];
        document.getElementById('firms-summary-status').textContent =
            `${visibleRecords.length.toLocaleString('id-ID')} deteksi · ${periodLabel} · ${currentRegionLabel()}`;
        return visibleRecords;
    }

    function fitAllHotspotBounds(records) {
        const bounds = L.latLngBounds();
        records.forEach(record => bounds.extend([record.lat, record.lng]));
        if (aoiBounds) bounds.extend(aoiBounds);
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
    }

    function facilityMatchesCurrentRegion(properties) {
        const value = regionFilter.value;
        if (value === 'all_download' || value === 'all') return true;
        if (value === 'kota_sorong') return properties.parent_code === '96.71';
        if (value === 'kabupaten_sorong') return properties.parent_code === '96.01';
        if (value.indexOf('district:') === 0) return properties.district_code === value.slice('district:'.length);
        return false;
    }

    function makeOsmFacilityPopup(feature) {
        const properties = feature.properties || {};
        const wrapper = document.createElement('div');
        wrapper.className = 'text-xs space-y-1';
        const title = document.createElement('strong');
        title.textContent = properties.name || `${properties.category_label} · nama tidak tersedia`;
        wrapper.appendChild(title);
        [
            `${properties.category_label} · ${properties.subcategory}`,
            `${properties.parent_name} · distrik ${properties.district_code}`,
            `OpenStreetMap · snapshot ${properties.source_date}`,
            `ID OSM: ${(properties.osm_ids || []).join(', ')}`
        ].forEach(text => {
            const row = document.createElement('div');
            row.textContent = text;
            wrapper.appendChild(row);
        });
        return wrapper;
    }

    function renderOsmFacilities(group) {
        group.clearLayers();
        const visibleFeatures = osmFacilityFeatures.filter(feature =>
            facilityMatchesCurrentRegion(feature.properties || {})
        );
        if (visibleFeatures.length) {
            const colors = {
                school: '#d58a32',
                health: '#c04b5c',
                airport: '#3175ab',
                port: '#208277',
                settlement: '#817459'
            };
            const icons = {
                school: 'fa-school',
                health: 'fa-hospital',
                airport: 'fa-plane',
                port: 'fa-ship',
                settlement: 'fa-home'
            };
            const labels = {
                school: 'Pendidikan',
                health: 'Kesehatan',
                airport: 'Bandara',
                port: 'Pelabuhan',
                settlement: 'Permukiman'
            };
            const makeFacilityIcon = category => L.divIcon({
                className: 'osm-facility-icon',
                html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${colors[category] || '#64748b'};border:2px solid #fef08a;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.45);font-size:10px;"><i class="fas ${icons[category] || 'fa-map-marker-alt'}"></i></span>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            const layer = L.geoJSON({ type: 'FeatureCollection', features: visibleFeatures }, {
                pane: 'verifiedFacilityPane',
                style: feature => ({
                    color: colors[feature.properties.category] || '#64748b',
                    weight: 1.4,
                    fillColor: colors[feature.properties.category] || '#64748b',
                    fillOpacity: 0.3
                }),
                pointToLayer: (feature, latlng) => L.marker(latlng, {
                    pane: 'verifiedFacilityPane',
                    icon: makeFacilityIcon(feature.properties.category),
                    title: labels[feature.properties.category] || 'Fasilitas OSM'
                }),
                onEachFeature: (feature, featureLayer) =>
                    featureLayer.bindPopup(makeOsmFacilityPopup(feature), { maxWidth: 300 })
            });
            group.addLayer(layer);
        }
        return visibleFeatures;
    }

    function updateOsmFacilityLayers() {
        const group = isDailyMode ? layerGroups.dailyOsmFacilities : layerGroups.osmFacilities;
        const visibleFeatures = renderOsmFacilities(group);
        const counts = { school: 0, health: 0, airport: 0, port: 0, settlement: 0 };
        visibleFeatures.forEach(feature => {
            const category = feature.properties.category;
            if (Object.prototype.hasOwnProperty.call(counts, category)) counts[category]++;
        });
        const summary = `OSM terpetakan: ${counts.school} pendidikan · ${counts.health} kesehatan · ${counts.airport} bandara · ${counts.port} pelabuhan · ${counts.settlement} permukiman (${currentRegionLabel()}).`;
        document.getElementById('osm-facility-status').textContent = summary;
        document.getElementById('daily-facility-status').textContent =
            `${summary} Fasilitas skenario manual tetap terpisah; nilai paparannya bukan hasil observasi harian.`;
        if (osmFacilitiesToggle.checked) map.addLayer(group);
        else map.removeLayer(group);
    }

    async function loadOsmFacilities() {
        const status = document.getElementById('osm-facility-status');
        try {
            const response = await fetch('data/fasilitas-sorong.geojson');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) ||
                data.features.some(feature => {
                    const properties = feature.properties || {};
                    return !feature.geometry ||
                        !['Point', 'Polygon', 'MultiPolygon'].includes(feature.geometry.type) ||
                        !['school', 'health', 'airport', 'port', 'settlement'].includes(properties.category) ||
                        !['96.01', '96.71'].includes(properties.parent_code) ||
                        !properties.district_code || !Array.isArray(properties.osm_ids);
                })) {
                throw new Error('GeoJSON fasilitas memiliki skema atau fitur yang tidak valid.');
            }
            osmFacilityFeatures = data.features;
            updateOsmFacilityLayers();
        } catch (error) {
            console.error('Gagal memuat fasilitas OSM:', error);
            status.textContent = `Data fasilitas berkoordinat belum tersedia: ${error.message}`;
            document.getElementById('daily-facility-status').textContent =
                'Data fasilitas OSM belum tersedia; gunakan sumber fasilitas berkoordinat yang valid.';
        }
    }

    function validateDailyWindManifest(manifest) {
        if (!manifest || manifest.version !== 1 ||
            manifest.directionConvention !== 'smoke-toward' || !Array.isArray(manifest.records)) {
            throw new Error('struktur data angin atau konvensi arah tidak valid');
        }
        const dates = new Set();
        manifest.records.forEach(record => {
            if (!record || !dailyDates.includes(record.date) ||
                !Number.isFinite(record.directionTowardDeg) ||
                record.directionTowardDeg < 0 || record.directionTowardDeg >= 360 ||
                !Number.isFinite(record.speedMps) || record.speedMps <= 0 || record.speedMps > 100 ||
                typeof record.timeWit !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.timeWit) ||
                typeof record.source !== 'string' || !record.source.trim()) {
                throw new Error('setiap angin harian harus memiliki tanggal, waktu WIT, bearing asap, kecepatan m/s, dan sumber');
            }
            if (dates.has(record.date)) throw new Error(`data angin untuk ${record.date} duplikat`);
            dates.add(record.date);
        });
        return manifest;
    }

    function getDailyWindManifest() {
        if (!dailyWindManifestPromise) {
            dailyWindManifestPromise = fetch('data/harian/wind.json')
                .then(response => {
                    if (response.status === 404) return { version: 1, directionConvention: 'smoke-toward', records: [] };
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(validateDailyWindManifest);
        }
        return dailyWindManifestPromise;
    }

    function renderDailyWindRecord(wind, error = null) {
        layerGroups.dailyWind.clearLayers();
        const panelArrow = document.getElementById('daily-wind-arrow');
        const legendArrow = document.getElementById('daily-wind-legend-arrow');
        const panelStatus = document.getElementById('daily-wind-status');
        const legendStatus = document.getElementById('daily-wind-legend-status');
        if (!wind) {
            const message = error
                ? `Data angin gagal dimuat; panah tidak ditampilkan: ${error.message}`
                : 'Data angin belum tersedia untuk tanggal ini; panah tidak ditampilkan.';
            panelArrow.classList.add('hidden');
            legendArrow.classList.add('hidden');
            panelStatus.textContent = message;
            legendStatus.textContent = message;
            return;
        }

        const toward = ((wind.directionTowardDeg % 360) + 360) % 360;
        const sampleTime = `${wind.timeWit} WIT`;
        const description =
            `${getWindDescription(toward)} · ${wind.speedMps.toFixed(1)} m/s · ${sampleTime} · ${wind.source}`;
        panelArrow.classList.remove('hidden');
        panelArrow.style.transform = `rotate(${toward}deg)`;
        panelArrow.setAttribute('aria-label', `Panah mengarah ke ${getCompassLabel(toward)}`);
        legendArrow.classList.remove('hidden');
        legendArrow.style.transform = `rotate(${toward}deg)`;
        legendArrow.setAttribute('aria-label', `Panah mengarah ke ${getCompassLabel(toward)}`);
        panelStatus.textContent = description;
        legendStatus.textContent = description;

        windArrowLocations.forEach(point => {
            const icon = L.divIcon({
                className: 'wind-arrow-icon',
                html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:rgba(15,23,42,.88);border:1px solid #67e8f9;color:#67e8f9;text-shadow:0 0 3px #020617;box-shadow:0 0 5px rgba(34,211,238,.8);"><i class="fas fa-arrow-up" style="display:inline-block;transform:rotate(${toward}deg);font-size:12px;"></i></span>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            L.marker(point, {
                icon,
                pane: 'dailyWindPane',
                interactive: false,
                keyboard: false
            }).addTo(layerGroups.dailyWind);
        });
    }

    async function loadDailyWindRecord(dateText, requestId) {
        try {
            const manifest = await getDailyWindManifest();
            const wind = manifest.records.find(record => record.date === dateText);
            if (requestId !== dailyModelRequestId || !isDailyMode) return null;
            renderDailyWindRecord(wind || null);
            return wind || null;
        } catch (error) {
            if (requestId !== dailyModelRequestId || !isDailyMode) return null;
            console.error('Gagal memuat data angin harian:', error);
            renderDailyWindRecord(null, error);
            return null;
        }
    }

    async function loadDailyIllustration(dateText, requestId, sources) {
        const wind = await loadDailyWindRecord(dateText, requestId);
        if (requestId !== dailyModelRequestId || !isDailyMode) return;

        if (!sources.length) {
            document.getElementById('daily-smoke-status').textContent =
                'Data hotspot belum tersedia untuk tanggal ini; sebaran ilustratif tidak ditampilkan.';
            document.getElementById('daily-model-status').textContent =
                'Ilustrasi harian · intensitas relatif tidak ditampilkan karena hotspot tidak tersedia.';
            markDailyDateReady(requestId);
            return;
        }
        if (!wind) {
            document.getElementById('daily-smoke-status').textContent =
                'Data angin belum tersedia untuk tanggal ini; hotspot tetap ditampilkan.';
            document.getElementById('daily-model-status').textContent =
                'Ilustrasi harian · intensitas relatif tidak ditampilkan karena data angin belum tersedia.';
            markDailyDateReady(requestId);
            return;
        }

        dailySmokeSources = sources;
        dailySmokeState = {
            windDir: wind.directionTowardDeg,
            windSpeed: wind.speedMps,
            frpMult: 1,
            plumeOpacity: simState.plumeOpacity
        };
        document.getElementById('daily-smoke-status').textContent = dailySmokeVisible
            ? `Ilustrasi harian aktif · ${sources.length} sumber hotspot; arah dan kecepatan angin mengikuti data tanggal ini.`
            : 'Data hotspot dan angin tersedia; layer gradasi sedang disembunyikan.';
        document.getElementById('daily-model-status').textContent =
            'Ilustrasi harian · intensitas relatif; bukan hasil model HYSPLIT.';
        renderDailySmokeFrame(dailyPlumeProgress);
        markDailyDateReady(requestId);
    }

    function makeDailyPopup(record) {
        const wrapper = document.createElement('div');
        wrapper.className = 'text-xs space-y-1';
        const title = document.createElement('strong');
        title.textContent = 'Titik panas VIIRS/FIRMS';
        wrapper.appendChild(title);
        const fields = [
            `Wilayah: ${parentRegionName(record.parentCode)}`,
            `Tanggal WIT: ${record.witDate}`,
            `Akuisisi UTC: ${record.acqDateUtc} ${record.acqTimeUtc} UTC`,
            `Sensor: ${record.satellite || 'tidak tersedia'} · ${record.instrument || 'instrumen tidak tersedia'} · ${record.version || 'versi tidak tersedia'}`,
            `FRP: ${record.frp == null ? 'tidak tersedia; simulasi memakai bobot relatif 1' : `${record.frp} (satuan belum terverifikasi)`}`,
            `Brightness: ${record.brightness == null ? 'tidak tersedia' : record.brightness} · Brightness T31: ${record.brightT31 == null ? 'tidak tersedia' : record.brightT31}`,
            `Confidence: ${record.confidence || 'tidak tersedia'}`,
            `Sumber: ${record.sourceLabel}`
        ];
        fields.forEach(text => {
            const row = document.createElement('div');
            row.textContent = text;
            wrapper.appendChild(row);
        });
        return wrapper;
    }

    function validateHysplitManifest(manifest) {
        if (!manifest || manifest.version !== 1 || manifest.crs !== 'EPSG:4326' ||
            manifest.palette !== 'sagu-bara-smoke-v1' || !Array.isArray(manifest.rasters)) {
            throw new Error('struktur manifest, CRS, atau palet tidak valid');
        }
        if (!manifest.rasters.length) return manifest;
        if (!manifest.scale || !Number.isFinite(manifest.scale.min) ||
            !Number.isFinite(manifest.scale.max) || manifest.scale.max <= manifest.scale.min ||
            typeof manifest.scale.unit !== 'string' || !manifest.scale.unit.trim()) {
            throw new Error('skala bersama atau satuan raster tidak valid');
        }

        const seenRasterKeys = new Set();
        const rastersPerDate = new Map();
        manifest.rasters.forEach(raster => {
            if (!raster || !dailyDates.includes(raster.date) ||
                typeof raster.file !== 'string' || !/^[a-z0-9._-]+\.png$/i.test(raster.file) ||
                raster.nodataTransparent !== true || !Array.isArray(raster.bounds) ||
                raster.bounds.length !== 4 || !raster.bounds.every(Number.isFinite)) {
                throw new Error('setiap raster harus berupa PNG, NoData transparan, dan memiliki batas WGS 84');
            }
            if (raster.interval != null && (typeof raster.interval !== 'string' || !raster.interval.trim())) {
                throw new Error(`interval raster ${raster.date} harus berupa teks WIT yang tidak kosong`);
            }
            const intervalKey = raster.interval || 'harian';
            const rasterKey = `${raster.date}|${intervalKey}`;
            if (seenRasterKeys.has(rasterKey)) throw new Error(`interval raster ${raster.date} duplikat`);
            const [south, west, north, east] = raster.bounds;
            if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) {
                throw new Error(`batas WGS 84 raster ${raster.date} tidak valid`);
            }
            seenRasterKeys.add(rasterKey);
            rastersPerDate.set(raster.date, (rastersPerDate.get(raster.date) || 0) + 1);
        });
        manifest.rasters.forEach(raster => {
            if (rastersPerDate.get(raster.date) > 1 && !raster.interval) {
                throw new Error(`setiap raster pada ${raster.date} memerlukan interval WIT yang berbeda`);
            }
        });
        return manifest;
    }

    function getHysplitManifest() {
        if (!hysplitManifestPromise) {
            hysplitManifestPromise = fetch('data/harian/hysplit/manifest.json')
                .then(response => {
                    if (response.status === 404) return null;
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(manifest => manifest == null ? null : validateHysplitManifest(manifest));
        }
        return hysplitManifestPromise;
    }

    function preloadHysplitImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`berkas raster tidak dapat dimuat: ${url}`));
            image.src = url;
        });
    }

    async function loadDailyHysplitRaster(date, requestId, displayLayer) {
        try {
            const manifest = await getHysplitManifest();
            if (requestId !== dailyModelRequestId || !isDailyMode) return;
            const dayRasters = manifest ? manifest.rasters.filter(item => item.date === date) : [];
            const intervalSelect = document.getElementById('daily-hysplit-time');
            const intervalContainer = document.getElementById('daily-hysplit-time-container');
            const previousInterval = intervalSelect.value;
            intervalSelect.innerHTML = '';
            if (!dayRasters.length) {
                const unavailable = 'Hasil model belum tersedia untuk tanggal ini.';
                document.getElementById('daily-model-status').textContent = unavailable;
                document.getElementById('daily-smoke-status').textContent = unavailable;
                document.getElementById('daily-hysplit-legend').classList.add('hidden');
                document.getElementById('daily-hysplit-empty-legend').classList.remove('hidden');
                intervalContainer.classList.add('hidden');
                markDailyDateReady(requestId);
                return;
            }
            dayRasters.forEach(item => {
                const option = document.createElement('option');
                option.value = item.interval || 'harian';
                option.textContent = item.interval || 'Harian';
                intervalSelect.appendChild(option);
            });
            const raster = dayRasters.find(item => (item.interval || 'harian') === previousInterval) || dayRasters[0];
            intervalSelect.value = raster.interval || 'harian';
            intervalContainer.classList.toggle('hidden', dayRasters.length < 2);

            const imageUrl = `data/harian/hysplit/${raster.file}`;
            document.getElementById('daily-model-status').textContent = 'Memuat raster HYSPLIT…';
            document.getElementById('daily-smoke-status').textContent = 'Memuat raster HYSPLIT untuk tanggal WIT terpilih…';
            await preloadHysplitImage(imageUrl);
            if (requestId !== dailyModelRequestId || !isDailyMode) return;

            const [south, west, north, east] = raster.bounds;
            document.getElementById('hysplit-scale-min').textContent = manifest.scale.min;
            document.getElementById('hysplit-scale-max').textContent = manifest.scale.max;
            document.getElementById('hysplit-scale-unit').textContent = manifest.scale.unit;
            document.getElementById('hysplit-scale-unit-end').textContent = manifest.scale.unit;
            document.getElementById('daily-plume-legend').classList.add('hidden');
            document.getElementById('daily-hysplit-empty-legend').classList.add('hidden');
            document.getElementById('daily-hysplit-legend').classList.remove('hidden');
            document.getElementById('daily-model-status').textContent =
                `Raster HYSPLIT tersedia${raster.interval ? ` · ${raster.interval}` : ''} · skala ${manifest.scale.min}–${manifest.scale.max} ${manifest.scale.unit}.`;
            document.getElementById('daily-smoke-status').textContent = displayLayer
                ? 'Raster HYSPLIT ditampilkan pada batas geografis aslinya; NoData transparan.'
                : 'Raster tersedia; layer gradasi sedang disembunyikan.';
            if (displayLayer) {
                dailySmokeOverlay = L.imageOverlay(imageUrl, [[south, west], [north, east]], {
                    opacity: simState.plumeOpacity,
                    pane: 'dailySmokePane',
                    interactive: false,
                    className: 'smoke-overlay-image'
                }).addTo(layerGroups.dailySmoke);
            }
            markDailyDateReady(requestId);
        } catch (error) {
            if (requestId !== dailyModelRequestId || !isDailyMode) return;
            console.error('Gagal memuat raster HYSPLIT harian:', error);
            const message = `Raster HYSPLIT gagal dimuat: ${error.message}`;
            document.getElementById('daily-model-status').textContent = message;
            document.getElementById('daily-smoke-status').textContent = message;
            document.getElementById('daily-hysplit-legend').classList.add('hidden');
            document.getElementById('daily-hysplit-empty-legend').classList.remove('hidden');
            markDailyDateReady(requestId);
        }
    }

    function updateDailyChart() {
        if (!dailyChart) {
            dailyChart = new Chart(document.getElementById('dailyChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dailyDates.map(date => {
                        const parsed = new Date(`${date}T00:00:00Z`);
                        return `${parsed.getUTCDate()} ${monthNamesShortId[parsed.getUTCMonth()]}`;
                    }),
                    datasets: [
                        { label: 'Kota Sorong', data: [], backgroundColor: '#a78bfa', borderRadius: 3 },
                        { label: 'Kabupaten Sorong', data: [], backgroundColor: '#a3b18a', borderRadius: 3 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 9 } } },
                        tooltip: {
                            callbacks: {
                                label: context => `${context.dataset.label}: ${context.parsed.y} rekaman sumber`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0, color: '#94a3b8', font: { size: 9 } },
                            grid: { color: '#1e293b' }
                        },
                        x: { ticks: { color: '#94a3b8', font: { size: 8 }, maxRotation: 0 }, grid: { display: false } }
                    }
                }
            });
        }
        const city = dailyDates.map(date => {
            const count = dailyRecords.filter(record => record.witDate === date && record.parentCode === '96.71').length;
            return count ? count : null;
        });
        const county = dailyDates.map(date => {
            const count = dailyRecords.filter(record => record.witDate === date && record.parentCode === '96.01').length;
            return count ? count : null;
        });
        dailyChart.data.datasets[0].data = city;
        dailyChart.data.datasets[1].data = county;
        dailyChart.update();
    }

    function updateDailyDay(resetSmokeProgress = false) {
        const modelRequestId = ++dailyModelRequestId;
        if (isDailyMode) dailyDateReady = false;
        layerGroups.dailyWind.clearLayers();
        document.getElementById('daily-wind-arrow').classList.add('hidden');
        document.getElementById('daily-wind-legend-arrow').classList.add('hidden');
        const dateText = dailyDates[dailyCurrentIndex];
        const dayLabel = dailyDateLabel(dailyCurrentIndex);
        const dayRecords = recordsForDate(dateText);
        const visibleRecords = dayRecords.filter(recordMatchesCurrentRegion);
        const smokeRecords = regionFilter.value === 'all_download'
            ? visibleRecords.filter(record => record.parentCode)
            : visibleRecords;
        const cityCount = dayRecords.filter(record => record.parentCode === '96.71').length;
        const countyCount = dayRecords.filter(record => record.parentCode === '96.01').length;
        if (resetSmokeProgress) dailyPlaybackElapsed = 0;
        dailyPlumeProgress = dailyTimer === null
            ? (resetSmokeProgress ? 0 : dailyPlumeProgress)
            : dailyDateReady
                ? Math.min(1, (dailyPlaybackElapsed + performance.now() - dailyPlaybackStartedAt) / manualScenarioDuration)
                : 0;

        document.getElementById('daily-date-label').textContent = dayLabel;
        document.getElementById('daily-date-picker').value = dateText;
        document.getElementById('daily-date-slider').value = dailyCurrentIndex;
        document.getElementById('daily-prev-btn').disabled = dailyCurrentIndex === 0;
        document.getElementById('daily-next-btn').disabled = dailyCurrentIndex === dailyDates.length - 1;
        document.getElementById('daily-prev-btn').classList.toggle('opacity-50', dailyCurrentIndex === 0);
        document.getElementById('daily-next-btn').classList.toggle('opacity-50', dailyCurrentIndex === dailyDates.length - 1);
        document.getElementById('daily-summary-date').textContent = dayLabel;
        document.getElementById('daily-summary-region').textContent = `Wilayah: ${currentRegionLabel()}`;
        document.getElementById('daily-summary-source').textContent = `${dailySourceLabel}. ` + (visibleRecords.length
            ? `${visibleRecords.length.toLocaleString('id-ID')} deteksi pada tanggal WIT ini. ${regionFilter.value === 'all_download' ? `${smokeRecords.length.toLocaleString('id-ID')} deteksi di AOI dipakai untuk ilustrasi; deteksi luar AOI tetap ditampilkan sebagai hotspot.` : ''} Cakupan pengamatan tidak tercantum, jadi data kosong bukan bukti nihil hotspot.`
            : 'Data hotspot belum tersedia untuk tanggal/wilayah ini; cakupan pengamatan harian tidak terkonfirmasi.');
        document.getElementById('daily-city-count').textContent = cityCount ? `${cityCount} rekaman` : 'Data hotspot belum tersedia';
        document.getElementById('daily-county-count').textContent = countyCount ? `${countyCount} rekaman` : 'Data hotspot belum tersedia';
        const modelMessage = 'Hasil model belum tersedia untuk tanggal ini.';
        document.getElementById('daily-model-status').textContent = dailySmokeMethod.value === 'hysplit'
            ? 'Hasil model HYSPLIT · memeriksa data tanggal ini…'
            : 'Ilustrasi harian · intensitas relatif.';
        document.getElementById('daily-smoke-status').textContent = dailySmokeMethod.value === 'hysplit'
            ? modelMessage
            : !dailySmokeToggle.checked
                ? 'Gradasi asap disembunyikan; simbol hotspot tetap dapat ditampilkan.'
                : visibleRecords.length
                    ? 'Memeriksa ketersediaan angin untuk tanggal ini…'
                    : 'Data hotspot belum tersedia untuk tanggal/wilayah ini; gradasi hari sebelumnya telah dibersihkan.';
        document.getElementById('daily-wind-status').textContent = dailySmokeMethod.value === 'hysplit'
            ? 'Memeriksa data angin untuk tanggal ini…'
            : 'Memeriksa ketersediaan angin untuk tanggal ini…';
        document.getElementById('daily-wind-legend-status').textContent =
            'Memeriksa ketersediaan angin untuk tanggal ini…';
        document.getElementById('daily-plume-legend').classList.toggle(
            'hidden', !isDailyMode || dailySmokeMethod.value === 'hysplit'
        );
        document.getElementById('daily-hysplit-legend').classList.add('hidden');
        document.getElementById('daily-hysplit-empty-legend').classList.toggle(
            'hidden', !isDailyMode || dailySmokeMethod.value !== 'hysplit'
        );
        document.getElementById('daily-hysplit-time-container').classList.add('hidden');
        document.getElementById('daily-facility-status').textContent =
            'Daftar fasilitas yang tersedia berasal dari skenario manual; sumber dan validasi lokasinya tidak tercatat. Nilai paparan harian tidak dihitung.';

        layerGroups.dailyHotspots.clearLayers();
        visibleRecords.forEach(record => {
            const marker = L.circleMarker([record.lat, record.lng], {
                renderer: firmsCanvasRenderer,
                pane: 'dailyHotspotPane',
                radius: 2.8,
                color: record.parentCode === '96.71' ? '#6d4b8a' : record.parentCode === '96.01' ? '#526c3c' : '#7b3b20',
                weight: 0.65,
                fillColor: record.parentCode === '96.71' ? '#c8a9e4' : record.parentCode === '96.01' ? '#b7cc91' : '#f5a45f',
                fillOpacity: 0.9
            });
            marker.bindPopup(makeDailyPopup(record), { maxWidth: 280 });
            layerGroups.dailyHotspots.addLayer(marker);
        });

        layerGroups.dailyFacilities.clearLayers();
        layerGroups.dailyOsmFacilities.clearLayers();
        const selectedFacilities = vitalFacilities.filter(facility => {
            const classification = classifyCoordinates(facility.lat, facility.lng);
            return classification && (regionFilter.value === 'all_download' || regionFilter.value === 'all' ||
                (regionFilter.value === 'kota_sorong' && classification.parentCode === '96.71') ||
                (regionFilter.value === 'kabupaten_sorong' && classification.parentCode === '96.01') ||
                (regionFilter.value.indexOf('district:') === 0 && classification.districtCode === regionFilter.value.slice('district:'.length)));
        });
        selectedFacilities.forEach(facility => {
            const marker = L.circleMarker([facility.lat, facility.lng], {
                pane: 'dailyFacilityPane',
                radius: 5,
                color: '#99f6e4',
                weight: 1.5,
                fillColor: '#0f766e',
                fillOpacity: 0.9
            });
            const popup = document.createElement('div');
            popup.className = 'text-xs';
            const facilityTitle = document.createElement('strong');
            facilityTitle.textContent = facility.name;
            popup.appendChild(facilityTitle);
            const facilityInfo = document.createElement('div');
            facilityInfo.textContent = `${facility.district} · lokasi skenario manual; tidak ada nilai paparan harian terverifikasi.`;
            popup.appendChild(facilityInfo);
            marker.bindPopup(popup);
            layerGroups.dailyFacilities.addLayer(marker);
        });
        updateOsmFacilityLayers();

        dailySmokeOverlay = null;
        dailySmokeSources = [];
        dailySmokeState = null;
        dailySmokeVisible = false;
        if (isDailyMode) {
            const layerPreferences = {
                'layer-hotspots': dailyHotspotsToggle.checked && document.getElementById('layer-hotspots').checked,
                'layer-facilities': document.getElementById('layer-facilities').checked,
                'layer-wind': document.getElementById('layer-wind').checked,
                'layer-plume': dailySmokeToggle.checked && document.getElementById('layer-plume').checked
            };
            Object.keys(layerPreferences).forEach(id => {
                const group = id === 'layer-hotspots' ? layerGroups.dailyHotspots :
                    id === 'layer-facilities' ? layerGroups.dailyFacilities :
                        id === 'layer-wind' ? layerGroups.dailyWind : layerGroups.dailySmoke;
                if (id === 'layer-plume') {
                    layerGroups.dailySmoke.clearLayers();
                    dailySmokeVisible = layerPreferences[id];
                    if (dailySmokeMethod.value === 'hysplit') {
                        loadDailyWindRecord(dateText, modelRequestId);
                        loadDailyHysplitRaster(dateText, modelRequestId, layerPreferences[id]);
                    } else {
                        loadDailyIllustration(dateText, modelRequestId, smokeRecords);
                    }
                }
                if (layerPreferences[id]) map.addLayer(group);
                else map.removeLayer(group);
            });
        }
        document.getElementById('daily-export-btn').disabled = visibleRecords.length === 0;
        document.getElementById('daily-export-btn').classList.toggle('opacity-50', visibleRecords.length === 0);
        if (isDailyMode) {
            document.getElementById('firms-summary-status').textContent =
                `${visibleRecords.length.toLocaleString('id-ID')} deteksi · ${dateText} WIT · ${currentRegionLabel()}`;
        }
        updateDailyChart();
    }

    function stopDailyPlayback() {
        if (dailyTimer !== null) {
            if (dailyDateReady) dailyPlaybackElapsed += performance.now() - dailyPlaybackStartedAt;
            clearInterval(dailyTimer);
            dailyTimer = null;
        }
        dailyPlayButton.textContent = dailyCurrentIndex === dailyDates.length - 1 ? 'Putar ulang' : 'Play';
        dailyPlayButton.setAttribute('aria-label', dailyCurrentIndex === dailyDates.length - 1 ? 'Putar ulang perkembangan harian' : 'Putar perkembangan harian');
    }

    function setDailyIndex(index) {
        dailyCurrentIndex = Math.max(0, Math.min(dailyDates.length - 1, Number(index)));
        dailyPlaybackElapsed = 0;
        dailyPlaybackStartedAt = performance.now();
        updateDailyDay(true);
        if (dailyTimer === null) stopDailyPlayback();
    }

    function startDailyPlayback() {
        if (dailyTimer !== null) {
            stopDailyPlayback();
            return;
        }
        if (dailyCurrentIndex === dailyDates.length - 1) setDailyIndex(0);
        dailyPlayButton.textContent = 'Jeda';
        dailyPlayButton.setAttribute('aria-label', 'Jeda perkembangan harian');
        dailyPlaybackStartedAt = performance.now();
        dailyTimer = setInterval(() => {
            if (!dailyDateReady) return;
            const elapsed = dailyPlaybackElapsed + performance.now() - dailyPlaybackStartedAt;
            if (elapsed < manualScenarioDuration) {
                renderDailySmokeFrame(elapsed / manualScenarioDuration);
            } else if (dailyPlumeProgress < 1) {
                renderDailySmokeFrame(1);
            }
            if (elapsed < manualScenarioDuration + dailyFrameHoldDuration) return;
            if (dailyCurrentIndex >= dailyDates.length - 1) {
                stopDailyPlayback();
                return;
            }
            dailyCurrentIndex++;
            dailyPlaybackElapsed = 0;
            dailyPlaybackStartedAt = performance.now();
            updateDailyDay(true);
        }, 120);
    }

    function setDailyMode(enabled) {
        if (isDailyMode === enabled) {
            hotspotTimeFilter.value = enabled ? 'daily' : 'all';
            return;
        }
        isDailyMode = enabled;
        hotspotTimeFilter.value = enabled ? 'daily' : 'all';
        if (enabled) {
            stopManualPlayback();
            dailyPlaybackElapsed = 0;
            dailyPlumeProgress = 0;
            manualSettingsSnapshot = {
                windDir: simState.windDir,
                windSpeed: simState.windSpeed,
                frpMult: simState.frpMult,
                plumeOpacity: simState.plumeOpacity,
                timeValue: document.getElementById('time-slider').value
            };
        } else {
            stopDailyPlayback();
            if (manualSettingsSnapshot) {
                simState.windDir = manualSettingsSnapshot.windDir;
                simState.windSpeed = manualSettingsSnapshot.windSpeed;
                simState.frpMult = manualSettingsSnapshot.frpMult;
                simState.plumeOpacity = manualSettingsSnapshot.plumeOpacity;
                document.getElementById('sim-wind-dir').value = simState.windDir;
                document.getElementById('wind-dir-display').textContent = `${simState.windDir}° (${getCompassLabel(simState.windDir)})`;
                document.getElementById('sim-wind-speed').value = simState.windSpeed;
                document.getElementById('wind-speed-display').textContent = `${simState.windSpeed.toFixed(1)} m/s`;
                document.getElementById('sim-frp-mult').value = simState.frpMult;
                document.getElementById('frp-mult-display').textContent = `${simState.frpMult.toFixed(1)}x`;
                document.getElementById('plume-opacity-slider').value = Math.round(simState.plumeOpacity * 100);
                document.getElementById('plume-opacity-val').textContent = `${Math.round(simState.plumeOpacity * 100)}%`;
                document.getElementById('time-slider').value = manualSettingsSnapshot.timeValue;
            }
        }
        document.getElementById('daily-source-panel').classList.toggle('hidden', !enabled);
        document.querySelectorAll('.manual-only-layer').forEach(element => element.classList.toggle('hidden', enabled));
        document.getElementById('manual-timebar').classList.toggle('hidden', enabled);
        document.getElementById('daily-timebar').classList.toggle('hidden', !enabled);
        document.getElementById('manual-plume-legend').classList.toggle('hidden', enabled);
        document.getElementById('daily-plume-legend').classList.toggle('hidden', !enabled);
        document.getElementById('daily-wind-legend').classList.toggle('hidden', !enabled);
        document.getElementById('wind-layer-label').textContent =
            enabled ? 'Arah angin harian · ERA5' : 'Arah asap skenario';
        document.getElementById('manual-analysis-content').classList.toggle('hidden', enabled);
        document.getElementById('daily-analysis-content').classList.toggle('hidden', !enabled);
        document.getElementById('right-sidebar-title').innerHTML = enabled
            ? '<i class="fas fa-calendar-day text-amber-400"></i> Perkembangan Harian'
            : '<i class="fas fa-chart-pie text-teal-400"></i> Ringkasan Analisis Dampak';

        [layerGroups.burned, layerGroups.aod, layerGroups.plume, layerGroups.wind, layerGroups.dailyWind,
            layerGroups.hotspots, layerGroups.firmsHotspots, layerGroups.facilities,
            layerGroups.osmFacilities, layerGroups.dailyOsmFacilities].forEach(group => map.removeLayer(group));
        if (!enabled) {
            map.removeLayer(layerGroups.dailySmoke);
            map.removeLayer(layerGroups.dailyHotspots);
            map.removeLayer(layerGroups.dailyFacilities);
            Object.entries({
                'layer-burned': layerGroups.burned,
                'layer-wind': layerGroups.wind,
                'layer-plume': layerGroups.plume,
                'layer-aod': layerGroups.aod,
                'layer-hotspots': layerGroups.hotspots,
                'layer-facilities': layerGroups.facilities
            }).forEach(([id, group]) => {
                if (document.getElementById(id).checked) map.addLayer(group);
            });
            if (firmsHotspotsToggle.checked) map.addLayer(layerGroups.firmsHotspots);
            renderAllLayers();
            updateOsmFacilityLayers();
        } else {
            document.getElementById('daily-opacity-slider').value = Math.round(simState.plumeOpacity * 100);
            document.getElementById('daily-opacity-value').textContent = `${Math.round(simState.plumeOpacity * 100)}%`;
            updateDailyDay();
        }
        setTimeout(() => map.invalidateSize(), 50);
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (quoted) {
                if (char === '"' && text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else if (char === '"') {
                    quoted = false;
                } else {
                    field += char;
                }
            } else if (char === '"' && field.length === 0) {
                quoted = true;
            } else if (char === ',') {
                row.push(field);
                field = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && text[i + 1] === '\n') i++;
                row.push(field);
                if (row.some(value => value.trim() !== '')) rows.push(row);
                row = [];
                field = '';
            } else {
                field += char;
            }
        }
        row.push(field);
        if (row.some(value => value.trim() !== '')) rows.push(row);
        return rows;
    }

    function csvHeaderIndex(headers, candidates) {
        return headers.findIndex(header => candidates.includes(header.trim().toLowerCase()));
    }

    function importFirmsCsv(text, fileName) {
        if (!parentFeaturesByCode.size) throw new Error('Batas BIG belum selesai dimuat; coba impor kembali sebentar lagi.');
        const rows = parseCsv(text);
        if (rows.length < 2) throw new Error('CSV tidak memiliki baris data.');
        const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim().toLowerCase());
        const columns = {
            lat: csvHeaderIndex(headers, ['latitude', 'lat']),
            lng: csvHeaderIndex(headers, ['longitude', 'lon', 'long']),
            date: csvHeaderIndex(headers, ['acq_date', 'acquisition_date', 'date']),
            time: csvHeaderIndex(headers, ['acq_time', 'acquisition_time', 'time']),
            frp: csvHeaderIndex(headers, ['frp']),
            confidence: csvHeaderIndex(headers, ['confidence']),
            satellite: csvHeaderIndex(headers, ['satellite']),
            instrument: csvHeaderIndex(headers, ['instrument']),
            version: csvHeaderIndex(headers, ['version']),
            brightness: csvHeaderIndex(headers, ['brightness']),
            brightT31: csvHeaderIndex(headers, ['bright_t31']),
            scan: csvHeaderIndex(headers, ['scan']),
            track: csvHeaderIndex(headers, ['track']),
            daynight: csvHeaderIndex(headers, ['daynight'])
        };
        if (columns.lat < 0 || columns.lng < 0 || columns.date < 0 || columns.time < 0) {
            throw new Error('Kolom wajib tidak lengkap. Diperlukan latitude, longitude, acq_date, dan acq_time.');
        }
        let accepted = 0;
        let outsideAoi = 0;
        let invalid = 0;
        let outOfPeriod = 0;
        let duplicates = 0;
        rows.slice(1).forEach(values => {
            const lat = Number(values[columns.lat]);
            const lng = Number(values[columns.lng]);
            const dateUtc = String(values[columns.date] || '').trim();
            const time = acquisitionDateWit(dateUtc, values[columns.time]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !time) {
                invalid++;
                return;
            }
            if (dailyDateIndex(time.date) < 0) {
                outOfPeriod++;
                return;
            }
            const classification = classifyCoordinates(lat, lng);
            if (!classification) outsideAoi++;
            const frpValue = columns.frp >= 0 ? optionalNumber(values[columns.frp]) : null;
            const record = {
                lat,
                lng,
                frp: frpValue,
                confidence: columns.confidence >= 0 ? String(values[columns.confidence] || '').trim() : '',
                satellite: columns.satellite >= 0 ? String(values[columns.satellite] || '').trim() : '',
                instrument: columns.instrument >= 0 ? String(values[columns.instrument] || '').trim() : '',
                version: columns.version >= 0 ? String(values[columns.version] || '').trim() : '',
                brightness: columns.brightness >= 0 ? optionalNumber(values[columns.brightness]) : null,
                brightT31: columns.brightT31 >= 0 ? optionalNumber(values[columns.brightT31]) : null,
                scan: columns.scan >= 0 ? optionalNumber(values[columns.scan]) : null,
                track: columns.track >= 0 ? optionalNumber(values[columns.track]) : null,
                daynight: columns.daynight >= 0 ? String(values[columns.daynight] || '').trim() : '',
                acqDateUtc: dateUtc,
                acqTimeUtc: normalizeAcquisitionTime(values[columns.time]).hhmm,
                witDate: time.date,
                parentCode: classification ? classification.parentCode : null,
                districtCode: classification ? classification.districtCode : null,
                sourceLabel: fileName
            };
            if (addDailyRecord(record)) accepted++;
            else duplicates++;
        });
        return { accepted, outsideAoi, invalid, outOfPeriod, duplicates };
    }

    async function loadDailyHotspots() {
        const status = document.getElementById('daily-auto-source-status');
        try {
            const response = await fetch('data/harian/hotspots-firms.csv');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = importFirmsCsv(await response.text(), 'hotspots-firms.csv');
            dailySourceLabel = 'NASA FIRMS VIIRS 375 m · CSV lokal';
            const datesWithData = new Set(dailyRecords.map(record => record.witDate));
            const outsideAoi = dailyRecords.filter(record => !record.parentCode).length;
            status.textContent = `${dailyRecords.length.toLocaleString('id-ID')} deteksi valid dalam periode (${outsideAoi.toLocaleString('id-ID')} di luar AOI Sorong); ${datesWithData.size}/25 hari memiliki rekaman.`;
            document.getElementById('daily-import-status').textContent =
                `CSV lokal dimuat otomatis; ${result.outOfPeriod} rekaman di luar periode WIT diabaikan. Impor ulang tidak menggandakan deteksi.`;
            document.getElementById('daily-summary-source').textContent = dailySourceLabel;
            const visibleRecords = renderAllPeriodHotspots();
            if (hotspotTimeFilter.value === 'all') fitAllHotspotBounds(visibleRecords);
            if (firmsHotspotsToggle.checked) map.addLayer(layerGroups.firmsHotspots);
            updateDailyDay();
        } catch (error) {
            status.textContent = `Data hotspot otomatis belum tersedia (${error.message}); gunakan impor CSV FIRMS.`;
            dailySourceLabel = 'Data hotspot belum tersedia';
        }
    }

    // 7. EVENT LISTENERS UI & INTERAKSI
    // Helper Toast
    let toastTimeout;
    function showToast(msg) {
        const el = document.getElementById('toast-msg');
        document.getElementById('toast-text').textContent = msg;
        el.classList.remove('hidden');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => el.classList.add('hidden'), 2600);
    }

    // Toggle Sidebars
    document.getElementById('toggle-left-sidebar').addEventListener('click', () => {
        document.getElementById('left-sidebar').classList.toggle('hidden');
        setTimeout(() => map.invalidateSize(), 310);
    });

    document.getElementById('toggle-right-sidebar').addEventListener('click', () => {
        const rs = document.getElementById('right-sidebar');
        rs.classList.toggle('hidden');
        rs.classList.toggle('flex');
        setTimeout(() => map.invalidateSize(), 310);
    });
    document.getElementById('close-right-sidebar').addEventListener('click', () => {
        const rs = document.getElementById('right-sidebar');
        rs.classList.add('hidden');
        rs.classList.remove('flex');
    });

    // Tabs Switcher (Left Sidebar)
    const tabBtnLayers = document.getElementById('tab-btn-layers');
    const tabBtnSim = document.getElementById('tab-btn-sim');
    const tabContentLayers = document.getElementById('tab-content-layers');
    const tabContentSim = document.getElementById('tab-content-sim');

    tabBtnLayers.addEventListener('click', () => {
        tabBtnLayers.className = 'tab-btn active py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-teal-600 text-white shadow';
        tabBtnSim.className = 'tab-btn py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition';
        tabContentLayers.classList.remove('hidden');
        tabContentSim.classList.add('hidden');
    });

    tabBtnSim.addEventListener('click', () => {
        tabBtnSim.className = 'tab-btn active py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-teal-600 text-white shadow';
        tabBtnLayers.className = 'tab-btn py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition';
        tabContentSim.classList.remove('hidden');
        tabContentLayers.classList.add('hidden');
    });

    // Layer Visibility Checkboxes
    const layerCheckboxes = {
        'layer-hotspots': layerGroups.hotspots,
        'layer-burned': layerGroups.burned,
        'layer-wind': layerGroups.wind,
        'layer-plume': layerGroups.plume,
        'layer-aod': layerGroups.aod,
        'layer-firms-hotspots': layerGroups.firmsHotspots,
        'layer-admin-parents': layerGroups.adminParents,
        'layer-facilities': layerGroups.facilities,
        'layer-osm-facilities': layerGroups.osmFacilities
    };

    Object.entries(layerCheckboxes).forEach(([id, group]) => {
        document.getElementById(id).addEventListener('change', (e) => {
            if (isDailyMode) {
                if (id === 'layer-wind') {
                    if (e.target.checked) map.addLayer(layerGroups.dailyWind);
                    else map.removeLayer(layerGroups.dailyWind);
                    return;
                }
                if (id === 'layer-hotspots') {
                    return;
                }
                if (id === 'layer-firms-hotspots') {
                    dailyHotspotsToggle.checked = e.target.checked;
                    if (e.target.checked) map.addLayer(layerGroups.dailyHotspots);
                    else map.removeLayer(layerGroups.dailyHotspots);
                    return;
                }
                if (id === 'layer-plume') {
                    dailySmokeToggle.checked = e.target.checked;
                    if (e.target.checked && dailySmokeMethod.value === 'simulation') map.addLayer(layerGroups.dailySmoke);
                    else map.removeLayer(layerGroups.dailySmoke);
                    updateDailyDay();
                    return;
                }
                if (id === 'layer-facilities') {
                    if (e.target.checked) map.addLayer(layerGroups.dailyFacilities);
                    else map.removeLayer(layerGroups.dailyFacilities);
                    return;
                }
                if (id === 'layer-osm-facilities') {
                    updateOsmFacilityLayers();
                    return;
                }
                if (id !== 'layer-admin-parents') return;
            }
            if (e.target.checked) map.addLayer(group);
            else map.removeLayer(group);
        });
    });

    districtLayerCheckbox.addEventListener('change', updateDistrictLayerVisibility);

    // Opacity Slider
    document.getElementById('plume-opacity-slider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        simState.plumeOpacity = val / 100;
        document.getElementById('plume-opacity-val').textContent = `${val}%`;
        renderAllLayers();
        if (isDailyMode) updateDailyDay();
    });

    dailyOpacitySlider.addEventListener('input', e => {
        const val = parseInt(e.target.value);
        simState.plumeOpacity = val / 100;
        document.getElementById('daily-opacity-value').textContent = `${val}%`;
        document.getElementById('plume-opacity-slider').value = val;
        document.getElementById('plume-opacity-val').textContent = `${val}%`;
        updateDailyDay();
    });

    dailySmokeMethod.addEventListener('change', updateDailyDay);
    document.getElementById('daily-hysplit-time').addEventListener('change', updateDailyDay);
    dailySmokeToggle.addEventListener('change', () => {
        document.getElementById('layer-plume').checked = dailySmokeToggle.checked;
        updateDailyDay();
    });
    dailyHotspotsToggle.addEventListener('change', () => {
        firmsHotspotsToggle.checked = dailyHotspotsToggle.checked;
        if (dailyHotspotsToggle.checked) map.addLayer(layerGroups.dailyHotspots);
        else map.removeLayer(layerGroups.dailyHotspots);
    });
    firmsHotspotsToggle.addEventListener('change', e => {
        dailyHotspotsToggle.checked = e.target.checked;
    });
    document.getElementById('layer-plume').addEventListener('change', e => {
        dailySmokeToggle.checked = e.target.checked;
    });

    // Simulasi On-the-Fly Sliders
    function getCompassLabel(deg) {
        const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
        return dirs[Math.round(deg / 45) % 8];
    }

    function getWindDescription(directionDeg) {
        const toward = ((directionDeg % 360) + 360) % 360;
        const from = (toward + 180) % 360;
        return `Angin dari ${getCompassLabel(from)} · asap menuju ${getCompassLabel(toward)}`;
    }

    document.getElementById('sim-wind-dir').addEventListener('input', (e) => {
        simState.windDir = parseInt(e.target.value);
        document.getElementById('wind-dir-display').textContent = `${simState.windDir}° · ${getWindDescription(simState.windDir)}`;
        document.getElementById('wind-direction-description').textContent =
            `${getWindDescription(simState.windDir)}. Panah menunjukkan arah gerak asap.`;
        if (isDailyMode) updateDailyDay();
        else renderAllLayers();
    });

    document.getElementById('sim-wind-speed').addEventListener('input', (e) => {
        simState.windSpeed = parseFloat(e.target.value);
        document.getElementById('wind-speed-display').textContent = `${simState.windSpeed.toFixed(1)} m/s`;
        if (isDailyMode) updateDailyDay();
        else renderAllLayers();
    });

    document.getElementById('sim-frp-mult').addEventListener('input', (e) => {
        simState.frpMult = parseFloat(e.target.value);
        document.getElementById('frp-mult-display').textContent = `${simState.frpMult.toFixed(1)}x`;
        if (isDailyMode) updateDailyDay();
        else renderAllLayers();
    });

    // Tambah Titik Api via Klik Peta
    map.on('click', (e) => {
        const addMode = document.getElementById('add-fire-mode').checked;
        if (!addMode || isDailyMode) return;

        const newId = `HS-SIM-${hotspots.length + 1}`;
        hotspots.push({
            id: newId,
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            frp: 60.0,
            conf: 'Simulasi',
            land: 'Titik Sumber Hipotetis Pengguna'
        });
        renderAllLayers();
        showToast(`Titik api ${newId} ditambahkan & plume dihitung ulang!`);
    });

    // Reset Simulasi
    document.getElementById('reset-sim-btn').addEventListener('click', () => {
        hotspots = JSON.parse(JSON.stringify(initialHotspots));
        simState.windDir = 315;
        simState.windSpeed = 6.5;
        simState.frpMult = 1.0;

        document.getElementById('sim-wind-dir').value = 315;
        document.getElementById('wind-dir-display').textContent = `315° · ${getWindDescription(315)}`;
        document.getElementById('wind-direction-description').textContent =
            `${getWindDescription(315)}. Panah menunjukkan arah gerak asap.`;
        document.getElementById('sim-wind-speed').value = 6.5;
        document.getElementById('wind-speed-display').textContent = '6.5 m/s';
        document.getElementById('sim-frp-mult').value = 1.0;
        document.getElementById('frp-mult-display').textContent = '1.0x (Normal)';
        document.getElementById('add-fire-mode').checked = false;

        if (isDailyMode) updateDailyDay();
        else renderAllLayers();
        showToast('Parameter simulasi dikembalikan ke kondisi awal.');
    });

    function focusFeatures(features, bounds, label, districtCode) {
        layerGroups.regionFocus.clearLayers();
        districtLabelsByCode.forEach((tooltip, code) => {
            const feature = districtFeaturesByCode.get(code);
            tooltip.setContent(feature.properties.WADMKC);
        });
        const selected = L.geoJSON({ type: 'FeatureCollection', features }, {
            pane: 'focusHaloPane',
            interactive: false,
            style: { color: '#291e25', weight: 8, opacity: 0.95, fillOpacity: 0 }
        });
        layerGroups.regionFocus.addLayer(selected);
        layerGroups.regionFocus.addLayer(L.geoJSON({ type: 'FeatureCollection', features }, {
            pane: 'focusPane',
            interactive: false,
            style: { color: '#f6b469', weight: 4, opacity: 1, fillColor: '#f6b469', fillOpacity: 0.08 }
        }));

        if (districtCode) {
            const feature = districtFeaturesByCode.get(districtCode);
            const tooltip = districtLabelsByCode.get(districtCode);
            if (districtLayerCheckbox.checked && tooltip) {
                tooltip.setContent(label);
            } else {
                addAdminLabel(layerGroups.regionFocus, feature.properties.label_point, label, 'admin-focus-label');
            }
        } else if (!parentLayerCheckbox.checked) {
            const feature = features[0];
            addAdminLabel(layerGroups.regionFocus, feature.properties.label_point, label.toUpperCase(), 'admin-focus-label');
        }

        map.fitBounds(bounds, { padding: [40, 40], maxZoom: districtCode ? 13 : 11 });
    }

    regionFilter.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'all_download') {
            layerGroups.regionFocus.clearLayers();
            const visibleRecords = dailyRecords.filter(recordMatchesCurrentRegion);
            fitAllHotspotBounds(visibleRecords);
            updateDistrictLayerVisibility();
            return;
        }
        if (value === 'all') {
            layerGroups.regionFocus.clearLayers();
            if (aoiBounds) map.fitBounds(aoiBounds, { padding: [36, 36], maxZoom: 11 });
            updateDistrictLayerVisibility();
            return;
        }
        if (value === 'kota_sorong' || value === 'kabupaten_sorong') {
            const code = value === 'kota_sorong' ? '96.71' : '96.01';
            const feature = parentFeaturesByCode.get(code);
            const bounds = parentBoundsByCode.get(code);
            if (feature && bounds) focusFeatures(
                [feature],
                bounds,
                feature.properties.display_name,
                null
            );
            return;
        }
        if (value.indexOf('district:') === 0) {
            const code = value.slice('district:'.length);
            const feature = districtFeaturesByCode.get(code);
            const bounds = districtBoundsByCode.get(code);
            if (!feature || !bounds) {
                setAdminStatus(districtStatus, 'Batas distrik untuk pilihan ini belum tersedia.', true);
                return;
            }
            const parentName = feature.properties.KDPKAB === '96.71' ? 'Kota Sorong' : 'Kabupaten Sorong';
            focusFeatures([feature], bounds, `Distrik ${feature.properties.WADMKC} · ${parentName}`, code);
            updateDistrictLayerVisibility();
        }
    });

    regionFilter.addEventListener('change', () => {
        if (isDailyMode) updateDailyDay();
        else {
            renderAllPeriodHotspots();
            if (firmsHotspotsToggle.checked) map.addLayer(layerGroups.firmsHotspots);
            updateOsmFacilityLayers();
        }
    });

    appModeSelect.addEventListener('change', () => setDailyMode(appModeSelect.value === 'daily'));
    hotspotTimeFilter.addEventListener('change', () => {
        const daily = hotspotTimeFilter.value === 'daily';
        appModeSelect.value = daily ? 'daily' : 'manual';
        if (daily) setDailyMode(true);
        else {
            stopDailyPlayback();
            setDailyMode(false);
            const visibleRecords = renderAllPeriodHotspots();
            if (firmsHotspotsToggle.checked) map.addLayer(layerGroups.firmsHotspots);
            fitAllHotspotBounds(visibleRecords);
        }
    });
    document.getElementById('show-all-hotspots-btn').addEventListener('click', () => {
        stopDailyPlayback();
        regionFilter.value = 'all_download';
        appModeSelect.value = 'manual';
        setDailyMode(false);
        hotspotTimeFilter.value = 'all';
        layerGroups.regionFocus.clearLayers();
        const visibleRecords = renderAllPeriodHotspots();
        if (firmsHotspotsToggle.checked) map.addLayer(layerGroups.firmsHotspots);
        fitAllHotspotBounds(visibleRecords);
        updateDistrictLayerVisibility();
    });
    document.getElementById('daily-prev-btn').addEventListener('click', () => {
        stopDailyPlayback();
        setDailyIndex(dailyCurrentIndex - 1);
    });
    document.getElementById('daily-next-btn').addEventListener('click', () => {
        stopDailyPlayback();
        setDailyIndex(dailyCurrentIndex + 1);
    });
    dailyPlayButton.addEventListener('click', startDailyPlayback);
    dailyDateSlider.addEventListener('input', e => {
        stopDailyPlayback();
        setDailyIndex(e.target.value);
    });
    dailyDatePicker.addEventListener('change', e => {
        stopDailyPlayback();
        const index = dailyDateIndex(e.target.value);
        if (index >= 0) setDailyIndex(index);
        else e.target.value = dailyDates[dailyCurrentIndex];
    });
    document.getElementById('daily-import-btn').addEventListener('click', () => {
        document.getElementById('daily-import-file').click();
    });
    document.getElementById('daily-import-file').addEventListener('change', async e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const status = document.getElementById('daily-import-status');
        status.textContent = `Memeriksa ${file.name}…`;
        try {
            const text = await file.text();
            let digest = null;
            if (window.crypto && window.crypto.subtle && window.TextEncoder) {
                const bytes = new TextEncoder().encode(text);
                const hash = await window.crypto.subtle.digest('SHA-256', bytes);
                digest = Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
            }
            if (digest && importedFileHashes.has(digest)) {
                status.textContent = `${file.name} sudah pernah diimpor; tidak ada rekaman yang ditambahkan.`;
                return;
            }
            const result = importFirmsCsv(text, file.name);
            if (digest) importedFileHashes.add(digest);
            dailySourceLabel = `${dailySourceLabel}; CSV ${file.name}`;
            document.getElementById('daily-auto-source-status').textContent =
                `${dailyRecords.length.toLocaleString('id-ID')} deteksi valid dalam periode disimpan, termasuk di luar AOI Sorong.`;
            status.textContent = `${result.accepted.toLocaleString('id-ID')} rekaman baru; ${result.duplicates.toLocaleString('id-ID')} duplikat; ${result.outsideAoi.toLocaleString('id-ID')} di luar AOI (tetap disimpan); ${result.outOfPeriod.toLocaleString('id-ID')} di luar periode; ${result.invalid.toLocaleString('id-ID')} baris tidak valid.`;
            renderAllPeriodHotspots();
            if (!isDailyMode && firmsHotspotsToggle.checked) map.addLayer(layerGroups.firmsHotspots);
            updateDailyDay();
        } catch (error) {
            status.textContent = `Impor gagal: ${error.message}`;
            showToast(`Impor CSV gagal: ${error.message}`);
        } finally {
            e.target.value = '';
        }
    });
    document.getElementById('daily-export-btn').addEventListener('click', () => {
        const dateText = dailyDates[dailyCurrentIndex];
        const features = recordsForDate(dateText).filter(recordMatchesCurrentRegion).map(record => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [record.lng, record.lat] },
            properties: {
                tanggal_wit: record.witDate,
                tanggal_akuisisi_utc: record.acqDateUtc,
                waktu_akuisisi_utc_hhmm: record.acqTimeUtc,
                wilayah_kode_big: record.parentCode,
                wilayah: parentRegionName(record.parentCode),
                distrik_kode_big: record.districtCode,
                satellite: record.satellite || null,
                instrument: record.instrument || null,
                version: record.version || null,
                brightness: record.brightness,
                bright_t31: record.brightT31,
                scan: record.scan,
                track: record.track,
                daynight: record.daynight || null,
                frp: record.frp,
                satuan_frp: 'tidak tercatat di metadata lokal',
                confidence: record.confidence || null,
                sumber: record.sourceLabel
            }
        }));
        if (!features.length) return;
        const collection = {
            type: 'FeatureCollection',
            name: `Hotspot FIRMS ${dateText} WIT`,
            features
        };
        const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const region = regionFilter.value.replace(/[^a-z0-9-]+/gi, '_');
        anchor.href = url;
        anchor.download = `hotspot_firms_${dateText}_${region}.geojson`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    });

    document.getElementById('focus-aoi-btn').addEventListener('click', () => {
        if (!aoiBounds) {
            setAdminStatus(parentStatus, 'Batas administrasi belum tersedia.', true);
            return;
        }
        regionFilter.value = 'all';
        layerGroups.regionFocus.clearLayers();
        updateDistrictLayerVisibility();
        map.fitBounds(aoiBounds, { padding: [36, 36], maxZoom: 11 });
        if (isDailyMode) updateDailyDay();
        else renderAllPeriodHotspots();
    });

    // Time-Slider & Play Animation
    const timeScenarios = window.dataSkenario.timeScenarios;

    const timeSlider = document.getElementById('time-slider');
    timeSlider.max = timeScenarios.length - 1;
    timeSlider.value = Math.min(3, timeScenarios.length - 1);
    function stopManualPlayback() {
        if (manualAnimationTimer !== null) {
            clearInterval(manualAnimationTimer);
            manualAnimationTimer = null;
        }
        document.getElementById('play-icon').className = 'fas fa-play text-xs ml-0.5';
    }

    function applyTimeStep(idx, progress) {
        const sc = timeScenarios[idx];
        manualPlumeProgress = progress == null ? 1 : progress;
        document.getElementById('time-label').textContent = sc.label;
        simState.windDir = sc.dir;
        simState.windSpeed = sc.speed;
        simState.frpMult = sc.frp;

        document.getElementById('sim-wind-dir').value = sc.dir;
        document.getElementById('wind-dir-display').textContent = `${sc.dir}° · ${getWindDescription(sc.dir)}`;
        document.getElementById('wind-direction-description').textContent =
            `${getWindDescription(sc.dir)}. Panah menunjukkan arah gerak asap.`;
        document.getElementById('sim-wind-speed').value = sc.speed;
        document.getElementById('wind-speed-display').textContent = `${sc.speed.toFixed(1)} m/s`;
        document.getElementById('sim-frp-mult').value = sc.frp;
        document.getElementById('frp-mult-display').textContent = `${sc.frp.toFixed(1)}x`;

        renderAllLayers();
    }

    timeSlider.addEventListener('input', (e) => {
        stopManualPlayback();
        applyTimeStep(parseInt(e.target.value), 1);
    });

    document.getElementById('play-time-btn').addEventListener('click', () => {
        if (isDailyMode) return;
        const icon = document.getElementById('play-icon');
        if (manualAnimationTimer !== null) {
            stopManualPlayback();
        } else {
            if (manualPlumeProgress >= 1) {
                manualPlumeProgress = 0;
                manualSmokeOverlay = renderAnimatedSmokeFrame(
                    layerGroups.plume, hotspots, manualPlumeProgress, 'overlayPane', manualSmokeOverlay
                );
            }
            manualAnimationStart = performance.now() - manualPlumeProgress * manualScenarioDuration;
            icon.className = 'fas fa-pause text-xs';
            manualAnimationTimer = setInterval(() => {
                manualPlumeProgress = Math.min(1,
                    (performance.now() - manualAnimationStart) / manualScenarioDuration);
                manualSmokeOverlay = renderAnimatedSmokeFrame(
                    layerGroups.plume, hotspots, manualPlumeProgress, 'overlayPane', manualSmokeOverlay
                );
                if (manualPlumeProgress >= 1) {
                    const next = (parseInt(timeSlider.value) + 1) % timeScenarios.length;
                    timeSlider.value = next;
                    manualAnimationStart = performance.now();
                    applyTimeStep(next, 0);
                }
            }, 120);
        }
    });

    // Export geometri poligon ilustratif ke GeoJSON.
    document.getElementById('export-geojson-btn').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentPlumeGeoJSON, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `skenario_ilustratif_sorong_${Date.now()}.geojson`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('File GeoJSON poligon skenario ilustratif berhasil diunduh.');
    });

    // Modal Metodologi & Ketidakpastian
    const modal = document.getElementById('methodology-modal');
    document.getElementById('open-methodology-btn').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('close-methodology-btn').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('close-methodology-btn-2').addEventListener('click', () => modal.classList.add('hidden'));

    // Render Pertama Kali
    applyTimeStep(Number(timeSlider.value));
});
