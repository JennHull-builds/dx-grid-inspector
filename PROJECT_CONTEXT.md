# Project Context: DX Spatial Grid & Token Inspector

## Overview
A lightweight, zero-dependency open-source developer utility built with React 19, TypeScript, Vite, and Tailwind CSS v4. It provides a drop-in visual grid overlay and a spatial token calibration HUD for UI components.

## Tech Stack & Tooling
- **Framework:** React 19 + TypeScript (Strict Mode)
- **Build Engine:** Vite (`@tailwindcss/vite` plugin)
- **Styling:** Tailwind CSS v4 (native CSS variables)
- **Target Deployment:** Vercel

## Core Architecture
- `src/types.ts`: Canonical shared model (`NodeCategory`, `NodeStatus`, `DesignProperties`, `DesignNode`).
- `src/GridOverlay.tsx`: Renders visual layout grids, status indicators, and design node categories.
- `src/TokenCalibrationUnit.tsx`: Handles live token inputs (padding, radius, surface fills, border presets) with CSS unit sanitisation.
- `src/App.tsx`: Local testing harness rendering mock design node state.

## Safety & Security Constraints
- Zero external API integrations or database connections.
- Purely local component state.
- Strictly no private credentials, internal client assets, or hardcoded API keys.