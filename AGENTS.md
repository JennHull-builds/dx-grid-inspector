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

## Agent-agnostic

dx-grid works with whichever coding agent the user chooses (decided by the maintainer, 2026-10-25). Its output is plain text any agent can read. Never build a feature that works with only one agent or one model; where an integration is needed, use an open standard (MCP, or an AGENTS.md-style instruction file). The no-in-app-AI rule is part of what keeps it this way.

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

## Releasing to npm

Published as `dx-grid-inspector` (0.1.0 on 2026-10-02; 0.1.1, docs only, on 2026-10-03). A published version cannot be
changed, so a release only happens when the maintainer asks for one.

- **`npm publish` needs a one-time code from the maintainer.** Run `npm publish --dry-run` yourself,
  then ask the maintainer to run `npm publish` in their own terminal. `prepack` runs `build:lib`, so the
  `dx:` check and the build happen on every publish.
- **The npm page shows the README as it was published.** README edits on `main` reach
  npm only with the next version.
- **A publish failing with `E404 Not Found - PUT` means logged out, not a missing
  package.** The npm login in `~/.npmrc` expires; npm answers an unauthenticated publish
  with 404. Confirm with `npm whoami` (401 = logged out), then the maintainer runs `npm login` and
  `npm publish` again. Seen 2026-10-03 on 0.1.1, one day after 0.1.0 published fine.
- **A successful publish ends `PUT 202` and "being processed"**, and the registry can
  take a few minutes to show it. Check `dist-tags.latest` before calling it live.
- **Tag each release `vX.Y.Z` and push the tag** (`v0.1.0`, `v0.1.1` exist). Docs-only
  changes ship as a patch.

## Gotchas

- **Every class in the library components must be `dx:`-prefixed.** `DxHostOverlay`,
  `TokenCalibrationUnit`, `DxGridVoice`, `DxInspector` and `picker/ColourPicker` are styled by
  `src/lib/styles.css`, which only generates `dx:` classes. An unprefixed class still looks
  right in the demo, because the demo's own Tailwind generates it, and renders unstyled in
  every host. `npm run build:lib` runs `scripts/check-dx-prefix.mjs` first and fails on one.
- **The `.dx-*` component rules live in two places**: `src/index.css` (the demo) and
  `src/lib/styles.css` (the package, using `--dx-ui-*` variables). Change both.
- **The package CSS is unlayered and its reset is scoped to `[data-dx-ui]`.** Unlayered so a
  host's element rules (`button {}`, `h2 {}`) cannot restyle the inspector; scoped so the inspector never restyles the
  host. Any new root element of the inspector's own UI needs `data-dx-ui=""`.
- **`DxInspector` paints only the HUD column.** A background on its root covers a light
  host's own page: it did once, and only a light host shows it (the demo and the Phase A
  app are dark). Test layout changes in a light host too.
- **Colours: `tokenExport.ts` converts `oklab()` / `oklch()` / `color(srgb)` itself**, because
  Tailwind v4 colours compute to those. The OKLab to sRGB maths lives in
  `src/picker/colourEngine.ts` (`oklabToSrgbBytes`) and `tokenExport.ts` imports it. It matched
  Chrome's own conversion exactly on 12 samples, and again on 20 colours when it moved there. If you change it,
  check it against Chrome again rather than by eye.
- **Testing a tarball:** when the tarball is unchanged, npm skips reinstalling it even if
  the installed copy was edited (seen with `'use client'` stripped by hand). Delete
  `node_modules/<package>` before reinstalling, and restart Vite, which caches package CSS.
- **Apply keeps no baseline.** `applyDesignPropertiesToElement` compares the HUD with the
  element's computed values and writes only the fields that differ, so a value set back
  to what it was is still written. Do not add a "last read" copy to decide what changed;
  it goes stale the moment something else writes the element.
- **Escape after a nudge restores the target's whole `style` attribute**, taken when the
  field edit began (`useOverlayTarget`). A new way of writing to the target during an
  edit would be wiped by it, so write through `onFieldEdit`. The colour picker writes this way too.
