# Sumber fasilitas dan permukiman

## Dataset yang digunakan

- Penyedia unduhan: [Geofabrik — Papua](https://download.geofabrik.de/asia/indonesia/papua/index.html).
- Berkas yang diunduh pada 24 November 2026: [papua-latest-free.gpkg.zip](https://download.geofabrik.de/asia/indonesia/papua/papua-latest-free.gpkg.zip).
- Sumber data: OpenStreetMap (OSM); README dalam arsip menyatakan snapshot data `2026-11-23T21:21:17Z`.
- Lisensi dan atribusi: Open Database License (ODbL) 1.0, sebagaimana dicantumkan README Geofabrik. Atribusi: © OpenStreetMap contributors. Lihat [hak cipta dan lisensi OSM](https://www.openstreetmap.org/copyright) dan [ketentuan Geofabrik](https://www.geofabrik.de/data/vector-data.html).
- GeoPackage ber-CRS `WGS 84 (CRS84)` dan dibaca dari layer `gis_osm_pois_free`, `gis_osm_pois_a_free`, `gis_osm_transport_free`, `gis_osm_transport_a_free`, `gis_osm_places_free`, dan `gis_osm_places_a_free`. Layer `_free` menyimpan fitur titik; layer `_a_free` menyimpan geometri area.
- Keluaran lokal: `web/data/fasilitas-sorong.geojson`, geometri GeoJSON longitude-latitude dalam WGS 84. Setiap fitur mempertahankan nama/kategori, kode wilayah BIG, ID OSM sumber, tanggal snapshot, dan atribusi.

## Pemilihan AOI, kategori, dan duplikasi

Geometri titik dipilih jika berada di dalam atau pada batas poligon Kota Sorong (`96.71`) atau Kabupaten Sorong (`96.01`). Geometri area dipilih jika beririsan dengan gabungan dua poligon; bagian di luar AOI dipotong mengikuti batas administrasi. Atribut induk dan distrik diberikan berdasarkan irisan terbesar dengan geometri BIG. Sorong Selatan tidak termasuk.

Kategori OSM yang dimasukkan:

- **Pendidikan**: `school`, `college`, `university`, dan `kindergarten` pada layer POI titik maupun area. Dalam ekstrak terpilih terdapat fitur school, college, dan university.
- **Kesehatan**: `hospital`, `clinic`, `doctors`, `dentist`, dan `pharmacy` pada layer POI titik maupun area. Apotek ikut dihitung sebagai fasilitas kesehatan OSM.
- **Bandara**: `airport` pada layer transport. `helipad` tidak dihitung sebagai bandara.
- **Pelabuhan**: `ferry_terminal`, `port`, dan `harbour` pada layer transport/POI; fitur yang ditemukan dalam AOI berkelas `ferry_terminal`.
- **Permukiman**: `city`, `town`, `suburb`, `village`, `hamlet`, dan `locality` pada layer places titik maupun area.

Fitur dalam kategori sama dengan nama yang dinormalisasi sama dan berjarak sampai 100 meter digabung sebagai satu lokasi; geometri area dipertahankan/digabung, dan seluruh ID OSM asal dicatat. Ini menggabungkan komponen bangunan atau penanda titik/area untuk satu fasilitas, misalnya beberapa geometri Puskesmas Remu. Fitur tanpa nama hanya digabung jika ID OSM-nya sama. Aturan kedekatan dapat menggabungkan lokasi berbeda yang bernama sama dan sangat berdekatan; tinjau manual bila diperlukan untuk inventaris operasional.

## Jumlah hasil

| Kategori | Kota Sorong | Kabupaten Sorong | Total GeoJSON |
|---|---:|---:|---:|
| Pendidikan | 44 | 28 | 72 |
| Kesehatan | 71 | 0 | 71 |
| Bandara | 1 | 0 | 1 |
| Pelabuhan | 8 | 0 | 8 |
| Permukiman | 18 | 106 | 124 |
| **Total** | **142** | **134** | **276** |

Jumlah pendidikan, kesehatan, bandara, dan pelabuhan dibandingkan dengan angka presentasi kelompok yang diberikan (147, 44, 11, dan 11) berbeda masing-masing -75, +27, -10, dan -3. Permukiman OSM berjumlah 124, berbeda -354 dari angka pembanding 478. Angka tersebut tidak sebanding langsung: OSM memakai objek yang dipetakan komunitas, tanggal snapshot dan tag di atas; kategori kesehatan mencakup apotek, permukiman dibatasi pada objek `place`, dan cakupan/pengertian kategori pada presentasi tidak disertai data koordinat untuk pencocokan. Tidak ada fasilitas atau koordinat yang ditambahkan untuk mengejar jumlah presentasi.

## Pemeriksaan sumber resmi dan keterbatasan

Referensi Kemendikdasmen, platform SATUSEHAT/Kemenkes, dan portal informasi Kemenhub diperiksa sebagai kemungkinan data pembanding berkoordinat. Saat pemeriksaan, layanan Kemendikdasmen yang dicoba tidak dapat diakses melalui host, SATUSEHAT mengarah ke platform integrasi/login alih-alih unduhan spasial publik, dan portal Kemenhub yang diperiksa tidak menyediakan layer koordinat siap pakai. Karena itu hasil WebGIS ini memakai OSM/Geofabrik, bukan dinyatakan sebagai inventaris resmi atau lengkap.

Untuk menyamakan atau mengesahkan angka pada presentasi kelompok, masih diperlukan berkas sumber kelompok yang memiliki koordinat (CSV/GeoJSON/GeoPackage/Shapefile) untuk sekolah, kesehatan, bandara, pelabuhan, dan permukiman, beserta tanggal, definisi kategori, serta sumber/lisensinya. Data tanpa koordinat tidak dapat ditempatkan atau diverifikasi terhadap poligon Sorong.
