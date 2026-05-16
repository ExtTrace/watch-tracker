# Anime Netflix Tracker

Anime Netflix Tracker is a Manifest V3 Chrome extension for tracking anime or series watched on Netflix directly from the browser. All data is stored locally in `chrome.storage.local`, with no backend, no login, and no access to the official Netflix API.

Language:

- [English](./README.en.md)
- [Bahasa Indonesia](./README.id.md)

## Stack

- Chrome Extension Manifest V3
- TypeScript
- Vite
- Vanilla DOM API
- pnpm

## Running the Project

1. `pnpm install`
2. `pnpm build`
3. Open `chrome://extensions`
4. Enable `Developer Mode`
5. Click `Load unpacked`
6. Select the `dist` folder

## Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm preview`

## MVP Features

- Runs only on the `netflix.com` domain
- Detects Netflix player pages with `/watch/` URLs
- Extracts `title`, `season`, `episode`, `episodeTitle`, `url`, `lastWatchedAt`, and `source`
- Stores watch history in `chrome.storage.local`
- Updates existing items without creating duplicates
- Popup to show the most recent watch history
- Sorts items by the latest `lastWatchedAt`
- Includes `Open Netflix`, `Clear History`, and `Export JSON` buttons

## Storage Shape

```json
{
  "items": [
    {
      "id": "netflix-frieren",
      "title": "Frieren",
      "season": "Season 1",
      "episode": "Episode 8",
      "episodeTitle": "Frieren the Slayer",
      "url": "https://www.netflix.com/watch/...",
      "lastWatchedAt": "2026-05-16T10:00:00.000Z",
      "source": "netflix"
    }
  ]
}
```

## Limitations

- Works only when watching Netflix in a browser
- Does not work in mobile or TV apps
- Netflix selectors may change over time
- If someone else watches Netflix in the same browser, their history can also be recorded
- Does not use official account data from Netflix or the Netflix API
