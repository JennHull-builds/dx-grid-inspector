# Integrating DX Grid Inspector into your app

DX Grid Inspector wraps your React app while you develop: an **Inspect** toolbar above it and a token HUD beside it. Click an element to read its radius, padding, fill and border colour, edit them on the live element, and copy them out as CSS, JSON or an agent prompt. There is no backend and no AI call.

**Tested:** React 18.3 and 19.3 · Vite 8, in a Tailwind v4 app and in an app with no Tailwind at all · Next.js 16.3 (App Router) · Chromium, at 1280px and 390px wide.
**Not tested:** Firefox, Safari, touch devices, Tailwind v3 apps, webpack-based setups, screen readers.

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
| `TokenCalibrationUnit` | The token HUD: read, edit, apply, copy CSS / JSON / prompt, paste JSON. |
| `DxGridVoice` | Describe a layout in words and copy a prompt for an external agent. |
| `readDesignPropertiesFromElement`, `applyDesignPropertiesToElement`, `formatTokensAsCss`, `formatTokensAsJson`, `formatTokensAsAgentPrompt`, `parseDesignProperties`, `parseDesignPropertiesJson`, `copyTextToClipboard` | The functions behind the HUD. |
| `DesignProperties`, `DesignNode`, `NodeCategory`, `NodeStatus` and each component's props type | TypeScript types. |

If you use `DxHostOverlay` directly, its `className` is added to its own layout classes (`relative flex min-h-0 flex-1 flex-col`), and its own classes can override yours where they conflict. To size it, wrap it in an element of your own.

## Choosing the target

Clicking while Inspect is on selects the innermost element under the cursor. To make a larger element the target instead, add `data-dx-inspectable="true"` to it. Clicks on the overlay's own controls are never selected, and a click while inspecting does not activate the element underneath.

## Colours

Colours are read back as `#RRGGBB` when opaque and `rgba(r, g, b, a)` when translucent. That includes the `oklab()` and `oklch()` values Tailwind v4 colours compute to, which are converted to sRGB. The native colour picker cannot show transparency, so its swatch shows the colour without its alpha.

## Known limitations

- **Apply writes all four tokens**, not only the one you edited. An element with no border gets a 2px solid border so the border colour can be seen; an element that already has a border keeps its width.
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
