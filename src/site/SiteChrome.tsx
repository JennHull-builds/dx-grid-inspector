import { useEffect, useId, useRef, useState } from 'react'

/*
  The demo site's own chrome: the mark, the header lockup and the footer. None of this ships in
  the npm package (src/lib/entry.ts never imports it), so it uses plain Tailwind classes, not dx:.
*/

declare const __DX_VERSION__: string
const VERSION = typeof __DX_VERSION__ === 'string' ? __DX_VERSION__ : ''

const REPO = 'https://github.com/JennHull-builds/dx-grid-inspector'
const INSTALL = 'npm install -D dx-grid-inspector'

/**
 * The mark: a tile holding a 2 by 2 grid, with one cell picked out by the inspector's corner
 * brackets. When `animated`, the pick glides from cell to cell and the brackets lock on at each
 * stop. Under reduced motion it holds still on the first cell.
 */
export function DxMark({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  const id = useId().replace(/:/g, '')
  const cells = [
    [9.5, 9.5],
    [21.5, 9.5],
    [9.5, 21.5],
    [21.5, 21.5],
  ]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2650" />
          <stop offset="1" stopColor="#14121f" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4b5fd" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`${id}-cell`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6c9ff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill={`url(#${id}-tile)`} />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="11"
        fill="none"
        stroke={`url(#${id}-edge)`}
      />
      {cells.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x + 0.5}
          y={y + 0.5}
          width="8"
          height="8"
          rx="2.25"
          fill="#ffffff"
          fillOpacity="0.1"
          stroke="#ffffff"
          strokeOpacity="0.16"
        />
      ))}
      <g className={animated ? 'site-mark-cursor' : undefined}>
        <rect x="9.5" y="9.5" width="9" height="9" rx="2.5" fill="#a78bfa" opacity="0.5" filter={`url(#${id}-glow)`} />
        <rect x="9.5" y="9.5" width="9" height="9" rx="2.5" fill={`url(#${id}-cell)`} />
        <path
          className={animated ? 'site-mark-brackets' : undefined}
          d="M6.5 10V7.5a1 1 0 0 1 1-1H10 M18 6.5h2.5a1 1 0 0 1 1 1V10 M21.5 18v2.5a1 1 0 0 1-1 1H18 M10 21.5H7.5a1 1 0 0 1-1-1V18"
          fill="none"
          stroke="#5eead4"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

/** The header lockup: mark, name, version and what it is. */
export function SiteBrand() {
  return (
    <a
      href={REPO}
      target="_blank"
      rel="noopener noreferrer"
      className="site-brand group flex min-w-0 items-center gap-3 rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-dx-accent focus-visible:ring-offset-4 focus-visible:ring-offset-dx-surface-0"
      aria-label={`DX Grid, spatial grid and token inspector${VERSION ? `, version ${VERSION}` : ''}, on GitHub`}
    >
      <span className="site-rise site-brand-mark inline-flex sm:hidden" style={{ animationDelay: '0ms' }}>
        <DxMark size={40} animated />
      </span>
      <span className="site-rise site-brand-mark hidden sm:inline-flex" style={{ animationDelay: '0ms' }}>
        <DxMark size={44} animated />
      </span>
      <span className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
        <span className="site-rise flex items-center gap-2.5" style={{ animationDelay: '90ms' }}>
          <span className="dx-wordmark text-[18px] leading-none font-semibold whitespace-nowrap sm:text-[21px] tracking-[-0.025em] text-slate-50">
            DX Grid
          </span>
          {VERSION && (
            <span className="hidden rounded-full border border-dx-accent/30 sm:inline bg-dx-accent/10 px-2 py-[3px] font-mono text-[10px] leading-none font-medium text-dx-accent">
              v{VERSION}
            </span>
          )}
        </span>
        <span
          className="site-rise block font-mono text-[9px] leading-[1.45] font-medium tracking-[0.12em] text-dx-muted uppercase sm:truncate sm:text-[10px] sm:leading-none sm:tracking-[0.18em]"
          style={{ animationDelay: '160ms' }}
        >
          Spatial grid &amp;<br className="sm:hidden" /> token inspector
        </span>
      </span>
    </a>
  )
}

/** The one-line how-to that sits beside the lockup on wide screens. */
export function SiteHint() {
  return (
    <div
      className="site-rise hidden min-w-0 items-center gap-5 lg:flex"
      style={{ animationDelay: '240ms' }}
    >
      <span className="h-10 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent" aria-hidden="true" />
      <p className="max-w-[46ch] text-[13px] leading-relaxed text-slate-400">
        Start in <span className="font-medium text-dx-secondary">Overlay demo</span> to inspect a real
        UI, or use <span className="font-medium text-slate-200">Harness</span> to calibrate mock nodes.
      </p>
    </div>
  )
}

/* ---------- Icons ---------- */

const GithubIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
)

const NpmIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor">
    <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
  </svg>
)

const DocIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 1.75h5.25L12.5 5v8.25a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1V2.75a1 1 0 0 1 1-1z" />
    <path d="M9 1.75V5.25h3.5M5.5 8.5h5M5.5 11h3.5" />
  </svg>
)

const CopyIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <rect x="5.25" y="5.25" width="8.5" height="8.5" rx="1.75" />
    <path d="M10.75 5.25V3.5a1.25 1.25 0 0 0-1.25-1.25H3.5A1.25 1.25 0 0 0 2.25 3.5v6a1.25 1.25 0 0 0 1.25 1.25h1.75" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path className="site-check" d="M3 8.5l3.2 3L13 4.5" />
  </svg>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 11L11 5M6 5h5v5" />
  </svg>
)

/* ---------- Footer ---------- */

function InstallChip() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL)
      setState('copied')
    } catch {
      setState('failed')
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1800)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`site-install group hidden items-center gap-2.5 rounded-[9px] border py-1 pr-1.5 pl-3 font-mono text-[11px] transition-colors md:inline-flex ${
        state === 'copied'
          ? 'border-dx-secondary/40 bg-dx-secondary/10 text-dx-secondary'
          : 'border-white/8 bg-white/[0.03] text-slate-300 hover:border-dx-accent/40 hover:bg-dx-accent/[0.06]'
      }`}
      aria-label={`Copy the install command: ${INSTALL}`}
    >
      <span className="text-dx-muted select-none" aria-hidden="true">
        $
      </span>
      <span>{INSTALL}</span>
      <span
        className={`grid size-6 place-items-center rounded-[6px] transition-colors ${
          state === 'copied' ? 'text-dx-secondary' : 'text-dx-muted group-hover:text-dx-accent'
        }`}
      >
        {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
      </span>
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed. Select the command instead.' : ''}
      </span>
    </button>
  )
}

const MotionIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M1.5 8c1.3-2.6 2.6-2.6 3.9 0s2.6 2.6 3.9 0 2.6-2.6 3.9 0" />
  </svg>
)

/** Whether the page animates. Read from <html data-motion>, which index.html sets before paint. */
function MotionSwitch() {
  const [motion, setMotion] = useState(
    () => typeof document === 'undefined' || document.documentElement.dataset.motion !== 'reduce',
  )
  const toggle = () => {
    const next = !motion
    setMotion(next)
    document.documentElement.dataset.motion = next ? 'full' : 'reduce'
    try {
      localStorage.setItem('dx-motion', next ? 'full' : 'reduce')
    } catch {
      /* Private windows can refuse storage; the switch still works for this visit. */
    }
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={motion}
      aria-label="Motion"
      title={motion ? 'Animations on. Switch off to reduce motion.' : 'Animations off. Switch on to bring them back.'}
      onClick={toggle}
      className="site-switch group inline-flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-dx-muted transition-colors hover:text-slate-100 focus-visible:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-accent"
    >
      <span className={`inline-flex transition-colors ${motion ? 'text-dx-secondary' : ''}`}>
        <MotionIcon />
      </span>
      <span className="site-switch-track" aria-hidden="true">
        <span className="site-switch-knob" />
      </span>
    </button>
  )
}

const linkClass =
  'site-link group inline-flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-dx-muted transition-colors hover:text-slate-100 focus-visible:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-accent'

export function SiteFooter() {
  return (
    <footer className="site-footer relative flex shrink-0 items-center justify-between gap-4 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] font-mono text-[11px] sm:px-4 lg:px-6 lg:py-2.5">
      <span className="site-hairline site-hairline-top" aria-hidden="true" />
      <div className="hidden min-w-0 items-center gap-4 md:flex">
        <InstallChip />
        <span className="hidden items-center gap-2 text-dx-muted lg:inline-flex">
          <span className="size-1.5 rounded-full bg-dx-secondary/70" aria-hidden="true" />
          MIT licensed · No AI inside
        </span>
      </div>
      <div className="-mx-2 flex w-full items-center justify-between gap-1 sm:gap-2 md:mx-0 md:-mr-2 md:w-auto md:justify-end">
        <span className="flex items-center gap-1 sm:gap-2">
          <MotionSwitch />
          <span className="mx-0.5 h-4 w-px bg-white/10 sm:mx-1" aria-hidden="true" />
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Project links">
            <a href={REPO} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="GitHub">
              <span className="site-link-icon"><GithubIcon /></span>
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a href={`${REPO}/blob/main/README.md`} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="README">
              <span className="site-link-icon"><DocIcon /></span>
              <span className="hidden sm:inline">README</span>
            </a>
            <a href="https://www.npmjs.com/package/dx-grid-inspector" target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="npm">
              <span className="site-link-icon"><NpmIcon /></span>
              <span className="hidden sm:inline">npm</span>
            </a>
          </nav>
        </span>
        <span className="mx-1 hidden h-4 w-px bg-white/10 md:block" aria-hidden="true" />
        {/* No noreferrer here, so the portfolio's analytics can see the visit came from this demo. */}
        <a href="https://jenniferhull.co.za" target="_blank" rel="noopener" className={`${linkClass} site-byline`}>
          <span>
            Built by <span className="text-slate-200 transition-colors group-hover:text-dx-accent">Jennifer Hull</span>
          </span>
          <span className="site-byline-arrow text-dx-accent"><ArrowIcon /></span>
        </a>
      </div>
    </footer>
  )
}
