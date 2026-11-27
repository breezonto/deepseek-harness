/**
 * Canvas host page: the global panel that hosts independently registered
 * application renderers. Each renderer advertising the `application` capability
 * becomes a top-level tab; selecting a tab mounts that renderer directly and
 * provisions a singleton Canvas for it on first use. A foldable right sidebar
 * hosts the selected renderer's own inspector widgets through the keyed
 * `canvas.sidebar` slot. This page never interprets renderer state.
 */
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { IconPanelLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  CanvasCreateRequest, CanvasGetResult, CanvasId, CanvasRecord, CanvasRendererDescriptor,
  CanvasRendererId, CanvasRendererListResult, CanvasSummary, CanvasUpdateRequest, CanvasUpdateResult,
} from '@deepseek-ai/dsh-canvas/client'

/** Remote operations and change subscription the management page consumes. */
export interface CanvasPageInjected {
  readonly remote: {
    catalog(): Promise<readonly CanvasSummary[]>
    get(id: CanvasId): Promise<CanvasGetResult>
    create(request: CanvasCreateRequest): Promise<CanvasRecord>
    update(request: CanvasUpdateRequest): Promise<CanvasUpdateResult>
    renderers(): Promise<CanvasRendererListResult>
  }
  /** Subscribe to authoritative Canvas changes; returns an unsubscribe. */
  readonly onChange: (listener: () => void) => () => void
}

/** Full page props: runtime share, the declared renderer and sidebar child slots, injected face, and locale. */
export type CanvasPageProps = PropsRuntime<'main'>
  & PropsRenderSlots<'canvas.renderer' | 'canvas.sidebar'>
  & InjectFace<CanvasPageInjected>
  & PropsLocale<'canvas'>

type PageStatus = 'loading' | 'ready' | 'error'

const label: CSSProperties = { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 }

/**
 * Render the Canvas host view.
 * @param props - composed slot props.
 * @returns the Canvas host view.
 */
