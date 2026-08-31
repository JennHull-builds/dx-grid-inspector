# Integrating DX Grid Inspector into your app

Copy the modules below into a **React 19** host (this repo uses **Vite** + **Tailwind CSS v4**). No npm package yet — files are meant to be copied as-is.

## Files to copy

| File | Purpose |
|------|---------|
| `src/types.ts` | `DesignNode`, `DesignProperties`, status/category types |
| `src/tokenExport.ts` | Read/apply computed CSS; format CSS, JSON, agent prompts; clipboard helper |
| `src/DxHostOverlay.tsx` | Drop-in wrapper: overlay chrome, inspect mode, target highlight |

**Optional (full demo parity):**

| File | Purpose |
|------|---------|
| `src/TokenCalibrationUnit.tsx` | Token calibration HUD (uses `tokenExport` + `types`) |
| `src/DxGridVoice.tsx` | Clipboard agent prompt from natural language |
| `src/index.css` (or the `@theme` + `.dx-*` sections) | Colours and button/toggle utilities used by overlay chrome |

`DxHostOverlay` only imports React. `tokenExport.ts` only imports `./types`.

## Dependencies

Runtime (match or newer):

```bash
npm install react react-dom
```

If you use the calibration HUD or this repo’s styling:

```bash
npm install -D tailwindcss @tailwindcss/vite
```

This demo also uses `@vercel/analytics` in `App.tsx` only — **not required** for integration.

## Minimal Vite host setup

1. **Create or use a Vite + React + TypeScript app** (`npm create vite@latest`).

2. **Copy files** into your `src/` (keep the same filenames so imports resolve):

   ```text
   src/types.ts
   src/tokenExport.ts
   src/DxHostOverlay.tsx
   ```

3. **Tailwind (recommended):** In `vite.config.ts`:

   ```ts
   import tailwindcss from '@tailwindcss/vite'

   export default defineConfig({
     plugins: [react(), tailwindcss()],
   })
   ```

   In your global CSS (e.g. `src/index.css`):

   ```css
   @import "tailwindcss";
   ```

   Copy the `:root` variables, `@theme { --color-dx-* }`, and `.dx-btn-primary`, `.dx-btn-secondary`, `.dx-toggle` blocks from this repo’s `src/index.css` so overlay chrome matches the demo.

4. **Wire overlay + HUD** (minimal pattern — see `src/App.tsx` overlay branch for the full shell):

   ```tsx
   import { useState } from 'react'
   import { DxHostOverlay } from './DxHostOverlay'
   import {
     applyDesignPropertiesToElement,
     readDesignPropertiesFromElement,
   } from './tokenExport'
   import type { DesignNode, DesignProperties } from './types'
   // Optional:
   // import { TokenCalibrationUnit } from './TokenCalibrationUnit'

   export function HostWithInspector() {
     const [enabled, setEnabled] = useState(true)
     const [inspecting, setInspecting] = useState(false)
     const [target, setTarget] = useState<HTMLElement | null>(null)
     const [properties, setProperties] = useState<DesignProperties>({
       radius: 12,
       padding: 16,
       bgPreset: '#1A1A2B',
       borderPreset: '#A78BFA',
     })

     const overlayNode: DesignNode = {
       id: 'overlay-target',
       name: 'Inspect target',
       category: 'Display',
       status: 'Ready',
       properties,
     }

     return (
       <div className="flex min-h-screen bg-dx-surface-0">
         <DxHostOverlay
           enabled={enabled}
           onEnabledChange={setEnabled}
           inspecting={inspecting}
           onInspectingChange={setInspecting}
           targetElement={target}
           onTargetSelect={(el) => {
             setTarget(el)
             setProperties(readDesignPropertiesFromElement(el))
           }}
           className="flex-1"
         >
           {(chrome) => (
             <div className="flex flex-col">
               {chrome}
               <main className="p-6">{/* Your real UI here */}</main>
             </div>
           )}
         </DxHostOverlay>
         {/* Optional: <TokenCalibrationUnit ... /> */}
       </div>
     )
   }
   ```

5. **Run:**

   ```bash
   npm install
   npm run dev
   ```

## Harness vs overlay (in this repo)

| Mode | Tab in demo | What it is |
|------|-------------|------------|
| **Harness** | Harness | Three-panel playground: `GridOverlay` (template nodes), `TokenCalibrationUnit`, `LiveTokenPreview`. State can persist via `harnessStorage.ts` + `localStorage`. Use this to calibrate tokens on **mock nodes**, not live host DOM. |
| **Overlay demo** | Overlay demo | Wraps `HostDemoSurface` with `DxHostOverlay`. **Inspect** picks a real element; HUD reads/applies tokens via `tokenExport`. Use this pattern in **your** app around real UI. |

**Integration path for production hosts:** copy `DxHostOverlay` + `tokenExport` + `types`, add `TokenCalibrationUnit` if you want the same HUD, and follow the overlay branch in `App.tsx` (not the harness grid).

## Export formats

From `tokenExport.ts`:

- `readDesignPropertiesFromElement(element)` — snapshot computed radius, padding, colours
- `applyDesignPropertiesToElement(element, properties)` — inline styles on the target only
- `formatTokensAsCss` / `formatTokensAsJson` / `formatTokensAsAgentPrompt` — copy-out
- `copyTextToClipboard(text)` — safe clipboard write

## Reference

- Live demo: https://dx-grid-inspector.vercel.app  
- Full shell: `src/App.tsx` (`appMode === 'harness' | 'overlay'`)
