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

The final result 👇

**Google Photos (Web)**
![Google Photos Web](img/gphoto_web.png)

**Google Photos (Mobile)**
![Google Photos Mobile](img/gphoto_mobile.png)

**iPhone Photos**
![iPhone Photos](img/iphone.png)

**Mac Photos**
![Mac Photos](img/mac.jpg)

## Features

- Upload JPEG/TIFF/DNG/PNG photos via drag & drop
- Set camera, lens, film stock, ISO, lab, process, push/pull, scanner via dropdowns
- Multiple date segments with individual start times
- Review summary with file rename preview before processing
- Writes EXIF tags: Make, Model, Artist, ISO, LensModel, DateTime, FocalLength, FNumber, Aperture, Shutter, UserComment, ImageDescription, Copyright, Instructions
- Writes XMP: Label, Creator, Credit, DateCreated, dc:description
- Batch download as ZIP with standardized filenames (`FilmName_YYYYMMDDHHMM_XX.jpg`)
- iOS: Save to Album via share sheet

## Tech

- **piexifjs** — browser-side EXIF read/write
- **JSZip** — client-side ZIP packaging
- **esbuild** — bundler
- **Vercel** — deployment

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
