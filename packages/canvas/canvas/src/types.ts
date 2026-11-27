/**
 * Durable and model-facing Canvas value types.
 * @module @deepseek-ai/dsh-canvas/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {} from '@deepseek-ai/dsh-typert-protocol'

/** Stable globally unique Canvas identity, independent of any chat Session. */
export type CanvasId = Branded<'CanvasId'>

/** Stable unique identity of one registered Canvas renderer. */
export type CanvasRendererId = Branded<'CanvasRendererId'>

/** A reference to an external workspace resource, never embedded inline. */
export interface CanvasResourceReference {
  /** Resource family, such as `workspace-file`, `document`, or `dataset`. */
  readonly kind: string
  /** Workspace-relative path, URI, or another address the owning store understands. */
  readonly address: string
  /** Optional media type, when the reference implies one. */
  readonly mimeType?: string
  /** Optional human-readable label. */
  readonly label?: string
  /** Set by readers when the referenced resource can no longer be resolved. */
  readonly unavailable?: boolean
}

/**
 * The authoritative shared content of one Canvas instance. Renderer-specific
 * state stays opaque to the Canvas host and is validated only by the renderer's
 * own serialization contract.
 */
export interface CanvasRecord {
  /** Globally unique Canvas identity. */
  readonly id: CanvasId
  /** Required stored name; already trimmed and non-empty. */
  readonly name: string
  /** Optional description. */
  readonly description?: string
  /** Workspace that owns this Canvas, when one is known. */
  readonly workspaceId?: WorkspaceId
  /** Renderer selected for this Canvas, when one is assigned. */
  readonly rendererId?: CanvasRendererId
  /** Version of the Canvas record format. */
  readonly schemaVersion: number
  /** Monotonic optimistic-concurrency revision; editors send it back as `expectedRevision`. */
  readonly revision: number
  /** Opaque renderer-owned state; lossless JSON only. */
  readonly state: JsonValue
  /** External resources the Canvas references. */
  readonly resources: readonly CanvasResourceReference[]
  /** Free-form metadata the Canvas host preserves. */
  readonly metadata: Record<string, JsonValue>
  /** Canonical UTC creation time. */
  readonly createdAt: string
  /** Canonical UTC time of the latest stored change. */
  readonly updatedAt: string
}

/** Lightweight listing entry: metadata without the possibly-large renderer state. */
export interface CanvasSummary {
  readonly id: CanvasId
  readonly name: string
  readonly description?: string
  readonly workspaceId?: WorkspaceId
  readonly rendererId?: CanvasRendererId
  readonly schemaVersion: number
  readonly revision: number
  readonly resourceCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

/** Optional capabilities a renderer advertises; every member is opt-in. */
export interface CanvasRendererCapabilities {
  readonly selection?: boolean
  readonly interaction?: boolean
  readonly serialization?: boolean
  /** The renderer is a standalone application the Canvas host surfaces directly as the top-level view. */
  readonly application?: boolean
}

/** Static descriptor a third-party plugin registers to participate in Canvas. */
export interface CanvasRendererDescriptor {
  readonly id: CanvasRendererId
  readonly name: string
  readonly description: string
  readonly contentTypes: readonly string[]
  readonly capabilities: CanvasRendererCapabilities
  readonly default?: boolean
}

/** Request to create one Canvas instance. */
export interface CanvasCreateRequest {
  readonly name: string
  readonly description?: string
  readonly workspaceId?: WorkspaceId
  readonly rendererId?: CanvasRendererId
  readonly state?: JsonValue
  readonly resources?: readonly CanvasResourceReference[]
  readonly metadata?: Record<string, JsonValue>
}

export interface CanvasGetRequest { readonly id: CanvasId }

export interface CanvasNotFound { readonly id: CanvasId; readonly code: 'canvas_not_found' }

export type CanvasGetResult = CanvasRecord | CanvasNotFound

export interface CanvasListRequest { readonly limit?: number; readonly offset?: number }

export interface CanvasListResult {
  readonly items: readonly CanvasSummary[]
  readonly shown: number
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export interface CanvasPatch {
  readonly name?: string
  readonly description?: string | null
  readonly rendererId?: CanvasRendererId | null
  readonly state?: JsonValue
  readonly resources?: readonly CanvasResourceReference[]
  readonly metadata?: Record<string, JsonValue>
}

export interface CanvasUpdateRequest {
  readonly id: CanvasId
  readonly patch: CanvasPatch
  readonly expectedRevision?: number
}

export interface CanvasConflict {
  readonly id: CanvasId
  readonly code: 'canvas_conflict'
  readonly currentRevision: number
}

export type CanvasUpdateResult = CanvasRecord | CanvasNotFound | CanvasConflict

export interface CanvasDeleteRequest { readonly id: CanvasId }

export type CanvasDeleteResult = { readonly id: CanvasId; readonly deleted: true } | CanvasNotFound

export interface CanvasAttachRequest { readonly canvasId: CanvasId; readonly sessionId: SessionId }

export interface CanvasAttachResult {
  readonly canvasId: CanvasId
  readonly sessionId: SessionId
  readonly attached: boolean
}

export interface CanvasDetachRequest { readonly canvasId: CanvasId; readonly sessionId: SessionId }

export interface CanvasDetachResult {
  readonly canvasId: CanvasId
  readonly sessionId: SessionId
  readonly detached: boolean
}

export interface CanvasListAttachedRequest { readonly sessionId: SessionId }

export interface CanvasListAttachedResult {
  readonly sessionId: SessionId
  readonly canvasIds: readonly CanvasId[]
}

export interface CanvasSetContextRequest { readonly sessionId: SessionId; readonly canvasId: CanvasId | null }

export interface CanvasSetContextResult { readonly sessionId: SessionId; readonly canvasId: CanvasId | null }

export interface CanvasGetContextRequest { readonly sessionId: SessionId }

export interface CanvasGetContextResult {
  readonly sessionId: SessionId
  readonly canvasId: CanvasId | null
  readonly canvas?: CanvasSummary
}

export interface CanvasRendererListResult { readonly items: readonly CanvasRendererDescriptor[] }

/** One committed Canvas mutation, broadcast as `canvas/changed`. */
export interface CanvasChangeNotice {
  readonly canvasId: CanvasId
  readonly kind: 'created' | 'updated' | 'deleted' | 'attached' | 'detached' | 'context-changed'
  readonly revision?: number
  readonly sessionId?: SessionId
}

export interface CanvasInputErrorShape { readonly code: 'invalid_input'; readonly message: string }

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'canvas/input-invalid': { readonly code: 'invalid_input' }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /** The durable Canvas set or one Canvas-Session association changed.
     * @mode emit */
    'canvas/changed'(change: CanvasChangeNotice): void
  }
}
