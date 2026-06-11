# FilmTag

Interactive web app for writing EXIF metadata to film-scanned photos — all done in the browser.

**[filmtag.jeffreychuuu.com](https://filmtag.jeffreychuuu.com)**

> 🇭🇰 [中文版（Chinese README）](README.zh.md)

## Why FilmTag?

### The Problem

The most frustrating part of shooting film isn't waiting for development — it's getting your scans back and finding zero EXIF data. No camera, no lens, no ISO, no dates. For anyone who wants to properly organize their film work, it's a real headache.

### The Solution

FilmTag batch-writes EXIF metadata to your scanned photos. Everything happens in the browser — no installs, no server uploads.

### How It Works

1. Enter your camera, lens, film stock, and lab details
2. Pick your shooting dates (supports multiple date segments per roll)
3. Time is auto-generated starting from your chosen moment, +1 minute per photo
4. Upload your scanned files (JPEG, TIFF, etc.)
5. Download the tagged files with full EXIF — upload to Google Photos for perfect chronological order

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

## What's New

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

## Tech

- **piexifjs** — browser-side EXIF read/write
- **JSZip** — client-side ZIP packaging
- **esbuild** — bundler
- **Vercel** — deployment
- **Leaflet.js** — interactive map
- **OpenStreetMap + Nominatim** — map tiles & geocoding/reverse geocoding

## Local Dev

```bash
npm install
npm run build
npm run dev    # http://localhost:3333
```

## Deploy

Push to GitHub → import in Vercel → Root Directory = `.` (repo root). Vercel auto-runs `npm run build`, serves `dist/`.

## Origin

FilmTag started as a CLI tool for myself and a few friends — I'm a film photography beginner who happens to write code for a living, and I just wanted an easy way to tag my scans with proper metadata. Before a trip, I worried that a lab might send scans back while I was away, so I turned it into a web app I could use from anywhere.

## Disclaimer

This tool is shared freely with the film photography community. Commercial use or profiteering is strictly prohibited. Unauthorised commercial use will be subject to legal action.

---

© 2026 Jeffrey Chu. All rights reserved.

## Shared Config

`data.json` defines all dropdown options (cameras, lenses, films, labs, processes, pushpulls, scanners). Edit this file to update options across all deployments.
