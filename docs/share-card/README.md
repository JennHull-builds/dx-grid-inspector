# Share card

The image link previews show (WhatsApp, LinkedIn, Slack, X): `public/og/dx-grid-<version>.jpg`, 1200 by 630.

To make one for a new version:

1. Update the version chip in `card.html`. Retake `ui-calibration.png` if the picker changed (the Token Calibration Unit panel, picker open on Border Preset, at device scale 2).
2. Open `card.html` in Chromium at a 1200 by 630 viewport, device scale 1, once Geist has loaded, and save a JPEG at quality 90. Keep it small (the 0.2.0 card is about 90 KB): some apps are said to skip large preview images, which is unverified, and small costs nothing.
3. Save it under a **new file name** and point `og:image` and `twitter:image` in `index.html` at it. Previews cache by image URL, so overwriting the old file leaves old shares, and often new ones, showing the old card.
4. Upload the same image on GitHub: the repository's Settings, General, Social preview. There is no API for it.
