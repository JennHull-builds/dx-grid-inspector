import type { ReactNode } from 'react'

export interface HostDemoSurfaceProps {
  /**
   * Optional tool strip rendered under the host header and above main content
   * (e.g. DxHostOverlay chrome), matching orient → arm tools → inspect flow.
   */
  toolbar?: ReactNode
}

/**
 * Generic in-repo host layout used to prove DxHostOverlay on real UI,
 * not only the three-panel harness sample card.
 */
export function HostDemoSurface({ toolbar }: HostDemoSurfaceProps) {
  return (
    <div className="min-h-full bg-[#0A0A10] text-slate-200">
      <header
        data-dx-inspectable="true"
        className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#13131F] px-6 py-4"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Host demo
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-wide text-slate-100">
            Spatial workspace
          </h1>
        </div>
        <nav className="flex items-center gap-2" aria-label="Host demo navigation">
          <button
            type="button"
            className="min-h-10 rounded-[10px] border border-white/10 bg-transparent px-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-300"
          >
            Library
          </button>
          <button
            type="button"
            className="min-h-10 rounded-[10px] border border-[#A78BFA]/40 bg-[#A78BFA] px-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#0A0A10]"
          >
            New board
          </button>
        </nav>
      </header>

      {toolbar}

      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <article
          data-dx-inspectable="true"
          className="rounded-[16px] border-2 border-[#A78BFA]/50 bg-[#1A1A2B] p-6"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A78BFA]/80">
            Content
          </p>
          <h2 className="mt-2 text-base font-semibold tracking-wide text-slate-100">
            Review layout tokens on a real surface
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Turn on Inspect, click this card or the header, then calibrate radius,
            padding, fill, and border in the HUD. Apply writes tokens back onto
            the selected host element only.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-10 rounded-[8px] border border-[#A78BFA] bg-[#A78BFA] px-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#0A0A10]"
            >
              Continue
            </button>
            <button
              type="button"
              className="min-h-10 rounded-[8px] border border-[#A78BFA]/50 bg-transparent px-4 font-mono text-xs font-semibold uppercase tracking-wider text-slate-200"
            >
              Dismiss
            </button>
          </div>
        </article>

        <section
          data-dx-inspectable="true"
          className="rounded-[12px] border border-white/10 bg-[#13131F] p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Secondary panel
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            A quieter surface for comparing how the same four tokens feel on a
            denser block. Inspect either panel independently.
          </p>
        </section>
      </main>
    </div>
  )
}

export default HostDemoSurface
