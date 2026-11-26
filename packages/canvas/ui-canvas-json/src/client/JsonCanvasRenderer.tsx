/**
 * Reference Canvas renderer: a structured JSON viewer and editor. It
 * demonstrates renderer registration from an independent plugin, loading
 * persistent state, updating it through user interaction, reflecting
 * agent-initiated updates, and disposal. It is not a production editor.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {} from '@deepseek-ai/dsh-client-ui-canvas/client'

/** Text for the reference renderer; a production renderer would localize. */
const LABELS = {
  title: 'JSON content',
  save: 'Save',
  invalid: 'Not valid JSON.',
  conflict: 'This Canvas changed elsewhere; reload and try again.',
  empty: 'No content yet.',
} as const

/**
 * Render and edit the Canvas's opaque state as JSON. The state is read from the
 * `record` prop and written back through the validated `update` operation, so
 * the host remains the single authoritative owner.
 * @param props - the Canvas host's renderer share.
 * @returns a JSON textarea with a save action.
 */
export function JsonCanvasRenderer({ canvasId, record, update }: PropsRuntime<'canvas.renderer'>) {
  const [draft, setDraft] = useState(() => stringify(record.state))
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // An agent or another Session may have changed the state: re-sync the draft
  // whenever the authoritative revision advances.
  useEffect(() => {
    setDraft(stringify(record.state))
    setMessage(null)
  }, [record.revision, record.state])

  const save = async (): Promise<void> => {
    let parsed: JsonValue
    try {
      parsed = JSON.parse(draft) as JsonValue
    } catch {
      setMessage(LABELS.invalid)
      return
    }
    setSaving(true)
    try {
      const result = await update({ id: canvasId, patch: { state: parsed }, expectedRevision: record.revision })
      if ('code' in result) {
        setMessage(result.code === 'canvas_conflict' ? LABELS.conflict : LABELS.invalid)
      } else {
        setMessage(null)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={title}>{LABELS.title}</span>
        <button type="button" style={button} disabled={saving} onClick={() => { void save() }}>
          {LABELS.save}
        </button>
        {message !== null && <span style={messageStyle}>{message}</span>}
      </div>
      <textarea
        value={draft}
        spellCheck={false}
        onChange={(event) => { setDraft(event.target.value) }}
        style={{ ...textarea, flex: 1 }}
        aria-label={LABELS.title}
      />
    </div>
  )
}

function stringify(value: unknown): string {
  if (value === undefined) return LABELS.empty
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return LABELS.empty
  }
}

const title: CSSProperties = { color: 'var(--dsw-alias-label-primary)', fontWeight: 600 }
const button: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-button-ghost-active-fill)',
  border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
}
const messageStyle: CSSProperties = { color: 'var(--dsw-alias-state-error-primary)', fontSize: 12 }
const textarea: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
  border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: 10,
  fontFamily: 'monospace', resize: 'none', minHeight: 120,
}