- **The selection ring follows the target through a `MutationObserver` on its `style`
  attribute, and measures again on its `transitionend` / `transitioncancel`.** A CSS
  transition settles on the right size but is not tracked frame by frame. A change that
  arrives any other way (a class swap, a sibling resizing) is not followed until a scroll
  or resize.
- **`rem` survives a save as the string `"1.5rem"`; `%`, `vh`, `vw` and `em` still reduce to
  their number and read as px.** That is how it was before 0.2 and is unfixed.
- **The agent prompt's shape text still lists four fields**, while its "Current tokens"
  JSON now carries `gap` and `margin`. The prompt wording was left alone on purpose.
- **Below `lg`, the demo's Overlay `<aside>` is capped at `max-h-[45dvh]`, like
  `DxInspector`'s HUD.** Without the cap the aside takes its full content height and the
  host area, a `flex-1` with `min-h-0`, collapses to its 2px border once an element is
  selected (seen at 390px before 0.2.0, fixed 2026-10-30). Keep both caps if either layout changes.
- **The Harness preview card animates for 200ms.** A computed style read straight after a
  nudge is mid-transition (12.05px for 14px). Wait before measuring it.
- **Apply closes an open field edit without telling the host.** This includes an open colour
  picker: Apply closes it and what it last wrote stays on the element. `handleApplyToTarget` clears
  the editing state but not `editStartRef`, and `onFieldEdit` gets no `commit` or `revert`,
  so `styleBeforeEdit` in `useOverlayTarget` keeps the snapshot from before the nudge until
  the next field edit starts. Checked 2026-10-25: Apply then Escape does not wipe the Apply
  today, because the field's input is gone and the next `start` replaces the snapshot. A new
  Escape handler, or anything that restores `styleBeforeEdit` outside an open edit, would put
  back the pre-Apply `style` and wipe it.
- **A negative margin (`-8px`) reads into the HUD, but the arrow keys ignore it and Enter
  rejects it as "Invalid layout size".** `nudgeLayoutText` and `parseLayoutValue` only accept
  numbers from 0 up. Seen 2026-10-25 on `margin: -8px 0 0`: the field opens at `-8px`, ArrowUp
  leaves it there, and typing `-8` then Enter shows the error. For 0.3.
- **Put injected test fixtures in the host demo's own `<main>`**, the parent of
  `article[data-dx-inspectable]`. `document.querySelector('main')` finds the demo page's
  layout, outside the inspector, so a click there selects nothing and a check silently tests
  the wrong element.
- **A new library component file goes in two lists.** Add it to `FILES` in
  `scripts/check-dx-prefix.mjs` and to an `@source` line in `src/lib/styles.css`. Without the
  second, the package stylesheet never generates its `dx:` classes, and the component renders
  unstyled in every host while the demo looks right.
- **The package ships no list reset.** A `<ul>` in a library component shows bullets unless it
  has `dx:list-none` (they appeared as stray dots beside the page-token chips).
- **`src/picker/colourEngine.ts` imports nothing**, so it can move into its own package
  unchanged. Keep DOM work (page tokens, the canvas, the eyedropper) out of it. `npm test` runs
  `src/picker/*.test.ts` with Node's built-in runner, which runs TypeScript directly, so a file
  a test imports must name its siblings with a `.ts` extension. Test files are excluded from
  `tsconfig.app.json`.
- **The `.d.ts` files in `dist-lib/types/picker/` import with `.ts` paths.** No public type
  reaches them, so a consumer never loads them. A type-check of the built package as a
  consumer, with library checking on, passed on TypeScript 6.0.2 (2026-10-30); other versions
  were not tried.
- **Page tokens skip every `--dx-` and `--tw-` variable.** The package stylesheet declares
  `--dx-ui-*` and Tailwind's `--dx-color-*` theme colours on the host's `:root`, so a reader
  that skipped only `--dx-ui-*` would list ten extra "tokens" in a light host. Tailwind v4 emits
  only the theme colours a page's classes use (the demo shows `slate` 100 to 600 and `white`,
  not the whole palette). A stylesheet from another origin cannot be read.
