/**
 * Canvas host, browser half: the **Canvas** entry of the sidebar and the
 * management page it opens in the main column. The page owns the Canvas catalog
 * and selection and mounts a renderer registered under the keyed
 * `canvas.renderer` slot; renderer-specific presentation lives entirely in that
 * renderer's own Client plugin.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-remote-access/client'
import type {} from '@deepseek-ai/dsh-canvas/client'
import { CanvasPage, type CanvasPageInjected } from './CanvasPage.tsx'
import { CanvasIcon } from './CanvasIcon.tsx'
import { en, zh, type CanvasLocaleKey } from './locales.ts'
import type {} from './contract/slots.ts'

export type { CanvasRendererOwnerProps } from './contract/slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Canvas management page copy. */
    'canvas': CanvasLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'canvas'

/** The id shared by the sidebar entry and the main panel it opens. */
export const PANEL_ID = 'canvas' as MainPanelId

/** Services required by the sidebar registration, the Remote methods, and access. */
export const inject = ['slots', 'locale', 'remote', 'remote.canvas', 'remoteAccess']

/**
 * Contribute the Canvas entry to the sidebar with the management page it opens,
 * while the current Peer may read the Canvas catalog.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'ui-canvas: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.remoteAccess.whenAccess('canvas/catalog', function* () {
    // Unwrap the Remote result, throwing only on transport/assembly failures;
    // business miss/conflict results (canvas_not_found, canvas_conflict) pass
    // through as ordinary values.
    const value = async <T>(result: Promise<RemoteResult<T>>): Promise<T> => {
      const resolved = await result
      if (!resolved.ok) throw resolved.error
      return resolved.value
    }
    const remote: CanvasPageInjected['remote'] = {
      catalog: () => value(ctx.remote.canvas.catalog()),
      get: id => value(ctx.remote.canvas.get({ id })),
      create: request => value(ctx.remote.canvas.create(request)),
      update: request => value(ctx.remote.canvas.update(request)),
      renderers: () => value(ctx.remote.canvas.listRenderers()),
    }
    const onChange = (listener: () => void): (() => void) => {
      const offChanged = ctx.remote.$on('canvas/changed', listener)
      const offReset = ctx.on('connection/reset', listener)
      return () => {
        offChanged()
        offReset()
      }
    }
    yield ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: NS,
      inject: (): CanvasPageInjected => ({ remote, onChange }),
      children: {
        'canvas.renderer': { kind: 'keyed', scope: 'root' },
      },
    }, CanvasPage))
    yield ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 7,
      label: () => t('panel'),
      locale: NS,
    }, CanvasIcon))
  })
}
