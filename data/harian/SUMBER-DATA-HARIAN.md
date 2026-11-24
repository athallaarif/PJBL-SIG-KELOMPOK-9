# Inventaris data Perkembangan Harian

Pemeriksaan mencakup `web/data/`, `web/data/impor/` dan subfolder yang tersedia. Berkas asli tidak diubah. Tidak ada baris yang ditafsirkan sebagai tanggal, zona waktu, cakupan, atau satuan hanya dari nama berkas.

## Data yang dipakai otomatis

### Hotspot VIIRS/FIRMS

- Sumber lokal yang dipakai otomatis: `web/data/harian/hotspots-firms.csv`, disalin dari `Data/01_Titik Panas/DL_FIRE_J1V-C2_841084/fire_nrt_J1V-C2_841084.csv`. Format produk pada nama file adalah VIIRS 375 m NRT (`J1V-C2`); file sumber tidak menyertakan URL unduhan atau tanggal unduh.
- Referensi produk: [NASA FIRMS VIIRS 375 m](https://www.earthdata.nasa.gov/data/tools/firms) dan [FIRMS data download](https://firms.modaps.eosdis.nasa.gov/download/). URL permintaan spesifik yang menghasilkan file lokal tidak tersedia, sehingga provenance unduhan historis dan persyaratan redistribusi spesifik file ini belum dapat dipastikan dari metadata lokal.
- CSV berisi 2.102 baris data; seluruh baris lolos pemeriksaan format koordinat/tanggal. Aplikasi menggabungkan `acq_date` dan `acq_time` sebagai UTC, menormalkan HHMM, lalu mengonversinya ke WIT (Asia/Jayapura, UTC+9). Sebanyak 2.096 deteksi berada pada periode WIT 21 September–15 Oktober 2026; 6 di luar periode tidak ditampilkan. Pada 9 Oktober WIT terdapat 497 deteksi di seluruh area unduhan.
- Atribut CSV yang tersedia—`latitude`, `longitude`, `brightness`, `scan`, `track`, `acq_date`, `acq_time`, `satellite`, `instrument`, `confidence`, `version`, `bright_t31`, `frp`, dan `daynight`—dipertahankan pada rekaman aplikasi dan ekspor GeoJSON.
- Uji point-in-polygon terhadap dua geometri BIG menghasilkan 134 deteksi dalam AOI: 23 Kota Sorong (`96.71`) dan 111 Kabupaten Sorong (`96.01`); 1.962 deteksi periode berada di luar kedua poligon. Koordinat di luar AOI tetap tersimpan dan dapat ditampilkan melalui filter “Seluruh area unduhan FIRMS”.
- Dataset mendata observasi pada waktu berbeda, bukan kebakaran/asap serentak. Tanggal akuisisi dan confidence dipertahankan; confidence `n`/`l` tidak dikonversi menjadi probabilitas. Satuan FRP tidak dinyatakan di metadata CSV lokal.
- `hotspots-firms.geojson` (turunan lama dari `Titik_Panas_PBD_Wilayah.gpkg`, 14 titik AOI) masih ada sebagai arsip, tetapi bukan lagi sumber otomatis WebGIS.

### Angin harian ERA5

- Sumber: [Open-Meteo Historical Weather API](https://archive-api.open-meteo.com/v1/archive?latitude=-0.87&longitude=131.25&start_date=2026-09-21&end_date=2026-10-15&hourly=wind_speed_10m%2Cwind_direction_10m&models=era5&timezone=Asia%2FJayapura), model ERA5, variabel `wind_speed_10m` dan `wind_direction_10m`.
- Diakses pada 24 November 2026. Permintaan memakai koordinat Sorong `(-0.87, 131.25)`; API mengembalikan titik grid `(-1.0, 131.25)` pada resolusi ERA5 0,25° (sekitar 25 km), sehingga ini reanalisis regional, bukan pengukuran stasiun atau variasi angin lokal di tiap distrik.
- Satu sampel per tanggal diambil pukul 14:00 WIT agar waktu arah angin eksplisit. Kecepatan API dalam km/jam dikonversi ke m/s. Arah meteorologis `wind_direction_10m` adalah arah angin datang; nilainya ditambah 180° satu kali dan dinormalisasi menjadi `directionTowardDeg` (arah gerak asap).
- Lisensi/penggunaan: ketentuan Open-Meteo untuk API gratis menetapkan CC BY 4.0 dan penggunaan non-komersial; atribusi “Open-Meteo ERA5 reanalysis” ditampilkan pada panel arah angin harian. Lihat [ketentuan penggunaan](https://open-meteo.com/en/terms) dan [lisensi](https://open-meteo.com/en/licence).
- `wind.json` memuat 25 rekaman tanggal dengan waktu, bearing tujuan asap, kecepatan, dan sumber. Panah yang digambar seragam di peta adalah ilustrasi bearing representatif dari satu titik grid; jangan ditafsirkan sebagai medan angin beresolusi distrik.

### Batas administrasi

- `web/data/aoi-sorong.geojson`: dua fitur BIG yang dipilih dengan kode PUM `96.71` (Kota Sorong) dan `96.01` (Kabupaten Sorong), EPSG:4326.
- `web/data/distrik-sorong.geojson`: 39 geometri distrik BIG di kedua wilayah, masing-masing dicocokkan melalui `KDPKAB`; Klamono berkode `96.01.06`.
- Sumber layanan, edisi, pemilihan fitur, dan catatan lisensi dicatat di [`SUMBER-AOI.md`](../SUMBER-AOI.md). Data administratif ini dipakai untuk klasifikasi spasial dan tidak dipakai untuk mengarang cakupan hotspot.

## Inventaris berkas impor lain yang relevan

Folder impor diperiksa rekursif (1.213 berkas pada saat inventaris). Kelompok data yang teridentifikasi:

| Berkas/kelompok | Format dan atribut/metadata yang diketahui | Cakupan, waktu, satuan, dan kesiapan |
|---|---|---|
| `DATA/Titik Panas/Titik_Panas_PBD_Wilayah.gpkg` | GeoPackage, layer `titik_panas`, 234 fitur, EPSG:4326; atribut dicatat di atas. | Rekaman akuisisi 21–27 September 2026; waktu diperlakukan sebagai UTC. FRP tidak memiliki satuan yang tercatat. Siap untuk titik hotspot setelah dicocokkan ke AOI. |
| `DATA/Titik Panas/Titik_Panas_PBD_Wilayah.shp` beserta `.dbf` dan `.prj` | Shapefile dengan pasangan atribut/proyeksi; versi GeoPackage dipilih sebagai sumber otomatis. | Tidak digunakan untuk menghindari pemrosesan ganda. |
| `DATA/Titik Panas/Titik_Panas_PBD.shp`, `Titik_Panas_Sorong.shp` | Shapefile yang ditemukan tidak memiliki seluruh sidecar atribut yang diperlukan pada folder tersebut. | Tidak digunakan; tidak dapat diverifikasi sebagai set data lengkap. |
| `DATA/Titik Panas/TITIK_PANAS_PJBL.qgz` | Proyek QGIS 3.40.10. Referensinya menyebut `DL_FIRE_J1V-C2_841084/fire_nrt_J1V-C2_841084.csv`, `AOD.shp`, dan TIFF AOD di luar folder impor. | CSV FIRMS dan `AOD.shp` yang dirujuk tidak ditemukan bersama proyek. Sumber GPKG di atas yang digunakan aplikasi. |
| `HYSPLIT_win64U_v5.4.2/` | Instalasi dan contoh perangkat lunak HYSPLIT; bukan raster hasil konsentrasi untuk Sorong. | Tidak ada keluaran konsentrasi HYSPLIT harian untuk periode kajian yang siap ditampilkan. |
| `gdas1.oct26.w1`, `gdas1.oct26.w3` | Berkas meteorologi ARL untuk input HYSPLIT, bukan hasil konsentrasi; header menunjukkan grid global 1° (360 × 181). CRS dalam struktur ARL, tidak dinyatakan sebagai kode EPSG. | Tanggal/waktu lengkap, zona waktu, dan satuan variabel belum diverifikasi dari metadata yang tersedia. Tidak dipakai sebagai plume harian. |
| `WorldView/snapshot-2026-10-03.jpeg` | JPEG tanpa georeferensi; CRS dan cakupan geografis tidak tersedia. | Tanggal hanya terdapat pada nama file, bukan metadata yang diverifikasi; tidak dapat dipakai sebagai layer spasial. |

## Berkas terkait yang berada di luar `web/data/impor/`

| Berkas | Format dan metadata yang diketahui | Batasan dan penggunaan |
|---|---|---|
| `C:\Users\Muhammad Athalla\Downloads\AOD_Papua_2026_10_05.tif` | BigTIFF, 724 × 424 piksel, satu band Float64, EPSG:4326, band bernama `AOD_055`; cakupan geografis tidak dicatat dalam inventaris ini. | Tanggal akuisisi, satuan/normalisasi, NoData, serta provenance produk belum terverifikasi; tanggal hanya tertulis pada nama. Tidak dipakai sebagai AOD harian terverifikasi, konsentrasi HYSPLIT, atau PM2,5. |
| `web/data-skenario.js` | Sembilan lokasi fasilitas dalam data skenario, dengan nama/jenis/distrik dan koordinat. | Sumber, tanggal survei, CRS eksplisit, dan nilai pengukuran tidak tersedia. Lokasi hanya dapat ditampilkan sebagai data skenario; nilai paparan harian tidak dihitung. |
| `WorldPop_PBD_2026_100m_clip.tif` | TIFF satu band Float32, 4688 × 3097, EPSG:4326, NoData `-99999`; cakupan geografis tidak dicatat dalam inventaris ini. | Satuan dan tanggal akuisisi tidak tercantum; tidak dipakai sebagai statistik paparan harian. |

## Dukungan aplikasi dan status ketersediaan

- Pemutar memiliki 25 tanggal inklusif, 21 September–15 Oktober 2026, ditampilkan dalam WIT.
- Lapisan hotspot otomatis: 2.096 deteksi lokal pada periode WIT; 497 pada 9 Oktober. Cakupan pengamatan lintasan harian tidak diketahui, sehingga deteksi yang tidak tercatat tidak ditafsirkan sebagai nihil.
- Hasil raster HYSPLIT: 0/25 hari tersedia. Pilihan “Hasil HYSPLIT” menampilkan status belum tersedia dan tidak menggantinya dengan data ilustratif.
- Data angin harian untuk ilustrasi: 25/25 tanggal memiliki sampel ERA5 pukul 14:00 WIT. Aplikasi memakai bearing arah asap hasil konversi satu kali dari arah meteorologis; panah harian dan keterangan “angin dari · asap menuju” mengikuti rekaman tanggal aktif. Ini reanalisis regional 0,25°, bukan observasi stasiun lokal.
- Ilustrasi harian dan manual memakai fungsi renderer serta skala sumber yang sama. Ilustrasi harian hanya dirender bila hotspot dan angin untuk tanggal aktif tersedia; tanpa salah satunya, status menyebutkan data yang kurang dan hotspot tetap ditampilkan. Play menganimasikan plume selama 2,6 detik lalu menahan frame 0,8 detik sebelum pindah hari; Jeda membekukan gerakan dan kalender.
- Simulasi ilustratif: satu overlay gradasi bergeoreferensi dari kontribusi seluruh sumber hotspot pada hari/wilayah pilihan. Arah dan kecepatan angin serta pengali FRP mengatur bentuk; skala relatif tetap dan bukan satuan konsentrasi.
- Dukungan raster HYSPLIT: aplikasi membaca PNG hasil render dari `web/data/harian/hysplit/manifest.json`. Manifest versi 1 memakai `crs: "EPSG:4326"`, `palette: "sagu-bara-smoke-v1"`, skala bersama (`min`, `max`, `unit`), serta daftar raster berisi `date`, nama `file`, `bounds` `[selatan, barat, utara, timur]`, dan `nodataTransparent: true`. `interval` WIT opsional; jika ada lebih dari satu interval pada tanggal yang sama, pemilih waktu ditampilkan. Setiap PNG harus memakai palet/skala bersama dan mempertahankan NoData transparan. Raster asli tidak diputar atau diperlebar oleh aplikasi; image overlay memakai batas geografis yang disediakan. GeoTIFF mentah belum dibaca langsung oleh browser dan perlu diekspor ke PNG georeferensi dengan skala/palet bersama tersebut.
- Saat inventaris terakhir, belum ditemukan PNG hasil model HYSPLIT. Manifest kosong disediakan di `web/data/harian/hysplit/manifest.json`; tanggal tanpa entri menampilkan “Hasil model belum tersedia untuk tanggal ini” dan tidak memakai asap simulasi sebagai pengganti.
- CSV FIRMS tambahan dapat diimpor dari antarmuka. Wajib ada kolom `latitude`, `longitude`, `acq_date`, dan `acq_time`; `frp` dan `confidence` opsional. `acq_time` dibaca HHMM UTC, lalu dikonversi ke WIT. Klasifikasi ke poligon BIG dipakai untuk filter Sorong, bukan syarat menyimpan rekaman; duplikasi identik ditolak tanpa membuang pengamatan pada waktu berbeda.
