# Anime Watch Tracker

Anime Watch Tracker adalah Chrome Extension Manifest V3 untuk mencatat riwayat tontonan anime dari:

- Netflix pada halaman `netflix.com/watch`
- YouTube pada halaman `youtube.com/watch` untuk channel yang diizinkan
- Domain anime custom yang ditambahkan dari popup

Semua data disimpan lokal di `chrome.storage.local`. Extension ini tidak memakai backend dan tidak menggunakan API resmi Netflix atau YouTube.

## Fitur

- Mencatat anime yang sedang ditonton di Netflix
- Mencatat video anime di YouTube berdasarkan whitelist channel yang bisa diubah dari popup
- Mencatat halaman anime dari domain custom yang bisa diubah dari popup
- Filter history per platform: `All`, `Netflix`, `YouTube`, `Custom`
- Import JSON dan export JSON
- Hapus satu item atau clear seluruh history
- Menampilkan `publishedAt` jika tersedia
- Menampilkan status episode Netflix berikutnya jika terdeteksi:
  - `Next episode: ...`
  - `New episode available`
- Tab popup terpisah untuk:
  - `History`
  - `YouTube Channels`
  - `Anime Domains`

## Stack

- Chrome Extension Manifest V3
- TypeScript
- Vite
- Vanilla DOM API
- pnpm

## Install Dependency

```bash
pnpm install
```

## Build

```bash
pnpm build
```

Output build akan dibuat di folder `dist`.

## Load Unpacked ke Chrome

1. Jalankan `pnpm build`
2. Buka `chrome://extensions`
3. Aktifkan `Developer mode`
4. Klik `Load unpacked`
5. Pilih folder `dist`

## Development

```bash
pnpm dev
```

## Cara Pakai

1. Load extension hasil build ke Chrome
2. Buka Netflix, YouTube, atau situs anime custom
3. Putar episode / video sampai metadata termuat
4. Buka popup extension
5. Cek tab `History` untuk melihat item yang tersimpan
6. Cek tab `YouTube Channels` untuk mengatur whitelist channel YouTube
7. Cek tab `Anime Domains` untuk mengatur domain anime custom

## YouTube Channels

Tracking YouTube sekarang tidak hardcoded ke satu channel.

Behavior:
- video hanya disimpan jika channel cocok dengan salah satu channel `enabled`
- pencocokan case-insensitive
- pencocokan bisa berdasarkan `name`
- pencocokan bisa berdasarkan `handle` jika tersedia

Default seed:
- `Muse Indonesia`
- `@MuseIndonesia`

Di popup tab `YouTube Channels`, user bisa:
- add channel
- edit channel
- delete channel
- enable / disable channel

Perubahan channel langsung berlaku karena data dibaca dari `chrome.storage.local`.

## Anime Domains

Netflix dan YouTube tetap platform fixed.

Untuk situs anime custom, domain dikelola dinamis dari popup.

Behavior:
- domain dicocokkan case-insensitive
- input domain dinormalisasi dengan menghapus `https://`, `http://`, `www.`, dan trailing slash
- halaman cocok jika hostname saat ini mengandung `animeDomain.hostname`
- domain hanya dipakai jika `enabled`

Default seed:
- `Otakudesu`
- keyword hostname: `otakudesu`

Di popup tab `Anime Domains`, user bisa:
- add domain
- edit domain
- delete domain
- enable / disable domain

Saat menambah domain:
1. isi `name`, misalnya `Otakudesu`
2. isi `current domain`, misalnya `otakudesu.blog`
3. isi `match keyword`, misalnya `otakudesu`
4. extension meminta permission host
5. jika permission ditolak, domain tidak akan disimpan

Contoh menambahkan Otakudesu:
1. buka popup
2. pindah ke tab `Anime Domains`
3. klik `Add Domain`
4. isi `name`: `Otakudesu`
5. isi `current domain`: `otakudesu.blog`
6. isi `match keyword`: `otakudesu`
7. grant permission

Jika domain Otakudesu berubah, edit `current domain` lalu grant permission lagi.

## Cara Test Netflix

1. Load extension hasil build ke Chrome
2. Buka `https://www.netflix.com/watch/...`
3. Putar episode anime atau series
4. Tunggu halaman player dan metadata termuat
5. Buka popup extension
6. Pastikan item Netflix muncul dengan field seperti `title`, `season`, `episode`, `episodeTitle`, `lastWatchedAt`
7. Jika tersedia, cek juga:
   - `publishedAt`
   - `nextEpisode`
   - `nextEpisodeAvailableAt`
   - `hasNewEpisode`

