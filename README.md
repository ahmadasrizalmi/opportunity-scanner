# Property Opportunity Scanner Chrome Extension

Property opportunity scanner Chrome Extension — scan any business website and get an opportunity score for professional interior photography.

## Features

- Auto-scan images on current page
- Opportunity score 0-100 (lower quality = higher opportunity)
- Detect: image count, resolution, aspect ratio, EXIF data
- Flag: "Using phone photos", "Only 3 gallery photos", "No interior photos"
- History tracking of scanned websites
- Export results to CSV
- Integration with Maps Lead Scraper (import leads)
- Apple-style UI (light theme, no AI slop)

## Install

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `opportunity-scanner` folder

## Usage

1. Click extension icon → Side panel opens
2. Navigate to a business website (hotel/villa/restaurant/cafe)
3. Click "Scan This Page"
4. View opportunity score + analysis
5. Check history tab for all scanned sites
6. Export to CSV for outreach targeting

## Scoring Logic

| Score | Meaning |
|-------|---------|
| 80-100 | High opportunity - needs professional photos badly |
| 50-79 | Medium opportunity - could improve |
| 20-49 | Low opportunity - already has decent photos |
| 0-19 | Very low - already professional |

## Tech

- Chrome Extension Manifest V3
- Content script for image analysis
- Canvas API for image quality detection
- No external dependencies
