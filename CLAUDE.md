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

- **Phase B runs on Opus.** Phase A runs on Sonnet 5.5. Before starting B, check the
  model name in your system prompt. If it is not Opus, do not start: tell the owner to
  switch (in the Claude Code chat box, type `/model` and pick Opus), then wait.
- Do not start the next phase until the owner says go. Phase C starts only on the word
  "publish", because `npm publish` is permanent.
- Phase A is done (2026-10-02). Its findings, the input to Phase B, are in
  `docs/phase-a-friction-log.md`.

Delete this section once Phase C ships.

## Gotchas

- **A Tailwind v4 host gets colours back as `oklab(...)`.** `tokenExport.ts` normalises
  only hex and `rgb()`, so a translucent colour (`border-white/5`) passes through raw.
  The HUD's border field then rejects its own value and the swatch renders black. The
  demo never shows it because its colours are solid. Unfixed.
- **`applyDesignPropertiesToElement` sets `border-width: 2px`** when the element has no
  inline border width, so a 1px stylesheet border thickens to 2px. Unfixed.
- **Never give the overlay a second Tailwind stylesheet.** In a host it breaks the host's
  layout (the second sheet's `.hidden` beat `lg:flex`). One Tailwind root, and plain CSS
  for the `.dx-*` rules.
- **`INTEGRATION.md` lists the `.dx-*` rules the components need, and it was wrong once.**
  After changing classes in `DxHostOverlay`, `TokenCalibrationUnit` or `DxGridVoice`, run
  `grep -ohE 'dx-[a-z-]+' src/DxHostOverlay.tsx src/TokenCalibrationUnit.tsx src/DxGridVoice.tsx | sort -u`
  and compare it with that list.

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
