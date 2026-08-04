# Qianlin Travel / 黔林旅行社

The first-version marketing homepage for Qianlin Travel, a Guizhou-based travel service company.

## Run locally

```bash
npm install
npm run dev
```

The project uses React, TypeScript, Tailwind CSS and the Vinext starter runtime.

## Project map

- `app/page.tsx` — page composition and enquiry modal state
- `components/` — one component per homepage module
- `data/tours.ts` — featured tour data and image URLs
- `data/destinations.ts` — destination cards and image URLs
- `data/faq.ts` — FAQ accordion content
- `data/translations.ts` — English/Chinese UI copy for the language switcher
- `public/og.png` — social sharing preview image

## Content updates

To replace imagery, update the `image` values in the data files or the image URLs inside `Hero.tsx`, `About.tsx`, `Gallery.tsx` and `CustomizeForm.tsx`. The cards use regular image URLs so local files can be substituted later without changing the layout.

To add a tour, add another object to `data/tours.ts`; the homepage grid renders the card automatically.

The `中文` button in the top navigation switches the full page into Chinese mode. It covers the navigation, hero, tours, destinations, form, FAQ, contact information and footer.

## Future integrations

The enquiry form currently validates in the browser and shows a confirmation state. Its field names and submit handler are ready to be connected to an API or backend order system. Payment methods are presented as a reserved placeholder in `HowItWorks.tsx`; WeChat Pay, Alipay and international payments can be added there after the order and payment services are available.

Build and test:

```bash
npm run build
npm test
```
