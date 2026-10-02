# Integrating DX Grid Inspector into your app

Copy the modules below into a **React 19** host with **Vite** and **Tailwind CSS v4**. No npm package yet — files are meant to be copied as-is.

These steps come from wiring the overlay into a second app (not this repo) as a dev-only tool, then using it on that app's real screens.

**Tested:** Chromium, React 19.2, Tailwind 4.3, Vite 8, at 1280px and 390px wide. **Not tested:** React 18, Next.js, Firefox, Safari, touch devices.

## Files to copy

Put all of these **together in one folder**, for example `src/dx/`, and keep the filenames. They import each other by relative path. A folder also avoids a clash if your app already has a file with one of these names.

| File | Purpose |
|------|---------|
| `src/types.ts` | `DesignNode`, `DesignProperties`, status/category types |
| `src/tokenExport.ts` | Read/apply computed CSS; format CSS, JSON, agent prompts; clipboard helper |
| `src/DxHostOverlay.tsx` | Drop-in wrapper: overlay chrome, inspect mode, target highlight |
| `src/TokenCalibrationUnit.tsx` | The HUD: read, edit, apply, copy CSS / JSON / prompt, paste JSON |
| `src/DxGridVoice.tsx` | Clipboard agent prompt from natural language |

The overlay on its own only turns inspect mode on and highlights the element you click. **To read, edit, apply, copy and paste tokens you also need the HUD.** `DxGridVoice` is optional.

`DxHostOverlay` only imports React. `tokenExport.ts` only imports `./types`.

## Dependencies

```bash
npm install react react-dom
npm install -D tailwindcss @tailwindcss/vite
```

**Tailwind CSS v4 is required.** Every class in the overlay and HUD is a Tailwind utility, so without it the chrome has no layout.

## Minimal Vite host setup

1. **Use a Vite + React + TypeScript app** with Tailwind v4 already working (`@tailwindcss/vite` in `vite.config.ts`, `@import "tailwindcss";` in your global CSS).

2. **Copy the five files** into one folder, e.g. `src/dx/`.

3. **Colour tokens.** The overlay uses utilities such as `bg-dx-surface-1`, so Tailwind needs these tokens. Add them to your global CSS (e.g. `src/index.css`), after the `@import`:

   ```css
   @theme {
     --color-dx-surface-0: #0a0a10;
     --color-dx-surface-1: #0f0f18;
     --color-dx-surface-2: #13131f;
     --color-dx-surface-3: #1a1a2b;
     --color-dx-accent: #a78bfa;
     --color-dx-accent-ink: #0a0a10;
     --color-dx-secondary: #5eead4;
     --color-dx-success: #e8c47a;
     --color-dx-warning: #7dd3fc;
     --color-dx-danger: #f87171;
   }
   ```

4. **Overlay styles.** Create `src/dx/dx.css` and copy into it from this repo's `src/index.css`:

   - the custom properties inside `:root` (`--surface-*`, `--accent*`, `--secondary`, `--success`, `--warning`, `--danger`, `--border-subtle`, `--text*`). **Leave out** the `color-scheme`, `font-*` and `-webkit-*` lines so you do not change your app's fonts.
   - these rules from the "Role utilities" section, with their `:hover` and `:disabled` companions: `.dx-toggle`, `.dx-toggle-active`, `.dx-btn-primary`, `.dx-btn-secondary`, `.dx-btn-ghost`, `.dx-selection`, `.dx-selection-idle`.

   Keep this file plain CSS, with no `@import "tailwindcss"` and no `@theme`. We tried a second Tailwind stylesheet for the overlay and it broke the host's layout in dev: panels marked `hidden lg:flex` stayed hidden, and the second stylesheet contained its own `.hidden` rule, loaded after yours.

