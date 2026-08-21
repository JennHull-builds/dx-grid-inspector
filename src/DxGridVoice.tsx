import { useEffect, useRef, useState } from 'react'
import {
  copyTextToClipboard,
  formatTokensAsAgentPrompt,
} from './tokenExport'
import type { DesignProperties } from './types'

const FEEDBACK_MS = 2000

const EMPTY_PROPERTIES: DesignProperties = {
  radius: 12,
  padding: 16,
  bgPreset: '#1A1A2B',
  borderPreset: '#A78BFA',
}

interface DxGridVoiceProps {
  /** Current tokens included in the exported agent prompt. */
  properties?: DesignProperties
  /** Optional node label for the prompt context. */
  nodeName?: string
}

/**
 * Clipboard “DX grid voice”: describe a layout in natural language, copy a
 * prompt for an external agent, then paste DesignProperties JSON back in the HUD.
 * Does not call external APIs or accept API keys.
 */
export function DxGridVoice({
  properties = EMPTY_PROPERTIES,
  nodeName,
}: DxGridVoiceProps) {
  const [description, setDescription] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current != null) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

  const announce = (message: string) => {
    setFeedback(message)
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current)
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null)
      feedbackTimerRef.current = null
    }, FEEDBACK_MS)
  }

  const handleCopyPrompt = async () => {
    const payload = formatTokensAsAgentPrompt(properties, {
      nodeName,
      layoutDescription: description,
    })
    const ok = await copyTextToClipboard(payload)
    announce(ok ? 'Copied voice prompt' : 'Copy failed')
  }

  return (
    <section className="flex shrink-0 flex-col gap-3 rounded-[16px] border border-white/5 bg-[#13131F] p-4">
      <div className="border-b border-white/5 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          DX grid voice
        </h2>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500">
          Agent-assisted via clipboard — no in-app AI and never paste API keys
          here.
        </p>
      </div>

      <label className="block font-mono text-xs uppercase tracking-wider text-slate-500">
        Describe layout
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#0A0A10] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-[#A78BFA]/50"
          placeholder="Soft card, generous padding, violet border on a dark fill…"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopyPrompt()}
          className="min-h-10 rounded-[8px] border border-[#A78BFA]/40 bg-[#A78BFA]/15 px-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#A78BFA] hover:bg-[#A78BFA]/25"
        >
          Copy prompt for agent
        </button>
        {feedback && (
          <span
            className="font-mono text-xs text-[#A78BFA]"
            role="status"
            aria-live="polite"
          >
            {feedback}
          </span>
        )}
      </div>
    </section>
  )
}

export default DxGridVoice