- **Read from target flattens a colour outside sRGB.** `colourToToken` converts to sRGB, so a
  colour the picker wrote as `oklch()` comes back as a clipped hex (checked 2026-10-30:
  `oklch(0.8 0.27 150)` read back as `#00EA4F` while the element kept the `oklch()` value).
  Unfixed, because changing it changes the colour format existing users see. For 0.3.
- **The picker keeps its own OKLCH colour while you drag**, so a grey written as hex does not
  lose its hue. It resyncs from its `value` prop only when that differs from the last value it
  sent, so a host that rewrites the value on every change would pull the picker back.
- **The colour area's canvas is drawn at its size on screen times `devicePixelRatio`**, and it
  sits `absolute inset-0` inside its 4:3 box. A fixed 288 by 216 canvas stretched to fit made
  every edge and line visibly stepped on a Retina screen (the maintainer called it broken, 2026-11-09).
  Without the absolute position, setting the canvas's pixel size changes its own layout height,
  and the area drifted off 4:3 between repaints. Contrast lines are stroked as canvas paths from
  `contrastPaths`, never stamped as pixels, and edge pixels are sampled 16 times for smoothness.
  Unit tests cannot see any of this: check it in a screenshot at device scale 2.
- **Contrast figures:** the Harness passes fixed colours (text `#E2E8F0` on `#13131F`) because
  its sample card picks its own ink from the fill, so its figures are indicative. The overlay
  reads the target's computed text colour and the first opaque ancestor background. WCAG 2
  only; a colour outside sRGB is measured on its sRGB hex.
- **Muted text is `text-dx-muted` (`#74849c`), not `text-slate-500`.** Tailwind's slate-500 is a
  separate colour and fell short of 4.5:1 on the HUD's surfaces (3.9 to 4.1:1); the muted
  value reaches 4.5:1 on all four (5.19, 5.01, 4.84 and 4.50 on surfaces 0 to 3). Changing it
  needs both stylesheets and a re-check against surface-3, which is the tightest. Do not fade
  muted text with `opacity` (the delete button did, at 2.1:1), and keep `text-dx-accent` labels
  at 85% or more on surface-3 (80% measured 4.49:1).
- **Focus is one unlayered rule in each stylesheet**, a solid 2px accent ring with a 2px
  offset on every focusable control (the package version is scoped to `[data-dx-ui]`). It
  beats the utilities' `outline-none`, so a text input no longer shows only its 50% accent
  border (2.4:1 measured). A scroll container clips a ring at its edge: pad the container by
  4px as the picker's token list does. The Template Grid Manager's first node row is still
  clipped at its top edge.

- **The demo page never scrolls vertically** (the maintainer, 2026-11-09). The root is `h-dvh` with
  `overflow-hidden`; header and footer are `shrink-0` and the panels scroll inside. After any change to
  the site chrome, check `scrollHeight === innerHeight` at 1440x900, 1280x720, 1024x768, 390x844 and 390x667.
- **The site chrome lives in `src/site/`** (mark, header lockup, footer) and is demo only: plain Tailwind,
  no `dx:` prefix, never imported by `src/lib/entry.ts`. Its CSS in `index.css` is unlayered, so it beats
  Tailwind utilities: never set `display` in a `site-*` class, or `hidden`/`sm:hidden` on that element
  stops working (both phone and desktop marks showed at once until this was moved into classes).

- **The footer's Motion switch sets `data-motion` on `<html>`** (`full` or `reduce`), saved in
  localStorage as `dx-motion`. A script in `index.html` applies it before first paint, defaulting to
  the system setting. `reduce` stops every animation and transition on the page, the HUD's too. A new
  animation needs no extra work, but a `site-*` one that should rest at a designed frame needs its own
  `:root[data-motion="reduce"]` rule (see `.site-hairline`). One switch until there is a second setting;
  then it becomes a settings button (the maintainer, 2026-11-09).

## Code standards

Carried over from `.cursorrules` on 2026-09-10.

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
