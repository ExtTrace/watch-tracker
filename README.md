# Anime Netflix Tracker

Anime Netflix Tracker adalah Chrome Extension Manifest V3 untuk mencatat anime atau series yang ditonton di Netflix langsung dari browser. Semua data disimpan lokal di `chrome.storage.local`, tanpa backend, tanpa login, dan tanpa akses ke API resmi Netflix.

## Stack

- Chrome Extension Manifest V3
- TypeScript
- Vite
- Vanilla DOM API
- pnpm

## Menjalankan Project

1. `pnpm install`
2. `pnpm build`
3. Buka `chrome://extensions`
4. Aktifkan `Developer Mode`
5. Klik `Load unpacked`
6. Pilih folder `dist`

## Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm preview`

## Fitur MVP

- Hanya aktif di domain `netflix.com`
- Mendeteksi halaman player Netflix dengan URL `/watch/`
- Mengambil `title`, `season`, `episode`, `url`, `lastWatchedAt`, dan `source`
- Menyimpan watch history ke `chrome.storage.local`
- Update item existing tanpa membuat duplikasi
- Popup untuk melihat riwayat terbaru
- Urutan data berdasarkan `lastWatchedAt` terbaru
- Tombol `Open Netflix`, `Clear History`, dan `Export JSON`

## Struktur Data

```json
{
  "items": [
    {
      "id": "netflix-frieren",
      "title": "Frieren",
      "season": "Season 1",
      "episode": "Episode 8",
      "url": "https://www.netflix.com/watch/...",
      "lastWatchedAt": "2026-05-16T10:00:00.000Z",
      "source": "netflix"
    }
  ]
}
```

## Batasan

- Hanya berjalan jika Netflix ditonton dari browser
- Tidak berjalan di aplikasi HP atau TV
- Selector Netflix bisa berubah sewaktu-waktu
- Jika orang lain menonton di browser yang sama, history tetap bisa tercatat
- Tidak mengambil data resmi dari akun Netflix atau API Netflix
