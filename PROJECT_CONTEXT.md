# Project Context: DX Spatial Grid & Token Inspector

## Overview

A lightweight, zero-dependency open-source **local testing harness** built with React 19, TypeScript, Vite, and Tailwind CSS v4. It lets you pick layout nodes, calibrate spatial tokens (padding, radius, fill, border), and preview those tokens on a sample surface in the browser.

This is **not** yet a drop-in grid overlay for other apps. A visual grid overlay you wrap around host UI remains a **future goal** — once the harness reliably reads live CSS from a preview surface and copies tokens out for reuse elsewhere.

## Current Harness (what ships today)

Three co-ordinated panels wired together in `src/App.tsx`:

1. **Template Grid Manager** (`src/GridOverlay.tsx`) — node list with category filters (Display, Navigation, Content, Functional), status chips (Ready / In Progress), add/purge actions, and keyboard-accessible row selection.
2. **Token Calibration Unit** (`src/TokenCalibrationUnit.tsx`) — live spatial token HUD for the selected node: corner radius, padding, surface fill, and border presets, with inline CSS unit and colour sanitisation. Includes **Read from preview** (pull computed CSS back into the HUD) and **Copy CSS / JSON** export.
3. **Live Token Preview** (`src/LiveTokenPreview.tsx`) — sample card and button that apply the selected node's tokens in real time; the card surface is the measurement target for read-back and export.

### Layout & persistence

- **Desktop (≥1024px):** three equal columns — nodes | calibrate | preview.
- **Mobile:** tabbed panels (Nodes · Calibrate · Preview); selecting a node on mobile switches to the Calibrate tab.
- **Persistence:** node list, selection, and mock-node counter are saved to `localStorage` via `src/harnessStorage.ts`.

### Data flow

```
Select node → edit tokens in HUD → preview updates live
                    ↑                      │
                    └── Read from preview ←┘
                    └── Copy CSS / JSON → clipboard
```

## Tech Stack & Tooling

- **Framework:** React 19 + TypeScript (strict mode)
- **Build engine:** Vite (`@tailwindcss/vite` plugin)
- **Styling:** Tailwind CSS v4 (native CSS variables)
- **Target deployment:** Vercel (demo hosting; optional Vercel Analytics in `App.tsx`)

## Core Architecture

- `src/types.ts` — canonical shared model (`NodeCategory`, `NodeStatus`, `DesignProperties`, `DesignNode`).
- `src/GridOverlay.tsx` — Template Grid Manager (node list UI; filename retained for history).
- `src/TokenCalibrationUnit.tsx` — spatial token calibration HUD.
- `src/LiveTokenPreview.tsx` — sample preview surface.
- `src/tokenExport.ts` — read computed CSS from the preview; format CSS/JSON for the clipboard.
- `src/harnessStorage.ts` — `localStorage` persistence for the harness snapshot.
- `src/App.tsx` — local testing harness shell (header, responsive layout, panel wiring).

## Future Goal: Drop-in Grid Overlay

After the harness stabilises token read-back and export, the Template Grid Manager could evolve into a **wrap-around overlay** for inspecting layout nodes in arbitrary host applications. That overlay mode is **not implemented** — the current deliverable is the self-contained harness only.

## Safety & Security Constraints

- Zero external API integrations or database connections.
- Purely local component state (plus optional `localStorage`).
- Strictly no private credentials, internal client assets, or hardcoded API keys.
