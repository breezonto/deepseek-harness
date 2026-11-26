/**
 * Canvas slot contract: the keyed `canvas.renderer` hole every renderer plugin
 * registers into, addressed by its renderer id. The Canvas host owns the slot
 * and passes the authoritative record plus an `update` operation.
 */
import type { CanvasId, CanvasRecord, CanvasUpdateRequest, CanvasUpdateResult } from '@deepseek-ai/dsh-canvas/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * One registered renderer component, keyed by renderer id. The Canvas host
     * mounts the entry whose key matches the Canvas's `rendererId`.
     */
    'canvas.renderer': {
      kind: 'keyed'
      scope: 'root'
      owner: CanvasRendererOwnerProps
    }
  }
}

/** Owner share passed to one mounted renderer by the Canvas host. */
export interface CanvasRendererOwnerProps {
  readonly canvasId: CanvasId
  readonly record: CanvasRecord
  readonly update: (request: CanvasUpdateRequest) => Promise<CanvasUpdateResult>
}
