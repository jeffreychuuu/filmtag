# FilmTag

Interactive web app for writing EXIF metadata to film-scanned photos — all done in the browser.

**[filmtag.jeffreychuuu.com](https://filmtag.jeffreychuuu.com)**

> 🇭🇰 [中文版（Chinese README）](README.zh.md)

## Why FilmTag?

You just got your scans back from the lab. The colours are perfect. The grain is *chef's kiss*. You're hyped.

Then you open Google Photos and your entire roll shows up as one clump — all dated the day the lab scanned them. That moody street shot from three weeks ago? Sitting right next to your dinner photos from last Tuesday. Useless.

No camera. No lens. No date. Just vibes.

If you're the type who actually cares about keeping a clean digital archive of your analog work — you know exactly how maddening this is. You're spending real money on film, chemistry, and scanning, only to get back JPEGs with the metadata soul of a blank Word document.

So I built **filmtag** to fix this.

### What it does

Upload your scans, pick your gear and film stock, set the shooting date — and it batch-injects complete EXIF data into every file in seconds. No manual editing. No Lightroom workarounds. No spreadsheets.

### What gets written

**EXIF:** Camera make/model, lens, ISO, focal length, aperture, shutter, date/time, GPS, artist, copyright, description  
**XMP:** Creator, credit, date created, label, description

### Your Setup, Remembered

The default presets are built around Hong Kong 🇭🇰 — local labs like Megatoni, DOT-WELL, and TrueFare, plus my gear like the Leica MP and Olympus OM-2Sp. But everything is customisable. Type in any camera, lens, or lab you use, and **filmtag** saves it to your browser's local storage — so next time your gear shows up right in the dropdown.

One thing worth knowing: local storage is tied to your browser. Clear your data, switch browsers, or use a private window, and your saved presets won't carry over. It's a trade-off for keeping the tool completely serverless — **nothing you type or upload is ever sent to a server**. Your photos stay on your device, full stop.

### Highlight Features

| Feature | Description |
|---------|-------------|
| Camera & Lens | Built-in presets (Leica MP, Olympus OM-2Sp, etc.) plus full custom model, focal length, and max aperture support |
| Film Stock & ISO | 23 built-in film stocks (Kodak, Fujifilm, CineStill, Ilford, etc.) — selecting a film auto-fills ISO |
| Lab Records | Hong Kong lab presets: DOT-WELL, Megatoni, TrueFace Pro Lab, Photo Garden, HK Camera, Showa, Colorluxe — with Push/Pull and scanner model tracking |
| Time Sequencing (the best part) | Auto-increments +1 minute per photo, timezone forced to +08:00. Shot a roll across multiple days? Set up date segments with individual start times — Google Photos will order them perfectly |
| 🌐 i18n | English & Traditional Chinese (Hong Kong) — toggle via floating button, translations for all UI text |
| 🗺️ GPS Location | Built-in Leaflet + OpenStreetMap map. Select files, search or drop a pin — GPS coordinates written to EXIF. Reverse geocoding shows address next to each file |

The final result 👇

<table>
  <tr>
    <td align="center" width="25%"><b>Google Photos (Web)</b><br><img src="img/gphoto_web.png"></td>
    <td align="center" width="25%"><b>Google Photos (Mobile)</b><br><img src="img/gphoto_mobile.png"></td>
    <td align="center" width="25%"><b>iPhone Photos</b><br><img src="img/iphone.png"></td>
    <td align="center" width="25%"><b>Mac Photos</b><br><img src="img/mac.jpg"></td>
  </tr>
</table>

## Features

- Upload JPEG/TIFF/DNG/PNG photos via drag & drop
- Set camera, lens, film stock, ISO, lab, process, push/pull, scanner via dropdowns
- Multiple date segments with individual start times
- Review summary with file rename preview before processing
- Writes EXIF tags: Make, Model, Artist, ISO, LensModel, DateTime, FocalLength, FNumber, Aperture, Shutter, UserComment, ImageDescription, Copyright, Instructions
- Writes XMP: Label, Creator, Credit, DateCreated, dc:description
- Batch download as ZIP with standardized filenames (`FilmName_YYYYMMDDHHMM_XX.jpg`)
- iOS: Save to Album via share sheet
- File thumbnails with click-to-full-image preview
- Multi-select files + map-click to batch-assign GPS
- Location search via OpenStreetMap Nominatim geocoding
- Collapsible Origin & Disclaimer sections

## Tech

### Stack
- **piexifjs** — browser-side EXIF read/write
- **JSZip** — client-side ZIP packaging
- **esbuild** — bundler
- **Vercel** — deployment
- **Leaflet.js** — interactive map
- **OpenStreetMap + Nominatim** — map tiles & geocoding/reverse geocoding

### Project Structure

```
src/
  app.js            ← Entry (~249 lines): state init, event binding, module wiring
  i18n.js           ← English & Traditional Chinese translations
  lib/
    utils.js        ← Pure utility functions (toDms, injectXmp, esc, fmtSize…)
  modules/
    date.js         ← Date assignment, filename generation
    gear.js         ← Gear dropdowns, custom options, validation
    gps.js          ← Leaflet map, reverse geocoding, location
    process.js      ← ZIP/Save processing with EXIF injection
    ui.js           ← File list, summary, thumbnails, selection, ranges
    upload.js       ← File upload & EXIF extraction
  __tests__/        ← Vitest test suites (57 tests)
    lib/utils.test.js
    modules/{date,gear,ui}.test.js
public/
  index.html        ← App shell with all UI markup
data.json           ← Built-in presets (cameras, lenses, films, labs)
```

### Testing

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode for TDD
```

Tests use **Vitest** with **happy-dom**. Pure utility functions (utils.js) and state-dependent module logic (date, gear, ui) are covered. Run tests before committing to ensure nothing is broken.

## Local Dev

```bash
npm install
npm run build
npm run dev    # http://localhost:3333
```

## Deploy

Push to GitHub → import in Vercel → Root Directory = `.` (repo root). Vercel auto-runs `npm run build`, serves `dist/`.

## Release Workflow

### Versioning

This project follows semver. The source of truth is `package.json` → `version`. The version is injected at build time via esbuild `--define` and displayed in the app footer.

### Step-by-step

1. All development happens on the `dev` branch. Push to see Vercel preview.
2. When ready to ship:
   ```sh
   git checkout main
   git merge dev
   ```
3. Update `## What's New` in README — add a version heading above the entries being released.
4. Run the release script:
   ```sh
   npm run release
   ```
   This bumps the patch version in `package.json`, commits, and creates a git tag.
5. Push to trigger Vercel production deploy:
   ```sh
   git push origin main --tags
   ```
6. (Optional) Go to GitHub → Releases → create release from the new tag, paste the changelog entries.

### Version bump types

- `npm run release` → **patch** (1.1.1 → 1.1.2)
- `npm version minor` → **minor** (1.1.1 → 1.2.0)
- `npm version major` → **major** (1.1.1 → 2.0.0)

## Origin

FilmTag started as a CLI tool for myself and a few friends — I'm a film photography beginner who happens to write code for a living, and I just wanted an easy way to tag my scans with proper metadata. Before a trip, I worried that a lab might send scans back while I was away, so I turned it into a web app I could use from anywhere.

## Disclaimer

This tool is shared freely with the film photography community. Commercial use or profiteering is strictly prohibited. Unauthorised commercial use will be subject to legal action.

---

© 2026 Jeffrey Chu. All rights reserved.

## Shared Config

`data.json` defines all dropdown options (cameras, lenses, films, labs, processes, pushpulls, scanners). Edit this file to update options across all deployments.

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0**. You may freely use, modify, and share it for noncommercial purposes. Commercial use or profiteering is strictly prohibited. See the `LICENSE` file for details.

## What's New

<details>
<summary>Click to expand</summary>

**1.0.1 (2026-06-14)** — README rewrite, version injection, release workflow
- 📝 README rewrite with narrative pitch, HK presets, serverless note
- 🚀 In-app version display (footer), release workflow documented
- 📦 Changelog collapsed under details tag with version headings

**2026-06-12** — Fallback date from file modified time
- 🕐 When no EXIF date is found, falls back to the first file's `lastModified` timestamp, +1 minute per photo (instead of hardcoded today 12:00)
- 📍 GPS Save button now applies the map marker position to selected files; disabled when no marker is placed
- 🎨 Terminology: "Author" → "Artist", "file" → "photo" in all UI text

**2026-06-12** — Summary & gallery as modal overlays
- 📋 Review Summary is now a modal overlay with Close/Save/Download buttons
- 📸 Gallery overlay after processing — "Next Roll 🎞️" resets and scrolls to top with fade-out animation
- ⏳ Processing progress bar is now a modal overlay on top of the summary

**2026-06-12** — UI overhaul: date/GPS modals & action buttons
- 🎯 Select files → show two action buttons: "Set Date & Time" and "Set GPS Location"
- 📅 Date/time editing moved to a modal overlay with Save/Cancel
- 🗺️ GPS editing moved to modal overlay with map, search, Save/Cancel
- 🔲 Overlays only close via Save/Cancel — no accidental backdrop dismissals

**2026-06-12** — Background prefetch & sequenced loading
- ⚡ Thumbnail prefetch — after page 1 thumbnails load, pages 2+ are decoded in background (concurrency=2) so navigation is instant
- ⚡ Sequenced startup — EXIF extraction now runs before thumbnail generation, no I/O contention
- ⏳ Upload loading overlay — blocks interaction until first page EXIF + thumbnails are ready, then releases
- 🐛 Fixed: Review Summary button staying disabled after upload

**2026-06-12** — Parallel processing & geocode throttle
- ⚡ Zip/Save now processes 4 files concurrently instead of 1 — 36 files processed ~3× faster
- 🗺️ Reverse geocode throttled to 1 req/s with response caching — same coordinates reuse cached address instantly
- 🖼️ Summary thumbnails now concurrency-limited, same as file list

**2026-06-12** — Pagination & thumbnail caching
- 📄 File list pagination — default 5 per page, user can choose 5/10/25/50/All; prev/next controls
- 📋 Review Summary pagination — same pagination for the file table section
- ⚡ Thumbnail cache — thumbnails are cached as data URLs after first render; switching pages reuses cached results instantly instead of re-decoding original images
- 🗺️ Moved "Clear Selected GPS" to its own row next to the search bar for better UX

**2026-06-12** — Performance overhaul for large uploads
- ⚡ Batch `renderFileList()` — file list now renders once after all EXIF extraction completes, instead of N times for N files
- ⚡ Cached byte-to-string conversion — binary-to-string is done once per file during EXIF extraction and reused by ZIP/save processing
- 🖼️ Thumbnail generation concurrency limit — max 6 simultaneous image decodes, prevents browser from locking up with many files
- 💨 Blob URL memory management — all `createObjectURL` calls now properly revoked after use, eliminating memory leaks

**2026-06-12** — Google AdSense integration
- 📢 Added AdSense script & meta tag for ad serving
- 📄 `ads.txt` placed at site root for ad network verification
- 🔧 Build script updated to copy `ads.txt` to dist/

**2026-06-11** — Camera-Lens association & persistence
- 📸 Custom lenses are now saved per camera — each camera only shows its own saved lenses
- 💾 Focal length & max aperture are saved alongside the lens name for custom entries
- 🐛 Fixed: custom lens not saving to localStorage when camera is set to custom
- 🐛 Fixed: selecting a saved custom camera no longer crashes the app
- 🐛 Fixed: saved custom cameras now show their associated lens options instead of an empty dropdown

**2026-06-11** — GPS + i18n update
- 🌐 English & Traditional Chinese (Hong Kong) with floating language toggle
- 🗺️ GPS location via Leaflet + OpenStreetMap map — search or drop a pin, coordinates written to EXIF
- 📍 Reverse geocoding — address shown next to each file after location set
- 🖼️ File thumbnails with click-to-full-image preview
- 🔄 Multi-select files to batch-assign GPS location

**2026-06-11** — File Setup + Date/Time + Review overhaul
- 📅 Date & Time merged into File Setup section — select files, change date/time applies instantly
- 🗓️ Date auto-extracted from uploaded EXIF files; fallback to today 12:00
- 📍 GPS auto-extracted from uploaded EXIF with reverse geocode for address
- 🧹 Clear Date / Clear Selected GPS buttons for selected files
- 📋 Review summary now shows 40×40 thumbnails + Location + Date columns
- 🏷️ "Add FilmTag credit to photo description" checkbox replaces old signature options
</details>
