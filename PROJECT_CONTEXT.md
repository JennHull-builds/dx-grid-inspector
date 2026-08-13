# Project Context: DX Spatial Grid & Token Inspector

## Overview
A lightweight, zero-dependency open-source **local testing harness** built with React 19, TypeScript, Vite, and Tailwind CSS v4. It lets you pick layout nodes, calibrate spatial tokens (padding, radius, fill, border), and preview those tokens on a sample surface in the browser.

This is **not** yet a drop-in overlay for other apps. A visual grid overlay you wrap around host UI is a **future goal** (after this harness can read live CSS and copy tokens out).

## Tech Stack & Tooling
- **Framework:** React 19 + TypeScript (Strict Mode)
- **Build Engine:** Vite (`@tailwindcss/vite` plugin)
- **Styling:** Tailwind CSS v4 (native CSS variables)
- **Target Deployment:** Vercel

## Core Architecture
- `src/types.ts`: Canonical shared model (`NodeCategory`, `NodeStatus`, `DesignProperties`, `DesignNode`).
- `src/GridOverlay.tsx`: Template Grid Manager — node list, category filters, status chips.
- `src/TokenCalibrationUnit.tsx`: Live spatial token calibration HUD with CSS unit sanitisation.
- `src/LiveTokenPreview.tsx`: Sample card + button that apply the selected node's tokens.
- `src/tokenExport.ts`: Read computed CSS from the preview; format CSS/JSON for the clipboard.
- `src/harnessStorage.ts`: localStorage persistence for the harness snapshot.
- `src/App.tsx`: Local testing harness (3-column desktop, tabbed mobile).

## Safety & Security Constraints
- Zero external API integrations or database connections.
- Purely local component state (plus optional localStorage).
- Strictly no private credentials, internal client assets, or hardcoded API keys.