5. **Wire it, dev-only.** Create `src/dx/DxDevTools.tsx`. It wraps your app with the overlay and puts the HUD beside it:

   ```tsx
   import './dx.css'
   import { useState, type ReactNode } from 'react'
   import { DxHostOverlay } from './DxHostOverlay'
   import { DxGridVoice } from './DxGridVoice'
   import { TokenCalibrationUnit } from './TokenCalibrationUnit'
   import {
     applyDesignPropertiesToElement,
     readDesignPropertiesFromElement,
   } from './tokenExport'
   import type { DesignNode, DesignProperties } from './types'

   interface DxDevToolsProps {
     /** The real app UI to inspect. */
     children: ReactNode
   }

   const createOverlayNode = (properties: DesignProperties): DesignNode => ({
     id: 'overlay-target',
     name: 'Host inspect target',
     category: 'Content',
     status: 'In Progress',
     properties,
   })

   export default function DxDevTools({ children }: DxDevToolsProps) {
     const [enabled, setEnabled] = useState(true)
     const [inspecting, setInspecting] = useState(false)
     const [target, setTarget] = useState<HTMLElement | null>(null)
     const [node, setNode] = useState<DesignNode>(() =>
       createOverlayNode({
         radius: 16,
         padding: 24,
         bgPreset: '#1A1A2B',
         borderPreset: '#A78BFA',
       }),
     )

     const handleTargetSelect = (el: HTMLElement) => {
       setTarget(el)
       setNode(createOverlayNode(readDesignPropertiesFromElement(el)))
       setInspecting(false)
     }

     return (
       <div className="flex h-dvh flex-col bg-dx-surface-0 lg:flex-row">
         <DxHostOverlay
           enabled={enabled}
           onEnabledChange={setEnabled}
           inspecting={inspecting}
           onInspectingChange={setInspecting}
           targetElement={target}
           onTargetSelect={handleTargetSelect}
           className="min-h-0 flex-1"
         >
           {(chrome) => (
             <div className="flex h-full flex-col">
               {chrome ?? (
                 <div className="flex shrink-0 justify-end border-b border-white/10 bg-dx-surface-1 px-3 py-2">
                   <button
                     type="button"
                     onClick={() => setEnabled(true)}
                     className="dx-toggle min-h-9 px-3"
                   >
                     Enable overlay
                   </button>
                 </div>
               )}
               <div className="min-h-0 flex-1">{children}</div>
             </div>
           )}
         </DxHostOverlay>
         <aside className="flex max-h-[45dvh] shrink-0 flex-col gap-3 overflow-y-auto border-t border-white/10 p-3 lg:max-h-full lg:w-[22rem] lg:border-l lg:border-t-0">
           <div className="rounded-[16px] border border-white/5 bg-dx-surface-2">
             <TokenCalibrationUnit
               key={target ? 'target' : 'idle'}
               selectedNode={target ? node : null}
               onUpdateProperties={(_id, properties) =>
                 setNode((prev) => ({ ...prev, properties }))
               }
               onReadFromPreview={
                 target
                   ? () =>
                       setNode(
                         createOverlayNode(readDesignPropertiesFromElement(target)),
                       )
                   : undefined
               }
               readLabel="Read from target"
               onApplyToTarget={
                 target
                   ? () => applyDesignPropertiesToElement(target, node.properties)
                   : undefined
               }
               emptyHint="Turn on Inspect and click a host surface to calibrate tokens."
             />
           </div>
           <DxGridVoice properties={node.properties} nodeName={node.name} />
         </aside>
       </div>
     )
   }
   ```

   Then load it **only in development** from your entry file. Vite replaces `import.meta.env.DEV` with `false` in a production build, so the dynamic import, the overlay code and `dx.css` are all dropped:

   ```tsx
   // src/main.tsx
   import { lazy, Suspense, StrictMode } from 'react'
   import { createRoot } from 'react-dom/client'
   import './index.css'
   import App from './App'

   const DxDevTools = import.meta.env.DEV
     ? lazy(() => import('./dx/DxDevTools'))
     : null

   createRoot(document.getElementById('root')!).render(
     <StrictMode>
       {DxDevTools ? (
         <Suspense fallback={null}>
           <DxDevTools>
             <App />
           </DxDevTools>
         </Suspense>
       ) : (
         <App />
       )}
     </StrictMode>,
   )
   ```

   `import.meta.env` needs `/// <reference types="vite/client" />`, which Vite templates include in `src/vite-env.d.ts`.

