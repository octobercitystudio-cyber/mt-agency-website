# Software application preview

The software-development hero uses two corresponding illustrative app screens rather than a programmer photograph or skeleton decoration. Fictional project and task data is clearly identified by a localized “Illustrative interface” caption. No customer data or private application pages were used.

- Source: `docs/design/software-app-preview.html`
- Desktop: `public/brand/gold/software-app/desktop-app.webp`, 1440 × 900, 50,268 bytes
- Mobile: `public/brand/gold/software-app/mobile-app.webp`, 390 × 780, 21,034 bytes

The HTML uses installed Segoe UI/Tahoma fonts and the existing local MT logo. It requires no external fonts or network assets. The mobile viewport renders a dedicated mobile task interface with bottom navigation, not a reduced desktop dashboard.

To reproduce, open the source file with a Chromium browser at exactly 1440 × 900 and 390 × 780, wait for images/fonts, capture each viewport at device scale 1, and encode as WebP quality 91. The screenshots were captured with Playwright and converted to WebP without cropping or retouching. No image-generation model was used for this code-native UI.

Monitor and phone frames are responsive site CSS; both image elements retain their natural proportions with object-fit: contain. The software-only CSS does not affect the website-design device composition.
