/**
 * Reference Canvas renderer, node half: registers the JSON renderer descriptor
 * with the Host Canvas service so `canvas_list_renderers` and the Canvas host
 * can discover it.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-canvas'
import type { CanvasRendererId } from '@deepseek-ai/dsh-canvas/client'

/** Renderer id shared by this descriptor and the Client slot entry. */
export const RENDERER_ID = 'canvas.json' as CanvasRendererId

/** Services required to register the renderer descriptor. */
export const inject: string[] = []

/**
 * Register the JSON renderer with the Host Canvas service. The descriptor's id
 * links it to the Client-side `canvas.renderer` slot entry.
 * @param ctx - the Host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['canvas'], (canvasCtx) => {
    canvasCtx.canvas.registerRenderer({
      id: RENDERER_ID,
      name: 'JSON viewer',
      description: 'View and edit structured JSON Canvas content.',
      contentTypes: ['application/json'],
      capabilities: { interaction: true, serialization: true },
      default: true,
    })
  })
}