6. **Run:**

   ```bash
   npm install
   npm run dev
   ```

   An **Overlay on / Inspect** toolbar appears above your app and the HUD beside it. On a phone-width screen the HUD stacks below the app and takes up to 45% of the height.

## Check that it stays out of production

```bash
npm run build
grep -rl "dx-overlay-chrome" dist/ ; echo "files found: $(grep -rl 'dx-overlay-chrome' dist/ | wc -l)"
```

Expect `files found: 0`. Also search for a string you know **is** in your app, so an empty search is not mistaken for a pass.

If your `build` script is only `vite build`, also run `npx tsc --noEmit`: the build alone does not type-check the copied files.

**What remains in production:** Tailwind scans every source file, so a few kB of generic utility classes (`flex`, `gap-3`, …) that only the overlay files use still end up in your production CSS. They are inert. None of the overlay's code or its `.dx-*` styles ship.

## Layout

The toolbar takes its own row above your app. Give your app's root `h-full`, **not** `h-dvh` or `100vh`: with `h-dvh` the page overflowed by the toolbar's height (53px) and scrolled inside the overlay. The example wrapper in step 5 gives your app a flex slot under the toolbar, so `h-full` fills it exactly.

## Choosing the target

Clicking while Inspect is on selects the innermost element under the cursor. To make a larger element the target instead, add `data-dx-inspectable="true"` to it. Clicks on the overlay's own controls are never selected, and a click while inspecting does not activate the element underneath.

## Known limitations

Found while using the overlay on real elements of a Tailwind v4 app:

- **Translucent colours read as `oklab(...)`.** Tailwind v4 colours such as `border-white/5` are computed by the browser as `oklab(...)`. The HUD shows them as-is, the border swatch renders black, the border field rejects its own value ("Invalid border value"), and CSS / JSON exports contain `oklab(...)`. Solid hex and `rgb()` colours are unaffected.
- **Apply to target can thicken a border.** It sets `border-width: 2px` and `border-style: solid` whenever the element has no *inline* border width, so a 1px border from your stylesheet becomes 2px. It also writes all four tokens, not only the one you edited.
- **The inspect highlight is not clipped to your app.** It uses fixed positioning, so when the target is taller than the visible app area it is drawn over the HUD.
- **The CSS export uses generic property names** (`--radius`, `--padding`). Rename them if your app already defines properties with those names.

## Harness vs overlay (in this repo)

| Mode | Tab in demo | What it is |
|------|-------------|------------|
| **Harness** | Harness | Three-panel playground: `GridOverlay` (template nodes), `TokenCalibrationUnit`, `LiveTokenPreview`. State can persist via `harnessStorage.ts` + `localStorage`. Use this to calibrate tokens on **mock nodes**, not live host DOM. |
| **Overlay demo** | Overlay demo | Wraps `HostDemoSurface` with `DxHostOverlay`. **Inspect** picks a real element; HUD reads/applies tokens via `tokenExport`. Use this pattern in **your** app around real UI. |

**Integration path for production hosts:** the five files above, wired as in step 5 (not the harness grid). `src/App.tsx` (`appMode === 'overlay'`) is the same wiring inside this repo's demo shell.

## Export formats

From `tokenExport.ts`:

- `readDesignPropertiesFromElement(element)` — snapshot computed radius, padding, colours
- `applyDesignPropertiesToElement(element, properties)` — inline styles on the target only
- `formatTokensAsCss` / `formatTokensAsJson` / `formatTokensAsAgentPrompt` — copy-out
- `parseDesignPropertiesJson(raw)` — parse pasted token JSON
- `copyTextToClipboard(text)` — safe clipboard write

## Reference

- Live demo: https://dx-grid-inspector.vercel.app  
- Full shell: `src/App.tsx` (`appMode === 'harness' | 'overlay'`)
