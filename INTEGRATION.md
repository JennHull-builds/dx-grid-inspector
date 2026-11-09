# Integrating DX Grid Inspector into your app

DX Grid Inspector wraps your React app while you develop: an **Inspect** toolbar above it and a token HUD beside it. Click an element to read its radius, padding, gap, margin, fill and border colour, edit them on the live element (arrow keys nudge a length and a colour picker sets fills and borders, while you watch it change), and copy them out as CSS, JSON or an agent prompt. There is no backend and no AI call.

**Tested:** React 18.3 and 19.3 · Vite 8, in a Tailwind v4 app and in an app with no Tailwind at all · Next.js 16.3 (App Router) · Chromium, at 1280px and 390px wide. Keyboard nudging, gap, margin and Copy all were tested in Chromium at both widths, in this repo's demo and in a plain React 19.3 app with no Tailwind and a white page, installed from the packed tarball. The colour picker was tested in Chromium at both widths, in this repo's demo (Harness and Overlay) and in a plain React 19.2 app with no Tailwind and a white page, using the built package files rather than a packed tarball.
**Not tested:** Firefox, Safari, touch devices, picking a colour with the eyedropper, the colour area on a Display P3 screen, Tailwind v3 apps, webpack-based setups, screen readers.

## Install

```bash
npm install -D dx-grid-inspector
```

