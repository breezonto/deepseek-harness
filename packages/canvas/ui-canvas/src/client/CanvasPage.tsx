/**
 * Canvas management page: the global panel that hosts independently registered
 * renderers. It owns the Canvas catalog, selection, metadata, and management
 * actions; renderer-specific presentation lives in `canvas.renderer` entries
 * mounted by renderer id. This page never interprets the renderer state.
 */
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  CanvasCreateRequest, CanvasDeleteResult, CanvasGetResult, CanvasId, CanvasRecord, CanvasRendererDescriptor,
  CanvasRendererListResult, CanvasSummary, CanvasUpdateRequest, CanvasUpdateResult,
} from '@deepseek-ai/dsh-canvas/client'
import type { CanvasLocaleKey } from './locales.ts'

/** Remote operations and change subscription the management page consumes. */
export interface CanvasPageInjected {
  readonly remote: {
    catalog(): Promise<readonly CanvasSummary[]>
    get(id: CanvasId): Promise<CanvasGetResult>
    create(request: CanvasCreateRequest): Promise<CanvasRecord>
    update(request: CanvasUpdateRequest): Promise<CanvasUpdateResult>
    remove(id: CanvasId): Promise<CanvasDeleteResult>
    renderers(): Promise<CanvasRendererListResult>
  }
  /** Subscribe to authoritative Canvas changes; returns an unsubscribe. */
  readonly onChange: (listener: () => void) => () => void
}

/** Full page props: runtime share, the declared renderer child slot, injected face, and locale. */
export type CanvasPageProps = PropsRuntime<'main'>
  & PropsRenderSlots<'canvas.renderer'>
  & InjectFace<CanvasPageInjected>
  & PropsLocale<'canvas'>

type PageStatus = 'loading' | 'ready' | 'error'

const label: CSSProperties = { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 }
const value: CSSProperties = { color: 'var(--dsw-alias-label-primary)' }

/**
 * Render the Canvas management page.
 * @param props - composed slot props.
 * @returns the Canvas host view.
 */
