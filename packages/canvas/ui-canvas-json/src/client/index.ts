/**
 * Reference Canvas renderer, browser half: registers the JSON renderer into the
 * keyed `canvas.renderer` slot under its renderer id. The Host half registered
 * the matching descriptor with `ctx.canvas`, which links the two halves.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { CanvasRendererId } from '@deepseek-ai/dsh-canvas/client'
import type {} from '@deepseek-ai/dsh-client-ui-canvas/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { JsonCanvasRenderer } from './JsonCanvasRenderer.tsx'

/** Renderer id shared by the Host descriptor and this Client slot entry. */
export const RENDERER_ID = 'canvas.json' as CanvasRendererId

/** Services required by the renderer slot registration. */
export const inject = ['slots']

/**
 * Register the JSON renderer into the `canvas.renderer` slot, addressed by its
 * renderer id. The Canvas host mounts it when a Canvas selects this renderer.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('canvas.renderer', () => ctx.slots.register({
    name: 'canvas.renderer',
    key: RENDERER_ID,
  }, JsonCanvasRenderer))
}
