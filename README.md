# Color Palette Generator

A simple web app that extracts a color palette from an uploaded image.

## Features

- Upload an image (PNG, JPG, WEBP, BMP) via click or drag & drop
- Generate a palette of 1–6 colors using k-means++ clustering
- Copy HEX and RGB values to clipboard
- UI accent colors update dynamically to match the generated palette
- Polish / English language toggle

## Usage

Open `index.html` in a browser. No server or dependencies required.

## How it works

The app draws the uploaded image on a hidden canvas, samples the pixel data, and runs k-means++ clustering to find the dominant colors. Results are sorted by luminance (dark to light).

## Files

| File | Description |
|------|-------------|
| `index.html` | Page structure |
| `style.css` | Dark theme, layout, animations |
| `app.js` | Image processing, color extraction, i18n |

## License

MIT