export function CanvasPage({ remote, onChange, t, renderSlot }: CanvasPageProps) {
  const [status, setStatus] = useState<PageStatus>('loading')
  const [catalog, setCatalog] = useState<readonly CanvasSummary[]>([])
  const [renderers, setRenderers] = useState<readonly CanvasRendererDescriptor[]>([])
  const [selectedId, setSelectedId] = useState<CanvasId | null>(null)
  const [record, setRecord] = useState<CanvasRecord | null>(null)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')

  const reload = useCallback(async (preferredId?: CanvasId | null) => {
    try {
      const [summaries, rendererList] = await Promise.all([remote.catalog(), remote.renderers()])
      setCatalog(summaries)
      setRenderers(rendererList.items)
      const next = preferredId !== undefined
        ? summaries.some(item => item.id === preferredId) ? preferredId : null
        : summaries.some(item => item.id === selectedId) ? selectedId : null
      const chosen: CanvasId | null = next ?? summaries[0]?.id ?? null
      setSelectedId(chosen)
      if (chosen === null) {
        setRecord(null)
        setStatus('ready')
        return
      }
      const result = await remote.get(chosen)
      setRecord('code' in result ? null : result)
      setStatus('ready')
    } catch (_error: unknown) {
      setStatus('error')
    }
  }, [remote, selectedId])

  useEffect(() => {
    void reload()
    const unsubscribe = onChange(() => { void reload() })
    return unsubscribe
  }, [reload, onChange])

  const handleUpdate = useCallback(async (request: CanvasUpdateRequest): Promise<CanvasUpdateResult> => {
    const result = await remote.update(request)
    if (!('code' in result)) {
      setRecord(result)
      void reload(result.id)
    }
    return result
  }, [remote, reload])

  const createCanvas = useCallback(async () => {
    const name = draftName.trim()
    if (name.length === 0) return
    try {
      const created = await remote.create({ name })
      setCreating(false)
      setDraftName('')
      await reload(created.id)
    } catch (_error: unknown) {
      setStatus('error')
    }
  }, [draftName, remote, reload])

  const removeCanvas = useCallback(async () => {
    if (record === null) return
    const confirmed = window.confirm(t('delete.confirm'))
    if (!confirmed) return
    try {
      await remote.remove(record.id)
      setRecord(null)
      await reload(null)
    } catch (_error: unknown) {
      setStatus('error')
    }
  }, [record, remote, reload, t])

  const renameCanvas = useCallback(async () => {
    if (record === null) return
    const name = window.prompt(t('rename'), record.name)
    if (name === null) return
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed === record.name) return
    await handleUpdate({ id: record.id, patch: { name: trimmed }, expectedRevision: record.revision })
  }, [record, handleUpdate, t])

  const rendererAvailable = record?.rendererId === undefined || renderers.some(item => item.id === record.rendererId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <div style={toolbar}>
        <h1 style={heading}>{t('panel')}</h1>
        <button type="button" style={button} onClick={() => { setCreating(true) }}>{t('create')}</button>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px' }}>
          <input
            autoFocus
            value={draftName}
            placeholder={t('create.placeholder')}
            style={input}
            onChange={(event) => { setDraftName(event.target.value) }}
            onKeyDown={(event) => { if (event.key === 'Enter') void createCanvas() }}
          />
          <button type="button" style={button} onClick={() => { void createCanvas() }}>{t('create')}</button>
        </div>
      )}

      {status === 'loading' && <div style={pad}>{t('loading')}</div>}
      {status === 'error' && (
        <div style={pad}>
          <div style={label}>{t('error')}</div>
          <button type="button" style={button} onClick={() => { void reload() }}>{t('retry')}</button>
        </div>
      )}
      {status === 'ready' && catalog.length === 0 && (
        <div style={pad}>
          <div style={{ color: 'var(--dsw-alias-label-primary)' }}>{t('empty.title')}</div>
          <div style={label}>{t('empty.body')}</div>
        </div>
      )}
      {status === 'ready' && catalog.length > 0 && record === null && (
        <div style={pad}>{t('rendererUnavailable')}</div>
      )}

      {status === 'ready' && record !== null && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'row' }}>
          <nav aria-label={t('panel')} style={{ ...rail, ...narrow }}>
            {catalog.map(item => (
              <button
                key={item.id}
                type="button"
                aria-current={item.id === selectedId ? 'page' : undefined}
                style={item.id === selectedId ? { ...tab, ...tabActive } : tab}
                onClick={() => { void reload(item.id) }}
              >
                {item.name}
              </button>
            ))}
          </nav>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--dsw-alias-border-l2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ ...heading, flex: 1, minWidth: 0 }}>{record.name}</h2>
                <button type="button" style={button} onClick={() => { void renameCanvas() }}>{t('rename')}</button>
                <button type="button" style={buttonDanger} onClick={() => { void removeCanvas() }}>{t('delete')}</button>
              </div>
              <Meta t={t} record={record} rendererName={renderers.find(item => item.id === record.rendererId)?.name} />
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
              {record.rendererId === undefined
                ? <div style={label}>{t('noRenderer')}</div>
                : rendererAvailable
                  ? renderSlot(
                    'canvas.renderer',
                    { canvasId: record.id, record, update: handleUpdate },
                    { entryKey: record.rendererId, fallback: <div style={label}>{t('rendererUnavailable')}</div> },
                  )
                  : <div style={label}>{t('rendererUnavailable')}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** One metadata row under the selected Canvas title. */
function Meta({ record, rendererName, t }: { record: CanvasRecord; rendererName: string | undefined; t: (k: CanvasLocaleKey) => string }) {
  const rows: Array<[string, ReactNode]> = [
    [t('meta.renderer'), rendererName ?? record.rendererId ?? '—'],
    [t('meta.revision'), String(record.revision)],
    [t('meta.created'), record.createdAt],
    [t('meta.updated'), record.updatedAt],
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
      {rows.map(([name, content]) => (
        <div key={name} style={{ display: 'flex', gap: 6 }}>
          <span style={label}>{name}</span>
          <span style={value}>{content}</span>
        </div>
      ))}
    </div>
  )
}

const pad: CSSProperties = { padding: 24 }
const heading: CSSProperties = { color: 'var(--dsw-alias-label-primary)', fontSize: 18, fontWeight: 600, margin: 0 }
const toolbar: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--dsw-alias-border-l2)',
}
const button: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-button-ghost-active-fill)',
  border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
}
const buttonDanger: CSSProperties = {
  ...button, color: 'var(--dsw-alias-state-error-primary)',
  border: '1px solid var(--dsw-alias-state-error-primary)',
}
const input: CSSProperties = {
  flex: 1, color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
  border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '4px 10px',
}
const rail: CSSProperties = {
  borderRight: '1px solid var(--dsw-alias-border-l2)', overflowY: 'auto', padding: 8, flexShrink: 0,
}
const narrow: CSSProperties = { width: 200 }
const tab: CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6, marginBottom: 2,
  color: 'var(--dsw-alias-label-secondary)', background: 'transparent', border: 'none', cursor: 'pointer',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const tabActive: CSSProperties = { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-interactive-bg-hover)' }