export function CanvasPage({ remote, onChange, t, renderSlot }: CanvasPageProps) {
  const [status, setStatus] = useState<PageStatus>('loading')
  const [renderers, setRenderers] = useState<readonly CanvasRendererDescriptor[]>([])
  const [selectedAppId, setSelectedAppId] = useState<CanvasRendererId | null>(null)
  const [record, setRecord] = useState<CanvasRecord | null>(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  const apps = renderers.filter(item => item.capabilities.application === true)

  const reload = useCallback(async (preferredAppId?: CanvasRendererId | null) => {
    try {
      const [summaries, rendererList] = await Promise.all([remote.catalog(), remote.renderers()])
      const items = rendererList.items
      setRenderers(items)
      const applicationRenderers = items.filter(item => item.capabilities.application === true)

      if (applicationRenderers.length === 0) {
        setSelectedAppId(null)
        setRecord(null)
        setStatus('ready')
        return
      }

      const next = preferredAppId !== undefined
        ? applicationRenderers.some(item => item.id === preferredAppId) ? preferredAppId : null
        : applicationRenderers.some(item => item.id === selectedAppId) ? selectedAppId : null
      const chosen: CanvasRendererId | null = next ?? applicationRenderers[0]?.id ?? null
      setSelectedAppId(chosen)
      // Switching application tabs invalidates the previously mounted Canvas
      // record so the content area never pairs a new renderer with a stale one.
      if (chosen !== selectedAppId) setRecord(null)

      if (chosen === null) {
        setStatus('ready')
        return
      }

      // Reuse the application's singleton Canvas when one exists; provision it
      // lazily on first use so the viewport mounts immediately.
      const existing = summaries.find(item => item.rendererId === chosen)
      let nextRecord: CanvasRecord | null = null
      if (existing === undefined) {
        const app = applicationRenderers.find(item => item.id === chosen)
        nextRecord = await remote.create({ name: app?.name ?? String(chosen), rendererId: chosen })
      } else {
        const result = await remote.get(existing.id)
        nextRecord = 'code' in result ? null : result
      }
      setRecord(nextRecord)
      setStatus('ready')
    } catch (_error: unknown) {
      setStatus('error')
    }
  }, [remote, selectedAppId])

  useEffect(() => {
    void reload()
    const unsubscribe = onChange(() => { void reload() })
    return unsubscribe
  }, [reload, onChange])

  const handleUpdate = useCallback(async (request: CanvasUpdateRequest): Promise<CanvasUpdateResult> => {
    const result = await remote.update(request)
    if (!('code' in result)) setRecord(result)
    return result
  }, [remote])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {status === 'loading' && <div style={pad}>{t('loading')}</div>}
      {status === 'error' && (
        <div style={pad}>
          <div style={label}>{t('error')}</div>
          <button type="button" style={button} onClick={() => { void reload() }}>{t('retry')}</button>
        </div>
      )}

      {status === 'ready' && apps.length === 0 && (
        <div style={pad}>
          <div style={{ color: 'var(--dsw-alias-label-primary)' }}>{t('empty.title')}</div>
          <div style={label}>{t('empty.body')}</div>
        </div>
      )}

      {status === 'ready' && apps.length > 0 && (
        <>
          <div role="tablist" aria-label={t('panel')} style={tabBar}>
            {apps.map(app => (
              <button
                key={app.id}
                type="button"
                role="tab"
                aria-selected={app.id === selectedAppId}
                style={app.id === selectedAppId ? { ...tab, ...tabActive } : tab}
                onClick={() => { void reload(app.id) }}
              >
                {app.name}
              </button>
            ))}
            <button
              type="button"
              style={iconToggle}
              aria-label={t('sidebar.toggle')}
              aria-pressed={sidebarExpanded}
              onClick={() => { setSidebarExpanded(value => !value) }}
            >
              <span style={mirror}><IconPanelLeftOutlineRegular size={15} /></span>
            </button>
          </div>

          {selectedAppId === null || record === null
            ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <div style={pad}>{record === null ? t('loading') : t('rendererUnavailable')}</div>
              </div>
            )
            : (
              <div style={{ flex: 1, minHeight: 0, position: 'relative', minWidth: 0 }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {renderSlot(
                    'canvas.renderer',
                    { canvasId: record.id, record, update: handleUpdate },
                    { entryKey: selectedAppId, fallback: <div style={pad}><div style={label}>{t('rendererUnavailable')}</div></div> },
                  )}
                </div>

                {sidebarExpanded && (
                  <aside style={sidebarOverlay} aria-label={t('sidebar.title')}>
                    <div style={sidebarHeader}>
                      <span style={sidebarTitle}>{t('sidebar.title')}</span>
                    </div>
                    <div style={sidebarBody}>
                      {renderSlot(
                        'canvas.sidebar',
                        { canvasId: record.id, record, update: handleUpdate },
                        { entryKey: selectedAppId },
                      )}
                    </div>
                  </aside>
                )}
              </div>
            )}
        </>
      )}
    </div>
  )
}

const pad: CSSProperties = { padding: 24 }
const button: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-button-ghost-active-fill)',
  border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
}
const tabBar: CSSProperties = {
  display: 'flex', alignItems: 'flex-end', gap: 2, padding: '4px 12px 0', flexShrink: 0,
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}
const tab: CSSProperties = {
  padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--dsw-alias-label-secondary)', fontSize: 14,
  borderBottom: '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap',
}
const tabActive: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)', fontWeight: 600,
  borderBottom: '2px solid var(--dsw-alias-brand-primary)',
}
const iconToggle: CSSProperties = {
  marginLeft: 'auto', marginBottom: 4, padding: 6, display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer',
  color: 'var(--dsw-alias-label-secondary)', flex: 'none',
}
const mirror: CSSProperties = { display: 'inline-flex', transform: 'scaleX(-1)' }
const sidebarOverlay: CSSProperties = {
  position: 'absolute', top: 12, right: 12, bottom: 12, width: 300, zIndex: 20,
  display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
  background: 'color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, transparent)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 'var(--dsw-radius-xl)',
  boxShadow: 'var(--dsw-elevation-prominent)',
}
const sidebarHeader: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', flexShrink: 0,
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}
const sidebarTitle: CSSProperties = {
  flex: 1, minWidth: 0, color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 600,
}
const sidebarBody: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 16px' }
