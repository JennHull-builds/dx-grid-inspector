# Phase A friction log: the overlay in a second app

Written 2026-10-02. This is the input to Phase B (packaging, issue #4).

**What was done.** `INTEGRATION.md` was followed as written, in a second Vite 8 + React 19.2 + Tailwind 4.3 app (not this repo, on a throwaway branch), as a dev-only tool. Then the overlay was used on that app's real main screen at 1280px and 390px: inspect a card and a button, read the tokens, edit, apply to target, copy CSS / JSON / prompt, paste JSON back, read back, and the voice prompt. **Every step worked at both widths, with no console errors.**

**Production check.** A search of the host's production bundle for overlay strings finds nothing. Before the one host change the layout needed (`h-dvh` to `h-full`, item 7), the production JS was byte-identical (`cmp`) to a build without the overlay. After it, the JS is 1 byte larger, which is that class name. Production CSS is 5.4 kB larger (see S6).

## A. INTEGRATION.md was wrong, missing or assumed something

All fixed in `INTEGRATION.md` by the commit that added this file.

| # | Problem | Evidence |
|---|---------|----------|
| 1 | Nothing on keeping the overlay out of production. | New section, `import.meta.env.DEV` plus a lazy import. |
| 2 | The CSS list omitted four classes the components use: `.dx-toggle-active` (the overlay's own toolbar), `.dx-btn-ghost`, `.dx-selection`, `.dx-selection-idle` (the HUD). | `grep` of `dx-*` in the three components against the doc's list. |
| 3 | "Copy the CSS into your global stylesheet" ships the overlay's CSS to production. | Host CSS 20.33 kB to 28.84 kB. Now a dev-only file. |
| 4 | Tailwind was called "recommended". It is required: every class is a Tailwind utility. | Source. |
| 5 | The HUD and voice were "optional, full demo parity". Without the HUD nothing can be read, applied, copied or pasted. The snippet left the HUD as a comment. | Source. |
| 6 | "Copy into `src/`, keep filenames": the host already had its own `TokenCalibrationUnit.tsx`. | One folder now. |
| 7 | Layout was undocumented. The toolbar takes a row, so a root of `h-dvh` overflows by the toolbar's height. | 53 px at 1280px. `h-full` alone made it worse (86 px). A flex slot plus `h-full` gives 0 px at both widths. |
| 8 | `data-dx-inspectable` was undocumented. | Source. |
| 9 | The host's `build` is `vite build` only, so type errors in copied files would not fail it. | Ran `tsc --noEmit` separately. |
| 10 | `parseDesignPropertiesJson` was missing from the export list. | Source. |

## B. Issues in the code (not fixed, Phase B input)

| # | Issue | Evidence |
|---|-------|----------|
| S1 | **Translucent Tailwind v4 colours come back as `oklab(...)`.** `colourToToken` in `tokenExport.ts` handles hex and `rgb()` only. The HUD's border field then rejects the value it just read, the border swatch renders black, and the CSS / JSON exports contain `oklab(...)`. (Corrected in Phase B: the live demo hits it too, on the overlay demo's Border Preset.) | Re-saving the read border gives "Invalid border value". Swatch is black in the 1280px screenshot. |
| S2 | **Apply to target can thicken a border.** `applyDesignPropertiesToElement` sets `border-width: 2px` when the element has no inline border width. | A 1px border became 2px after Apply with no edit. |
| S3 | **The inspect ring is not clipped to the host.** `position: fixed` from `getBoundingClientRect`, so a target taller than the visible host area draws over the HUD. | 390px screenshot. |
| S4 | The visible label "Apply to target" and its `aria-label` ("Apply calibrated tokens to the selected host target") differ, which fails WCAG 2.5.3 Label in Name. Same for the other HUD buttons. | Found because a text-based lookup failed. **Not checked with a screen reader.** |
| S5 | The CSS export uses generic names, `--radius` and `--padding`. | Copy output. Collision with a host's own variables is a risk, not observed. |
| S6 | Production CSS still grows by about 5.4 kB. Tailwind scans the overlay's source and emits the generic utilities only it uses (`flex`, `gap-3`, ...). None are overlay-specific. | 20,338 B to 25,799 B. |
| S7 | **Two Tailwind stylesheets on one page break the host.** A second Tailwind root for the overlay made the host's `hidden lg:flex` panels stay hidden in dev; the second sheet had its own `.hidden`, loaded later. Putting its utilities in a lower cascade layer made it worse. | Screenshots, both attempts. |

## C. What this says about the Phase B decisions

- **Public surface.** The set that is actually usable is `DxHostOverlay`, `TokenCalibrationUnit` (the HUD), `tokenExport` and `types`. `DxGridVoice` is optional.
- **Styling.** Shipping Tailwind source has two known costs: the host must scan the package, and a second Tailwind stylesheet (S7) breaks the host. A prefixed, precompiled CSS file imported only from the dev-only module would avoid both and also remove S6. **That is a hypothesis to prove in the host, not a result.**
- **React range.** Nothing here needed React 19 specifically. The one hook past the basics is `useId` (React 18 and up). **Unverified: React 18 was not tested.**
- **`'use client'`.** Not exercised. The host was Vite.

## D. Not tested

React 18, Next.js, Firefox, Safari, touch devices, the Escape key leaving inspect mode, a screen reader, and following the rewritten `INTEGRATION.md` from a blank app (it was written from what was run, not re-run from scratch).

## E. Phase B, 2026-10-02: what changed

Branch `npm-package`. The package builds with `npm run build:lib`, and its tarball was installed and tested in three hosts:

| Host | Result |
|------|--------|
| The Phase A app (Vite 8, React 19.2, Tailwind 4.3) | Every Phase A step passes at 1280px and 390px, no console errors. Production JS and CSS are **byte-identical** to a build without the inspector. |
| A scratch app with React 18.3, **no Tailwind**, and deliberately hostile global CSS (`button`, `h2`, `p`, `*` rules, a serif font, `box-sizing: content-box`) | Works at both widths. Its types pass with `skipLibCheck: false` against React 18 types. The host's own styles are untouched, and the inspector keeps its look. |
| A scratch Next.js 16.3 app (React 19.3, App Router) | Builds and works with the package rendered from a Server Component. Control: with `'use client'` removed, the build fails. The dev-only pattern in `INTEGRATION.md` shows the inspector in `next dev` and leaves no trace in the production build. |

| Finding | Phase B |
|---------|---------|
| A1–A10 | The copy-in path is replaced by the package and `DxInspector`; `INTEGRATION.md` is rewritten around it. |
| S1 | **Fixed.** `oklab()`, `oklch()` and `color(srgb)` are converted to sRGB; translucent colours keep their alpha as `rgba()`. Matched Chrome's own conversion exactly on 12 samples. The fix also covers a related bug: translucent `rgb()` colours lost their alpha (`rgba(255,255,255,0.08)` became `#FFFFFF`). |
| S2 | **Fixed.** An element with a visible border keeps its width; a 1px border stays 1px. |
| S3 | **Fixed.** The ring is clipped to the host's visible area. In the Phase A repro it now ends at 464px, where the HUD starts, instead of 884px. |
| S4 | **Fixed.** Visible text is the accessible name; the longer explanations moved to `title`. Not checked with a screen reader. |
| S5 | Open. Still documented as a limitation. |
| S6 | **Gone.** The host's Tailwind no longer sees the inspector's source. |
| S7 | **Avoided.** The package ships one stylesheet whose utilities are all prefixed `dx:`, so it has no `.hidden` or other plain class to collide with. |

**The demo still looks the same.** Seven fixed states, pixel-diffed against a baseline taken before any change (two baseline runs matched exactly): five are identical. The other two differ only where S1 and S3 were fixed in the demo itself. A remaining 5-pixel difference at 390px is anti-aliasing on the demo's mode switch, and it also appears between two runs of the same code.
