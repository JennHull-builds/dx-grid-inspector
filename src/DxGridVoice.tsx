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

export interface DxGridVoiceProps {
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
    <section data-dx-ui="" className="dx:flex dx:shrink-0 dx:flex-col dx:gap-3 dx:rounded-[16px] dx:border dx:border-white/5 dx:bg-dx-surface-2 dx:p-4">
      <div className="dx:border-b dx:border-white/5 dx:pb-3">
        <h2 className="dx:text-sm dx:font-semibold dx:uppercase dx:tracking-wide dx:text-slate-300">
          DX grid voice
        </h2>
        <p className="dx:mt-1 dx:font-mono dx:text-[10px] dx:leading-relaxed dx:text-slate-500">
          Agent-assisted via clipboard — no in-app AI and never paste API keys
          here.
        </p>
      </div>

      <label className="dx:block dx:font-mono dx:text-xs dx:uppercase dx:tracking-wider dx:text-slate-500">
        Describe layout
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="dx:mt-2 dx:w-full dx:resize-y dx:rounded-[8px] dx:border dx:border-white/10 dx:bg-dx-surface-0 dx:px-3 dx:py-2 dx:font-mono dx:text-xs dx:text-slate-200 dx:outline-none dx:focus:border-dx-accent/50"
          placeholder="Soft card, generous padding, violet border on a dark fill…"
        />
      </label>

      <div className="dx:flex dx:flex-wrap dx:items-center dx:gap-2">
        <button
          type="button"
          onClick={() => void handleCopyPrompt()}
          className="dx-btn-primary dx:min-h-10 dx:px-3"
        >
          Copy prompt for agent
        </button>
        {feedback && (
          <span
            className="dx:font-mono dx:text-xs dx:text-dx-accent"
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
