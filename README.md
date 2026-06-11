# FilmTag

Interactive web app for writing EXIF metadata to film-scanned photos — all done in the browser.

**[filmtag.jeffreychuuu.com](https://filmtag.jeffreychuuu.com)**

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

## Shared Config

`data.json` defines all dropdown options (cameras, lenses, films, labs, processes, pushpulls, scanners). Edit this file to update options across all deployments.
