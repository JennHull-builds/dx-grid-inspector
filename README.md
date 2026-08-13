# DX Spatial Grid & Token Inspector

> A lightweight developer experience (DX) demo for React 19 and Tailwind CSS v4. Inspect design nodes, filter by category, and calibrate spatial tokens live in the browser.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)

**Live demo:** [dx-grid-inspector.vercel.app](https://dx-grid-inspector.vercel.app)

---

## Overview

The **DX Spatial Grid & Token Inspector** is a small, self-contained harness for exploring layout-oriented design nodes and editing spatial tokens (padding, border radius, surface colours, and border presets) on screen.

Built as an open-source learning and portfolio project — iterating in public. Components are modular and easy to copy into your own React app; an installable npm package may come later.

---

## Features

- **Template Grid Manager:** Categorise, filter, and select layout nodes (Display, Navigation, Content, Functional). Click a status chip to toggle Ready / In Progress without changing the selected row.
- **Token Calibration Unit:** Edit corner radii, padding, surface colours, and border styles with inline validation.
- **Live Token Preview:** Sample surface in the harness updates as you calibrate radius, padding, and colours.
- **Built-in Sanitisation:** Parses CSS layout units (`px`, `rem`, `%`, `vh`, `vw`) and validates hex / rgba colour input.
- **Local Test Harness:** [`src/App.tsx`](src/App.tsx) wires the panels together with mock nodes so you can try everything immediately.
- **Tailwind CSS v4 Ready:** Uses `@tailwindcss/vite` and native CSS variable architecture.
- **Strict TypeScript:** Explicit prop interfaces and self-contained models.

---

## Quick Start

### Prerequisites

- **Node.js** v18.0.0 or higher
- **npm** or **pnpm**

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/JennHull-builds/dx-grid-inspector.git
   cd dx-grid-inspector
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the local development server:**

   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173` to view the live harness.

---

## Usage Example

Embed the panels in your own React layout:

```tsx
import { useState } from 'react'
import {
  TemplateGridManager,
  type DesignNode,
  type NodeStatus,
} from './GridOverlay'
import {
  TokenCalibrationUnit,
  type DesignProperties,
} from './TokenCalibrationUnit'

export default function InspectorHarness() {
  const [nodes, setNodes] = useState<DesignNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null

  const handleUpdateProps = (id: string, newProps: DesignProperties) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, properties: newProps } : node,
      ),
    )
  }

  const handleUpdateStatus = (id: string, status: NodeStatus) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === id ? { ...node, status } : node)),
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[#0A0A12] min-h-screen">
      <TemplateGridManager
        nodes={nodes}
        selectedNodeId={selectedId}
        onSelectNode={setSelectedId}
        onAddNode={() => {
          /* Add node logic */
        }}
        onPurgeNode={(id) =>
          setNodes((prev) => prev.filter((n) => n.id !== id))
        }
        onUpdateStatus={handleUpdateStatus}
      />
      <TokenCalibrationUnit
        selectedNode={selectedNode}
        onUpdateProperties={handleUpdateProps}
      />
    </div>
  )
}
```

---

## Tech Stack

| Technology | Role |
| --- | --- |
| **React 19** | UI Library |
| **TypeScript** | Type Safety & Interfaces |
| **Tailwind CSS v4** | Utility Styling & CSS Variables |
| **Vite** | Build Tooling |
| **Vercel** | Demo Hosting |

---

## Project Structure

```text
dx-grid-inspector/
├── src/
│   ├── GridOverlay.tsx            # Template grid manager & design node types
│   ├── TokenCalibrationUnit.tsx   # Live spatial token calibration HUD
│   ├── App.tsx                    # Interactive local test harness
│   ├── main.tsx                   # Application entry point
│   └── index.css                  # Tailwind CSS v4 setup
├── PROJECT_CONTEXT.md             # AI agent project context
├── .cursorrules                   # Code style & open-source guardrails
├── LICENSE                        # MIT
├── package.json
└── README.md
```

---

## Roadmap

Tracked as GitHub issues. Near-term:

- [x] Live token preview surface in the harness
- [ ] Shared `DesignNode` types across components ([#3](https://github.com/JennHull-builds/dx-grid-inspector/issues/3))
- [ ] Optional publishable npm package later ([#4](https://github.com/JennHull-builds/dx-grid-inspector/issues/4))

---

## Contributing

Contributions, issues, and feature requests are welcome. Check the [issues page](https://github.com/JennHull-builds/dx-grid-inspector/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.