- **React 18.2 or newer** (a peer dependency, so your app's React is the one used).
- **No Tailwind needed.** The package ships one compiled stylesheet. Its classes are prefixed `dx:` and its reset only touches the inspector's own elements, so it does not restyle your app, and your app's global element rules (a `button {}` or `h2 {}` rule, say) do not restyle it. Tested against exactly that.

## Vite

1. Create a dev-only module, `src/dev/inspector.tsx`:

   ```tsx
   import 'dx-grid-inspector/style.css'
   export { DxInspector as default } from 'dx-grid-inspector'
   ```

2. Load it **only in development** from your entry file. Vite replaces `import.meta.env.DEV` with `false` in a production build, so the import, the inspector and its stylesheet are all dropped:

   ```tsx
   // src/main.tsx
   import { lazy, Suspense, StrictMode } from 'react'
   import { createRoot } from 'react-dom/client'
   import './index.css'
   import App from './App'

   const Inspector = import.meta.env.DEV ? lazy(() => import('./dev/inspector')) : null

   createRoot(document.getElementById('root')!).render(
     <StrictMode>
       {Inspector ? (
         <Suspense fallback={null}>
           <Inspector>
             <App />
           </Inspector>
         </Suspense>
       ) : (
         <App />
       )}
     </StrictMode>,
   )
   ```

3. Give your app's root `height: 100%` (Tailwind: `h-full`), **not** `100vh` or `h-dvh`. The inspector fills the viewport and puts your app in the space under its toolbar; a root of `h-dvh` overflowed by the toolbar's height (53px).

## Next.js (App Router)

1. `app/dx-inspector.tsx`:

   ```tsx
   'use client'
   import 'dx-grid-inspector/style.css'
   export { DxInspector as default } from 'dx-grid-inspector'
   ```

2. `app/dev-inspector.tsx`. Next replaces `process.env.NODE_ENV` at build time, so a production build drops the import:

   ```tsx
   'use client'
   import dynamic from 'next/dynamic'
   import type { ReactNode } from 'react'

   const DxInspector =
     process.env.NODE_ENV === 'development' ? dynamic(() => import('./dx-inspector')) : null

   export function DevInspector({ children }: { children: ReactNode }) {
     return DxInspector ? <DxInspector>{children}</DxInspector> : <>{children}</>
   }
   ```

3. Wrap your layout's children:

   ```tsx
   // app/layout.tsx
   import { DevInspector } from './dev-inspector'

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html lang="en">
         <body>
           <DevInspector>{children}</DevInspector>
         </body>
       </html>
     )
   }
   ```

The package is marked as a Client Component (`'use client'`), so it can also be rendered straight from a Server Component.

## Check that it stays out of production

Build, then search the output for the inspector's marker attribute:

```bash
grep -rl "data-dx-ui" dist/          # Vite. For Next.js, search .next/ instead.
```

Expect no files. Also search for a string you know **is** in your app, so an empty search is not mistaken for a pass. In testing, a Vite app's production JS and CSS were byte-identical to a build without the inspector.

## What the package exports

| Export | What it is |
|--------|------------|
| `DxInspector` | The ready-made wrapper used above: overlay, HUD and voice prompt. Props: `children`, `defaultEnabled` (default `true`), `showVoice` (default `true`). |
| `DxHostOverlay` | The overlay on its own, for building your own layout. `src/DxInspector.tsx` shows how it is wired to the HUD. |
| `TokenCalibrationUnit` | The token HUD: read, edit, apply, copy CSS / JSON / prompt, paste JSON. Optional props `onFieldEdit` (follow arrow-key nudges and colour-picker changes on your own target), `contrastContext` (what the colour picker measures contrast against) and `sessionEntries` (shows the Copy all control). |
| `DxGridVoice` | Describe a layout in words and copy a prompt for an external agent. |
| `readDesignPropertiesFromElement`, `applyDesignPropertiesToElement`, `applyDesignFieldToElement`, `formatTokensAsCss`, `formatTokensAsJson`, `formatTokensAsAgentPrompt`, `formatSessionAsCss`, `formatSessionAsJson`, `parseDesignProperties`, `parseDesignPropertiesJson`, `copyTextToClipboard` | The functions behind the HUD. |
| `DesignProperties`, `DesignField`, `DesignNode`, `ContrastContext`, `NodeCategory`, `NodeStatus`, `TokenSessionEntry`, `FieldEditEvent`, `FieldEditPhase` and each component's props type | TypeScript types. |

If you use `DxHostOverlay` directly, its `className` is added to its own layout classes (`relative flex min-h-0 flex-1 flex-col`), and its own classes can override yours where they conflict. To size it, wrap it in an element of your own.

## Choosing the target

Clicking while Inspect is on selects the innermost element under the cursor. To make a larger element the target instead, add `data-dx-inspectable="true"` to it. Give it a name instead (`data-dx-inspectable="promo card"`) and it is selected the same way, and the name becomes its label in Copy all. An empty value or `"false"` does not mark it. Clicks on the overlay's own controls are never selected, and a click while inspecting does not activate the element underneath.

## Nudging with the keyboard

Click a length field in the HUD (radius, padding, gap or margin) and press ArrowUp or ArrowDown. The value changes by 1 (Shift: 10) when it is in px or has no unit, and by 0.125 (Shift: 1) when it is in rem, and never goes below 0. Each press updates the field and writes **only that field** to the inspected element, so you watch it change. Enter keeps the value. Escape puts back the value from before you started, on the element too, restoring the element's earlier inline styles exactly. Keyboard focus stays in the field, and each new value is announced in the HUD's status line, including the one Enter keeps after a nudge and the one Escape puts back. Other units (`%`, `vh`, `vw`, `em`) and the text field of a colour field ignore the arrow keys (the colour picker has its own, below).

`rem` is kept as rem (`1.5rem` stays `1.5rem`) rather than converted to px. Any other unit typed into a field still reduces to its number and is treated as px, as it did before.

If you build your own layout from `TokenCalibrationUnit`, pass `onFieldEdit` to follow the nudges on your target. A colour field reports the same phases while its picker is open, with `nudge` on every change in the picker. It receives `{ phase: 'start' | 'nudge' | 'commit' | 'revert', field, properties, nudged? }`; write one field with `applyDesignFieldToElement(element, event.field, event.properties)` on `nudge`, and again on `commit` when `nudged` is true (Enter may keep a value typed over the last nudge). Without it, the arrow keys still change the value in the HUD.

## Gap and margin

`DesignProperties` has two optional fields, `gap` and `margin`, handled like padding: one value each. Gap is the space between an element's children. It reads the gap you can see: `column-gap` for a flex row, `row-gap` for a flex column or a grid, and it has no effect unless the element is a flex or grid container. Margin is the space outside the element (it reads `margin-top`). Each is one value. Writing gap changes only the direction it reads, so the other direction is left alone; writing margin sets all four sides, so an element with `margin: 0 auto` loses its centring once you change its margin. The CSS export adds `--gap` and `--margin` only when the tokens have them, and JSON without them still parses.

## Copy all

The **Copy all** control copies every element you have tweaked as JSON (an array of `{ label, before, after }`) or as CSS (one block per element, led by a comment with its label). **Before** is the values the element was first read with, and **after** is what the HUD holds now. An element appears once its values differ, and drops out again if you put them back. A label is the element's `data-dx-inspectable` value when it has a name there, otherwise its tag plus its first class (`section.card`), with `(2)` added to a repeat.

The list lives in memory only. It is not saved to `localStorage` and it clears when you reload the page. In this repo's Harness, Copy all copies every node in the node list instead.

## Colours

Colours are read back as `#RRGGBB` when opaque and `rgba(r, g, b, a)` when translucent. That includes the `oklab()` and `oklch()` values Tailwind v4 colours compute to, which are converted to sRGB. The swatch beside a colour field shows transparency over a checkerboard.

## Colour picker

The swatch beside **Surface Fill** and **Border Preset** opens a colour picker under the field, so the element you are changing stays in view. The text field stays the source of truth: type a colour and the picker moves. Opening a second field's picker closes the first and keeps its colour.

- **Page tokens first.** The picker lists the colour custom properties your page declares on `:root`, `html` or `:host` (for example `--brand-500`), read again each time it opens. It follows rules nested in `@layer`, `@media` and `@supports`, and turns `hsl()`, named and `color-mix()` values into a colour. It skips the inspector's own `--dx-*` variables and Tailwind's `--tw-*` helpers. A stylesheet from another origin cannot be read, and neither can variables set inside a shadow root. A value written as `lab()` is left out. Tailwind v4 emits only the theme colours your classes use, so only those appear. A page with no colour tokens gets a plain OKLCH picker.
- **The colour area.** Lightness runs up and chroma (colourfulness) runs across, for the current hue, in OKLCH, where equal lightness looks equally light. Hue and opacity are sliders below it.
- **Screen limits.** A thin line marks where ordinary (sRGB) screens end: past it, only a Display P3 screen shows the colour as it is. Colours no screen can show are left empty. The readout says "every screen", "P3 screens only" or "no screen can show this", and gives the closest hex inside sRGB. The area is painted in Display P3 where the browser supports it, and in sRGB elsewhere.
- **Magnetic tokens.** While you drag, the handle snaps onto a token once it comes within one just-noticeable difference of it (0.02 in OKLab, the figure CSS Color 4 gives), and the readout names the token. Hold **Alt** (Option on a Mac) while dragging to turn the snap off. Keyboard moves never snap. The picker also always shows the nearest token and how far away it is, with a **Snap** button.
- **Contrast.** For Surface Fill, WCAG 2 contrast against the element's own text colour, with the 4.5:1 line drawn solid and the 3:1 line dashed across the area. For Border Preset, against the background behind the element, with the 3:1 line (the WCAG 2 minimum for non-text). The readout shows the ratio and AA, AAA or fails. APCA is not used, and a colour outside sRGB is measured on its closest sRGB hex.
- **Eyedropper.** A button samples a colour from the screen. It appears only where the browser has the EyeDropper API: Chrome 95 and later and Edge, not Firefox or Safari ([MDN's compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/EyeDropper.json)). It needs a secure context (HTTPS or localhost).
- **Keyboard.** The area takes focus when the picker opens. Arrow keys move lightness (up, down) and chroma (left, right), and Shift moves ten times as far. Screen readers hear the channel and value ("Lightness 72%"). **Enter** keeps the colour. **Escape** puts back the colour from before the picker opened, on the element too, and focus returns to the swatch.

**What is written.** `#RRGGBB` when the colour is opaque and inside sRGB, `rgba(r, g, b, a)` when it is translucent and inside sRGB, and `oklch(L% C H)` (with ` / alpha` when translucent) only when it lies outside sRGB. The text field accepts those, and `oklab()` and `color()` values too. The picker writes the colour itself, never `var(--token)`; the nearest token is named in the picker only.

**In your own layout.** `TokenCalibrationUnit` takes an optional `contrastContext`, `{ textColour, backgroundColour }`, both CSS colours. `DxInspector` fills it from the selected element: its computed text colour, and the background behind it (the first opaque ancestor, with translucent layers mixed over it, or the browser's canvas colour when none is opaque). Without it the picker shows no contrast.

## Known limitations

- **Apply writes only the tokens that differ from the element.** It compares the HUD with the element's current computed values and leaves every matching field alone, so applying an unchanged HUD touches nothing. A border is added (2px solid) only when the border colour is one of the changed fields and the element has no visible border; an element that already has a border keeps its width.
- **Gap only has an effect on a flex or grid container,** and gap and margin are each one value (writing margin sets all four sides). Apply writes them only when you changed them.
- **Read from target turns a colour outside sRGB into a hex.** The HUD reads every colour back as sRGB, so a colour the picker wrote as `oklch()` comes back as the closest hex the browser shows for it. The element itself keeps what the picker wrote.
- **The CSS export uses generic property names** (`--radius`, `--padding`). Rename them if your app already defines properties with those names.

## Copying the source instead

Prefer the package. The components use `dx:`-prefixed Tailwind v4 classes that `src/lib/styles.css` compiles, so copying the source also means compiling that stylesheet with Tailwind v4 in your own build.

## Harness vs overlay (in this repo)

| Mode | Tab in demo | What it is |
|------|-------------|------------|
| **Harness** | Harness | Three-panel playground: `GridOverlay` (template nodes), `TokenCalibrationUnit`, `LiveTokenPreview`. State can persist via `harnessStorage.ts` + `localStorage`. Use this to calibrate tokens on **mock nodes**, not live host DOM. |
| **Overlay demo** | Overlay demo | Wraps `HostDemoSurface` with `DxHostOverlay`. **Inspect** picks a real element; HUD reads/applies tokens via `tokenExport`. |

## Reference

- Live demo: https://dx-grid-inspector.vercel.app
- Package entry: `src/lib/index.ts` · stylesheet: `src/lib/styles.css` · build: `npm run build:lib`
- Full demo shell: `src/App.tsx` (`appMode === 'harness' | 'overlay'`)
