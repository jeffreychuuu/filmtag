# FilmTag

Interactive web app for writing EXIF metadata to film-scanned photos — all done in the browser.

**[filmtag.jeffreychuuu.com](https://filmtag.jeffreychuuu.com)**

> 🇭🇰 [中文版（Chinese README）](README.zh.md)

## Why FilmTag?

You just got your scans back from the lab. The colours are perfect. The grain is _chef's kiss_. You're hyped.

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

| Feature                         | Description                                                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera & Lens                   | Camera is per-roll (set once, above upload) — built-in presets (Leica MP, Olympus OM-2Sp, etc.) plus full custom model, focal length, and max aperture. Lens is per-photo: the lens modal only lists the chosen camera's lenses, so a roll can mix different lenses on the same camera |
| Film Stock & ISO                | 23 built-in film stocks (Kodak, Fujifilm, CineStill, Ilford, etc.) — selecting a film auto-fills ISO                                                                                         |
| Lab Records                     | Hong Kong lab presets: DOT-WELL, Megatoni, TrueFace Pro Lab, Photo Garden, HK Camera, Showa, Colorluxe — with Push/Pull and scanner model tracking                                           |
| Time Sequencing (the best part) | Auto-increments +1 minute per photo, timezone forced to +08:00. Shot a roll across multiple days? Set up date segments with individual start times — Google Photos will order them perfectly |
| 🌐 i18n                         | English & Traditional Chinese (Hong Kong) — toggle via floating button, translations for all UI text                                                                                         |
| 🗺️ GPS Location                 | Built-in Leaflet + OpenStreetMap map. Select files, search or drop a pin — GPS coordinates written to EXIF. Reverse geocoding shows address next to each file                                |
| ☑ Content Sheet                 | Auto-generates a Content Sheet during Save/ZIP — configurable toggle, standalone download button, footer with film/camera/lab/date range                                                     |

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

- Upload JPEG photos via drag & drop
- Camera (per roll) is set above the upload area; film stock, ISO, lab, process, push/pull, scanner via dropdowns — each metadata field unlocks after upload
- Lens is per photo: the lens modal only shows the selected camera's lenses, and a roll can use different lenses on the same camera (changing camera with multiple lenses prompts a confirmation)
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
- Contact Sheet: auto-generated JPEG with thumbnail grid, footer (film, camera, lens, lab, date range) — toggle on/off, standalone download, or auto-added during Save/ZIP

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

- `npm run release` → **patch** (1.1.3 → 1.1.4)
- `npm version minor` → **minor** (1.1.3 → 1.2.0)
- `npm version major` → **major** (1.1.3 → 2.0.0)

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

**1.13.0 (2026-08-27)** — Streamlined roll workflow & redesigned gear/metadata layout

- 🧭 Camera is now per-roll and placed **above the upload area** — pick your body first, then drop your scans
- 📷 Lens is treated as per-photo: the Set Lens modal only shows the selected camera's lenses (previously it also let you switch cameras inline)
- 🗂️ UI regrouped into two visual blocks: **Photos & Gear** (upload, file list, camera) and **Metadata** (artist, film, lab, process, push/pull, scanner, signature) with an icon group header
- 🔓 Metadata fields are progressively revealed — locked until you upload photos, then unlocked automatically (re-locked when you clear/remove files)
- ⚠️ Changing the camera when a roll already uses multiple lenses now prompts a confirmation popup, instead of silently resetting every lens

**1.12.0 (2026-08-23)** — Multiple lenses per roll (same camera)

- 🔭 Set a lens per selected file (same layer as Date/GPS) — apply to selected files or the whole roll
- 🅰️ Multiple lenses on one roll are labelled A/B/C in the file list; full names shown in a wrapping header legend
- 🧠 Per-camera default lens is remembered (last used) and follows camera selection
- 🖼️ Summary table and Content Sheet show the resolved lens per frame

**1.11.0 (2026-07-25)** — Light Mode

- ☀️ Light mode toggle — floating button switches between dark & light themes
- 🎨 All CSS variables re-themed: backgrounds, text, borders, accents, success/error states
- 💾 Theme preference saved to localStorage, persists across sessions
- 🔍 Hardcoded colors (`#fff`, `#000`, `#888`, `#111`, etc.) replaced with CSS variables — consistent theming throughout

**1.10.0 (2026-07-21)** — Inline ⚙️ icons per field for Custom Options

- ⚙️ Each dropdown (Artist, Camera, Lens, Film, Lab, Process, Push/Pull, Scanner) has a ⚙️ icon next to its label
- 🎯 Click ⚙️ to open Custom Options overlay with that section auto-expanded — directly manage that field's hidden defaults and custom entries
- 📖 Tutorial updated to explain the new per-field access pattern
- 🧠 Submenu navigation: Hide/Show defaults and Remove custom entries, all inline

**1.9.0 (2026-07-20)** — Custom Options overlay: hide defaults + manage saved entries

- ⚙️ "Custom Options" in footer opens overlay to manage all saved entries + built-in presets
- 👁️ Hide/unhide built-in defaults per field (camera, lens, film, lab, etc.) — hidden items persist in localStorage
- 🗑️ Delete custom entries (artist, camera, lens, film, lab, process, push/pull, scanner)
- 🔄 "Show all defaults" button to restore all hidden presets
- 🔧 Dropdowns refresh instantly after any change — no page reload needed

**1.8.0 (2026-07-20)** — Manage Custom Options overlay

- ⚙️ "Manage" button opens overlay to view and delete saved custom entries (artist, camera, lens, film, lab, process, push/pull, scanner)
- 🗑️ Each saved entry has a delete (✕) button — changes saved immediately to localStorage
- 🔄 After deletion, dropdowns are refreshed automatically — no page reload needed
- 👁️ Empty state message guides users on how to add custom options

**1.7.0 (2026-07-20)** — Edit This Roll button

- ✏️ "Edit This Roll" button next to "Next Roll" — returns to settings form without reloading, preserves uploaded files and all settings
- 🎯 Available after ZIP download, Content Sheet download, and in Gallery overlay
- 🧠 All in-memory state (files, GPS, dates, selections) intact — modify settings and re-process

**1.6.0 (2026-07-20)** — EXIF auto-fill on upload

- 🎯 After uploading photos, EXIF fields (Artist, Camera, Lens, ISO, Process) auto-populate dropdowns
- 🔍 Matches EXIF values against built-in options — selects matching entry or fills as custom value
- 📐 Focal length & aperture auto-filled from EXIF when available

**1.5.0 (2026-07-20)** — Contact Sheet generation

- ☑ Content Sheet toggle in Review Summary — default ON, saved to localStorage
- 📸 "Generate Content Sheet Only" button for standalone Content Sheet download
- 🎞️ Auto-generates during Save to Album or Download ZIP when toggle is ON
- 📐 Dynamic grid layout — canvas matches import image dimensions, auto-calculated cols/rows for up to 40 photos
- 📋 Footer: film stock + ISO, camera + lens, lab, date range

**1.4.0 (2026-06-29)** — Feedback system · Disclaimer overlay · Tutorial About reorg

- 💬 Floating feedback button with Bug Report / Suggestion form — submitted to Upstash KV
- ⚠️ First-visit overlay now requires 2 checkboxes (AI tool acknowledgment + non-commercial agreement) before proceeding
- 📖 Origin moved to tutorial About tab as first step
- 🎯 Floating buttons reorganized: 🇭🇰 Language → ❓ Help → 💬 Feedback → 🐈 Easter egg

**1.3.0 (2026-06-29)** — Session restore · Tutorial · Sort toggle · Range UX · View counter

- 🔄 All settings (gear, film, lab, process, scanner, checkbox) are now saved and restored on next page load — pick up where you left off
- 📖 Interactive tutorial on first visit with ❓ help button to revisit anytime — covers upload, gear, reorder, date, GPS, review, EXIF details, Google Photos ordering, and privacy (all data stays in localStorage, nothing sent to server)
- 🔤 Sort button simplified to a single toggle — ▼ A→Z / ▲ Z→A
- 🤚 Drag & drop is now the only reorder method (▲/▼ buttons removed)
- ✅ Tick icon replaces spinner when processing is done
- 📄 Drag to page bottom drops at the end of the current page, not the end of the roll
- 🛠️ Session restore now tries to match saved values as dropdown options first (instead of always setting **custom**)
- ✕ Range remove button only appears when multiple ranges exist
- 🚫 Add Range disabled when all files are selected
- 👁 View counter & 🖼 photos processed counter displayed in header (persisted via Upstash KV)

**1.2.0 (2026-06-28)** — Developing Process free-text + Next Roll for ZIP + file reordering

- ✏️ Developing Process dropdown now supports custom free-text input — type any process like C-41, ECN-2, E-6
- 💾 Custom process entries are saved to localStorage for future sessions
- 🎞️ "Next Roll" button now appears after ZIP download too — start fresh without reloading manually
- 🔼 Reorder uploaded files with ▲/▼ buttons — control sequence numbering and timestamp order
- 🤚 Drag & drop to reorder — just grab and drag files to any position

**1.1.3 (2026-06-14)** — Fix add range + Clear GPS button

- 🐛 Fixed: "Add Range" button not working after module refactor
- ✏️ "Clear Selected GPS" renamed to "Clear" and moved below map
- 🖼️ Upload restricted to `.jpg` / `.jpeg` only (TIFF/DNG/PNG rejected)

**1.1.2 (2026-06-14)** — Restrict upload to JPEG only

- 🖼️ Upload filter: only `.jpg` / `.jpeg` accepted; TIFF/DNG/PNG rejected with warning
- 📝 File input `accept` attribute & UI text updated accordingly
- 🔧 `handleFiles` now rejects non-JPEG files with status message

**1.1.1 (2026-06-14)** — Codebase refactored into modules, Vitest + 57 tests

- 🧩 `app.js` split from 1505→249 lines into 6 modules under `src/modules/`
- 🧪 Vitest + happy-dom test suite (57 tests), TDD-ready
- 🏷️ Terminology: "Author" → "Artist" in code, DOM, data.json, and translations
- 🗂️ Project restructured: `lib/` for utils, `modules/` for logic
- 🐛 Fixed: range selection dropdown filter, `Next Roll` gallery button, review summary buttons
- ⚠️ Disclaimer modal: Disagree now blocks access until refresh

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
