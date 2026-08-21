# Project Context: DX Spatial Grid & Token Inspector

## Overview

A lightweight, zero-dependency open-source **local testing harness** and **drop-in host overlay** built with React 19, TypeScript, Vite, and Tailwind CSS v4. It lets you pick layout nodes, calibrate spatial tokens (padding, radius, fill, border), preview those tokens on a sample surface, or wrap real host UI, inspect a surface, and leave with CSS, token JSON, or an agent prompt snippet.

**Phase 3 goal:** Ship a local drop-in `DxHostOverlay` that wraps host UI in this repo (then copyable elsewhere), so engineers can inspect a real surface, calibrate `DesignProperties`, and leave with CSS, token JSON, or an agent prompt — with optional Phase 3.5 clipboard “DX grid voice”; npm stays parked until the overlay is proven; no backend or API keys unless we explicitly decide otherwise.

This is **not** an installable npm package yet, and it does **not** run an in-app LLM. Voice is clipboard-assisted only.

## Current product (what ships today)

### Mode A — Local testing harness

Three co-ordinated panels wired together in `src/App.tsx` (Harness tab):

1. **Template Grid Manager** (`src/GridOverlay.tsx`) — node list with category filters (Display, Navigation, Content, Functional), status chips (Ready / In Progress), add/purge actions, and keyboard-accessible row selection.
2. **Token Calibration Unit** (`src/TokenCalibrationUnit.tsx`) — live spatial token HUD: corner radius, padding, surface fill, and border presets, with inline CSS unit and colour sanitisation. Includes **Read from preview**, **Copy CSS / JSON / Prompt**, and **Paste** JSON.
3. **Live Token Preview** (`src/LiveTokenPreview.tsx`) — sample card and button that apply the selected node's tokens; the card surface is the measurement target for read-back and export.

### Mode B — Overlay demo

1. **DxHostOverlay** (`src/DxHostOverlay.tsx`) — wrap-around chrome with enable/disable and inspect mode (Escape exits inspect).
2. **HostDemoSurface** (`src/HostDemoSurface.tsx`) — generic in-repo host layout (header + content card + secondary panel) used to prove the overlay on real UI.
3. **Apply to target** — writes the four `DesignProperties` fields as inline styles on the selected host element only.
4. **DX grid voice** (`src/DxGridVoice.tsx`) — natural-language textarea → copy a paste-ready agent prompt (no API keys, no model calls). Paste the returned JSON in the HUD.

### Layout & persistence

- **Desktop (≥1024px):** harness uses three equal columns — nodes | calibrate | preview. Overlay demo uses host | HUD + voice.
- **Mobile:** harness uses tabbed panels (Nodes · Calibrate · Preview).
- **Persistence:** harness node list, selection, and mock-node counter are saved to `localStorage` via `src/harnessStorage.ts`.

### Data flow

```
Harness:  Select node → edit tokens in HUD → preview updates live
                     ↑                      │
                     └── Read from preview ←┘
                     └── Copy CSS / JSON / Prompt → clipboard
                     └── Paste JSON → HUD

Overlay:  Inspect host element → read DesignProperties → HUD
                     └── Apply to target → host element
                     └── Copy / Paste / Voice prompt (clipboard agent workflow)
```

## Tech Stack & Tooling

- **Framework:** React 19 + TypeScript (strict mode)
- **Build engine:** Vite (`@tailwindcss/vite` plugin)
- **Styling:** Tailwind CSS v4 (native CSS variables)
- **Target deployment:** Vercel (demo hosting; optional Vercel Analytics in `App.tsx`)

## Core Architecture

- `src/types.ts` — canonical shared model (`NodeCategory`, `NodeStatus`, `DesignProperties`, `DesignNode`).
- `src/GridOverlay.tsx` — Template Grid Manager (node list UI; filename retained for history).
- `src/DxHostOverlay.tsx` — drop-in wrap-around overlay for host children.
- `src/HostDemoSurface.tsx` — in-repo host UI for the overlay demo.
- `src/TokenCalibrationUnit.tsx` — spatial token calibration HUD.
- `src/LiveTokenPreview.tsx` — sample preview surface (harness mode).
- `src/DxGridVoice.tsx` — clipboard agent-assisted layout description (no in-app AI).
- `src/tokenExport.ts` — read/apply computed CSS; format CSS/JSON/agent prompt; parse pasted JSON.
- `src/harnessStorage.ts` — `localStorage` persistence for the harness snapshot.
- `src/App.tsx` — shell with Harness | Overlay demo modes.

## Safety & Security Constraints

- Zero external API integrations or database connections.
- Purely local component state (plus optional `localStorage`).
- Strictly no private credentials, internal client assets, or hardcoded API keys.
- DX grid voice is clipboard-only — never paste API keys into the demo.
