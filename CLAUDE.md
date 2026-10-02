# dx-grid-inspector

Open-source (MIT) design-token inspector and drop-in host overlay. React 19, Vite,
Tailwind v4. Live at dx-grid-inspector.vercel.app.

**Shipped and public.** This is the flagship public dev-tool proof, cited in the
capability ledger under open-source DX tooling. Changes here affect a public claim, so
do not break the demo or `INTEGRATION.md`.

## The hard architectural rule

**No in-app LLM.** Voice is clipboard-assisted only: the textarea compiles a prompt and
copies it, it never calls a model. This is deliberate and it is a selling point — the
blog post and README both cite it as an example of knowing when AI is the wrong tool.

Do not add a model call, an API key, or a backend. If a feature seems to need one, that
is the signal to reconsider the feature.

## Visual system

Soft Bento: 16px radius, ambient glow, deep space canvas, dark only. **Not brutalist
CLI** — that belongs to nil-ds and the portfolio. The two systems stay separate on
purpose.

## Lineage worth knowing

This is the matured fork of `mothership-console`. `TokenCalibrationUnit.tsx`, the grid
overlay and the `DesignNode` / `DesignProperties` types exist in both. This one is
ahead. Do not sync back to the console, which is parked.

## Deployment

Vercel is live. There is also a Cloud Run path — `Dockerfile`, `nginx.conf.template`,
`deploy.sh` targeting project `dx-grid-sandbox-1`. Per `DEPLOYMENT_TODO.md` that GCP
project was never created and the deploy has never run. Treat it as untested.

## npm package work (issue #4): phase gates

Three phases, with a stop after each: **A** prove the overlay in one real host app,
**B** package it and test the tarball in that host, **C** `npm publish`.

- Phase A is done (2026-10-02). Phase B is done (2026-10-02) on branch `npm-package`, not
  merged. Both are written up in `docs/phase-a-friction-log.md` (Phase B is section E).
- **Phase C starts only on the word "publish"**, because `npm publish` is permanent. It
  needs the owner to pick the package name and log in to npm first. `"private": true` in
  `package.json` makes `npm publish` refuse until then; removing it is part of Phase C.
- After publishing: rewrite the README's integration section around the install (it still
  says to copy files, and "npm package later"), drop the "Not on npm yet" note from
  `INTEGRATION.md`, merge `npm-package`, close issue #4.

Delete this section once Phase C ships.

## Gotchas

- **Every class in the library components must be `dx:`-prefixed.** `DxHostOverlay`,
  `TokenCalibrationUnit`, `DxGridVoice` and `DxInspector` are styled by
  `src/lib/styles.css`, which only generates `dx:` classes. An unprefixed class still looks
  right in the demo, because the demo's own Tailwind generates it, and renders unstyled in
  every host. `npm run build:lib` runs `scripts/check-dx-prefix.mjs` first and fails on one.
- **The `.dx-*` component rules live in two places**: `src/index.css` (the demo) and
  `src/lib/styles.css` (the package, using `--dx-ui-*` variables). Change both.
- **The package CSS is unlayered and its reset is scoped to `[data-dx-ui]`.** Unlayered so a
  host's element rules (`button {}`, `h2 {}`) cannot restyle the inspector; scoped so the inspector never restyles the
  host. Any new root element of the inspector's own UI needs `data-dx-ui=""`.
- **Colours: `tokenExport.ts` converts `oklab()` / `oklch()` / `color(srgb)` itself**, because
  Tailwind v4 colours compute to those. It matched Chrome's own conversion exactly on 12
  samples. If you change it, check it against Chrome again rather than by eye.
- **Testing a tarball:** when the tarball is unchanged, npm skips reinstalling it even if
  the installed copy was edited (seen with `'use client'` stripped by hand). Delete
  `node_modules/<package>` before reinstalling, and restart Vite, which caches package CSS.

## Code standards

Carried over from `.cursorrules` on 2026-09-10 when Jen moved to Claude Code.

- TypeScript strict mode. Every imported component has an explicit props interface.
- Tailwind v4 via `@import "tailwindcss";` in `src/index.css`, with `@tailwindcss/vite`
  in `vite.config.ts`.
- Clean, modular, self-contained components. No broken relative imports.
- JSDoc on public component APIs — this is a public OSS repo and the docs are the
  product surface.
- **Repo hygiene is a public claim here.** Never reference local paths, private keys, or
  internal environment variables in generated code.
- Imperative commit messages: "Fix layout token calculation", "Add Grid overlay toggle".

## Before committing

```bash
npm run lint
npm run build
```