Catatan:
- `publishedAt` episode Netflix bergantung pada data yang benar-benar diexpose Netflix
- untuk beberapa judul, status episode berikutnya lebih mungkin tersedia daripada tanggal rilis episode yang sedang diputar

## Cara Test YouTube

1. Load extension hasil build ke Chrome
2. Buka tab `YouTube Channels` di popup
3. Pastikan channel target ada dan `enabled`
4. Buka video `https://www.youtube.com/watch?v=...`
5. Putar video sampai metadata dan player termuat
6. Buka popup extension
7. Pastikan item YouTube muncul dengan field seperti `title`, `episode`, `channel`, `duration`, `thumbnail`, dan `lastWatchedAt`

Jika channel YouTube tidak cocok dengan whitelist, item tidak akan disimpan.

## Cara Test Domain Custom

1. Load extension hasil build ke Chrome
2. Buka tab `Anime Domains` di popup
3. Tambahkan domain anime dan grant permission
4. Buka halaman anime di domain tersebut
5. Tunggu halaman termuat
6. Buka popup extension
7. Pastikan item `Custom` muncul di tab `History`

Extractor generic mencoba mengambil:
- `title`
- `thumbnail`
- `publishedAt`
- canonical URL

## Storage Shape

```json
{
  "items": [
    {
      "id": "netflix-frieren-beyond-journeys-end",
      "platform": "netflix",
      "title": "Frieren: Beyond Journey's End",
      "season": "Season 1",
      "episode": "Episode 7",
      "episodeTitle": "Like a Fairy Tale",
      "url": "https://www.netflix.com/title/81712700",
      "watchUrl": "https://www.netflix.com/watch/81712700",
      "publishedAt": null,
      "nextEpisode": "Episode 8",
      "nextEpisodeAvailableAt": "2026-05-18T00:00:00.000Z",
      "hasNewEpisode": false,
      "lastWatchedAt": "2026-05-17T10:00:00.000Z"
    },
    {
      "id": "youtube-abc123xyz",
      "platform": "youtube",
      "title": "Marriaagetoxin",
      "seriesKey": "youtube-series-marriaagetoxin",
      "url": "https://www.youtube.com/watch?v=abc123xyz",
      "creator": "Muse Indonesia",
      "channel": "Muse Indonesia",
      "episode": "Episode 02",
      "duration": "23:56",
      "thumbnail": "https://img.youtube.com/vi/abc123xyz/hqdefault.jpg",
      "publishedAt": "2026-05-17T00:00:00.000Z",
      "lastWatchedAt": "2026-05-17T10:05:00.000Z"
    },
    {
      "id": "anime-domain-otakudesu-blog-my-anime-title",
      "platform": "custom",
      "title": "My Anime Title",
      "url": "https://otakudesu.blog/anime/my-anime-title/",
      "thumbnail": "https://otakudesu.blog/image.jpg",
      "publishedAt": "2026-05-17T00:00:00.000Z",
      "siteName": "Otakudesu",
      "hostname": "otakudesu.blog",
      "lastWatchedAt": "2026-05-17T10:08:00.000Z"
    }
  ],
  "youtubeChannels": [
    {
      "id": "youtube-channel-muse-indonesia",
      "name": "Muse Indonesia",
      "handle": "@MuseIndonesia",
      "enabled": true,
      "createdAt": "2026-05-17T00:00:00.000Z"
    }
  ],
  "animeDomains": [
    {
      "id": "otakudesu",
      "name": "Otakudesu",
      "hostname": "otakudesu",
      "grantedOrigin": "https://*.otakudesu.blog/*",
      "enabled": true,
      "createdAt": "2026-05-17T00:00:00.000Z"
    }
  ]
}
```

Catatan:
- Secara implementasi, `items`, `youtubeChannels`, dan `animeDomains` disimpan dalam key `chrome.storage.local` yang terpisah
- contoh di atas hanya menunjukkan shape data secara konseptual

## Batasan

- Hanya untuk browser Chrome
- Tidak berjalan di aplikasi HP atau TV
- Selector Netflix dan YouTube bisa berubah sewaktu-waktu
- Jika browser dipakai orang lain, aktivitas mereka juga bisa tercatat
- Tidak menggunakan API resmi Netflix atau YouTube
