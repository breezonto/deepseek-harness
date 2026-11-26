/**
 * Host-wide durable Canvas instances, Canvas-Session associations, and the
 * renderer extension registry. A Canvas outlives the Session that created it;
 * several Sessions may attach to and edit the same authoritative state, which
 * lives here rather than in any Session log.
 */
import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { RemoteError, TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CanvasAttachRequest, CanvasAttachResult, CanvasChangeNotice, CanvasCreateRequest, CanvasDeleteRequest,
  CanvasDeleteResult, CanvasDetachRequest, CanvasDetachResult, CanvasGetContextRequest, CanvasGetContextResult,
  CanvasGetRequest, CanvasGetResult, CanvasId, CanvasListAttachedRequest, CanvasListAttachedResult, CanvasListRequest,
  CanvasListResult, CanvasNotFound, CanvasRecord, CanvasRendererDescriptor, CanvasRendererId, CanvasRendererListResult,
  CanvasResourceReference, CanvasSetContextRequest, CanvasSetContextResult, CanvasSummary, CanvasUpdateRequest, CanvasUpdateResult,
} from './types.ts'
import { associationKey, canvasDomain, canvasRecordSchema, type CanvasSessionContext, type StoredCanvasRecord } from './storage.ts'

/** Default Canvas list page size. */
export const DEFAULT_LIST_LIMIT = 100

/** Largest page size of one Canvas list request. */
export const MAX_LIST_LIMIT = 500

/** Stable error for an invalid Canvas management argument. */
export class CanvasInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CanvasInputError'
  }
}

/** Preserve stable Canvas validation codes across the Remote transport. */
function throwRemoteCanvasInput(error: unknown): never {
  if (error instanceof CanvasInputError) {
    throw new RemoteError('canvas/input-invalid', error.message, { code: 'invalid_input' })
  }
  throw error
}

/** Resolve the page bounds of a Canvas list request. */
function resolveListPage(request: CanvasListRequest): { readonly limit: number; readonly offset: number } {
  const limit = request.limit ?? DEFAULT_LIST_LIMIT
  const offset = request.offset ?? 0
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT || !Number.isSafeInteger(offset) || offset < 0) {
    throw new CanvasInputError(`limit must be 1-${MAX_LIST_LIMIT} and offset must be a non-negative integer.`)
  }
  return { limit, offset }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Durable Canvas management and renderer registration. */
    canvas: CanvasService
  }
}

/**
 * Shared management service. Reads never activate a Session; mutations write
 * the Canvas domain and broadcast `canvas/changed` so every attached Client and
 * Agent refreshes from the same authoritative state.
 */
export class CanvasService extends TypertRemoteService {
  static inject = ['storageDomain']

  private readonly ready: Promise<Domain<typeof canvasDomain>>
  private readonly initialized: PromiseLike<unknown>
  private chain: Promise<unknown> = Promise.resolve()
  private stopping = false
  private readonly renderers = new Map<CanvasRendererId, CanvasRendererDescriptor>()

  /** @param ctx - Host services owning durable storage. */
  constructor(ctx: Context) {
    super(ctx, 'canvas')
    this.ready = ctx.storageDomain.open(canvasDomain).then(async (domain) => {
      try {
        for (const [key, record] of domain.table('canvases').entries()) {
          if (key !== record.id) {
            throw new Error(`canvas: stored Canvas key "${key}" differs from record id "${record.id}"`)
          }
        }
      } catch (error: unknown) {
        try {
          await domain.close()
        } catch (closeError: unknown) {
          ctx.logger.warn(`canvas: closing the domain after an open failure failed: ${String(closeError)}`)
        }
        throw error
      }
      return domain
    })
    this.initialized = ctx.effect(async () => {
      const domain = await this.ready
      return ctx.effect(() => async () => {
        this.stopping = true
        await this.chain
        await domain.close()
      })
    })
  }

  async [Service.init](): Promise<void> {
    await this.initialized
  }

  /**
   * Register a renderer descriptor from an independent plugin. The descriptor's
   * `id` links this registration to the plugin's Client-side `canvas.renderer`
   * slot entry. Registration is a Host-composition effect, not durable state.
   * @param descriptor - the renderer's static identity and capabilities.
   * @returns a disposer that withdraws the registration.
   */
  registerRenderer(descriptor: CanvasRendererDescriptor): () => void {
    if (this.renderers.has(descriptor.id)) {
      throw new Error(`canvas: renderer "${descriptor.id}" is already registered`)
    }
    const remove = this.ctx.effect(() => {
      this.renderers.set(descriptor.id, descriptor)
      return () => {
        this.renderers.delete(descriptor.id)
      }
    }, `canvas.registerRenderer(${String(descriptor.id)})`)
    return () => { void remove() }
  }

  /** All registered renderers, in registration order. */
  listRenderers(): CanvasRendererListResult {
    return { items: [...this.renderers.values()] }
  }

  /** Remote form of the renderer roster. */
  @Remote('listRenderers')
  remoteListRenderers(): CanvasRendererListResult {
    return this.listRenderers()
  }

  /**
   * Create one Canvas with a Host-generated identity.
   * @param request - name and optional initial state, resources, and renderer.
   * @returns the stored Canvas record.
   */
  async create(request: CanvasCreateRequest): Promise<CanvasRecord> {
    const name = request.name.trim()
    if (name.length === 0) throw new CanvasInputError('Canvas name must be non-empty after trimming.')
    const rendererId = request.rendererId ?? this.defaultRendererId()
    if (rendererId !== undefined && !this.renderers.has(rendererId)) {
      throw new CanvasInputError(`Renderer "${rendererId}" is not registered.`)
    }
    return this.serialize(async () => {
      const domain = await this.getDomain()
      const id = brandString<CanvasId>(`canvas-${randomUUID()}`)
      const now = new Date().toISOString()
      const record = canvasRecordSchema.parse({
        id,
        name,
        ...(request.description === undefined ? {} : { description: request.description }),
        ...(request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId }),
        ...(rendererId === undefined ? {} : { rendererId }),
        schemaVersion: canvasDomain.version,
        revision: 1,
        state: request.state ?? null,
        resources: request.resources ?? [],
        metadata: request.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      })
      await domain.table('canvases').put(id, record)
      this.emitChanged({ canvasId: id, kind: 'created', revision: record.revision })
      return toRecord(record)
    })
  }

  /** Remote form of {@link CanvasService.create}; an invalid request rejects with `canvas/input-invalid`. */
  @Remote('create')
  async remoteCreate(request: CanvasCreateRequest): Promise<CanvasRecord> {
    try {
      return await this.create(request)
    } catch (error: unknown) {
      throwRemoteCanvasInput(error)
    }
  }

  /** Read one Canvas without mutating it. */
  async get(request: CanvasGetRequest): Promise<CanvasGetResult> {
    const record = (await this.getDomain()).table('canvases').get(request.id)
    return record === undefined ? { id: request.id, code: 'canvas_not_found' } : toRecord(record)
  }

  /** Remote form of {@link CanvasService.get}. */
  @Remote('get')
  remoteGet(request: CanvasGetRequest): Promise<CanvasGetResult> {
    return this.get(request)
  }

  /** Read one page of Canvas summaries without the possibly-large state. */
  async list(request: CanvasListRequest = {}): Promise<CanvasListResult> {
    const { limit, offset } = resolveListPage(request)
    const items = canvasValues(await this.getDomain()).map(summarize).sort(compareSummaries)
    return {
      items: items.slice(offset, offset + limit),
      shown: Math.max(0, Math.min(items.length, offset + limit) - offset),
      total: items.length,
      limit,
      offset,
    }
  }

  /** Remote form of {@link CanvasService.list}. */
  @Remote('list')
  async remoteList(request: CanvasListRequest): Promise<CanvasListResult> {
    try {
      return await this.list(request)
    } catch (error: unknown) {
      throwRemoteCanvasInput(error)
    }
  }

  /** Read every Canvas summary without a page bound. */
  @Remote('catalog')
  async catalog(): Promise<readonly CanvasSummary[]> {
    return canvasValues(await this.getDomain()).map(summarize).sort(compareSummaries)
  }

  /**
   * Update one Canvas atomically; an `expectedRevision` that differs from the
   * stored revision returns `canvas_conflict` instead of overwriting.
   * @param request - Canvas identity, patch, and optional expected revision.
   * @returns the updated record, or a non-mutating miss or conflict.
   */
  async update(request: CanvasUpdateRequest): Promise<CanvasUpdateResult> {
    if (Object.keys(request.patch).length === 0) {
      throw new CanvasInputError('An update patch requires at least one field.')
    }
    if (request.patch.name !== undefined && request.patch.name.trim().length === 0) {
      throw new CanvasInputError('Canvas name must be non-empty after trimming.')
    }
    if (request.patch.rendererId !== undefined && request.patch.rendererId !== null && !this.renderers.has(request.patch.rendererId)) {
      throw new CanvasInputError(`Renderer "${request.patch.rendererId}" is not registered.`)
    }
    return this.serialize(async () => {
      const domain = await this.getDomain()
      const table = domain.table('canvases')
      const current = table.get(request.id)
      if (current === undefined) return { id: request.id, code: 'canvas_not_found' } satisfies CanvasNotFound
      if (request.expectedRevision !== undefined && request.expectedRevision !== current.revision) {
        return { id: request.id, code: 'canvas_conflict', currentRevision: current.revision } satisfies CanvasUpdateResult
      }
      const patch = request.patch
      const next = canvasRecordSchema.parse({
        ...current,
        ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
        ...(patch.description === undefined ? {} : { description: patch.description ?? undefined }),
        ...(patch.rendererId === undefined ? {} : { rendererId: patch.rendererId ?? undefined }),
        ...(patch.state === undefined ? {} : { state: patch.state }),
        ...(patch.resources === undefined ? {} : { resources: patch.resources }),
        ...(patch.metadata === undefined ? {} : { metadata: patch.metadata }),
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      await table.put(request.id, next)
      this.emitChanged({ canvasId: request.id, kind: 'updated', revision: next.revision })
      return toRecord(next)
    })
  }

  /** Remote form of {@link CanvasService.update}. */
  @Remote('update')
  async remoteUpdate(request: CanvasUpdateRequest): Promise<CanvasUpdateResult> {
    try {
      return await this.update(request)
    } catch (error: unknown) {
      throwRemoteCanvasInput(error)
    }
  }

  /**
   * Delete one Canvas. Deleting a Canvas never deletes its associated chat
   * Sessions or its externally referenced resources.
   * @param request - Canvas identity.
   * @returns deletion outcome or a lookup miss.
   */
  async delete(request: CanvasDeleteRequest): Promise<CanvasDeleteResult> {
    return this.serialize(async () => {
      const domain = await this.getDomain()
      const deleted = await domain.table('canvases').delete(request.id)
      if (!deleted) return { id: request.id, code: 'canvas_not_found' } satisfies CanvasNotFound
      const associations = domain.table('associations')
      for (const [key, assoc] of associations.entries()) {
        if (assoc.canvasId === request.id) await associations.delete(key)
      }
      const contexts = domain.table('contexts')
      for (const [sessionId, context] of contexts.entries()) {
        if (context.canvasId === request.id) await contexts.put(sessionId, { sessionId, canvasId: null })
      }
      this.emitChanged({ canvasId: request.id, kind: 'deleted' })
      return { id: request.id, deleted: true }
    })
  }

  /** Remote form of {@link CanvasService.delete}. */
  @Remote('delete')
  remoteDelete(request: CanvasDeleteRequest): Promise<CanvasDeleteResult> {
    return this.delete(request)
  }

  /**
   * Associate one Canvas with one Session, idempotently. The first association
   * of a Session also becomes its active Canvas context.
   */
  async attach(request: CanvasAttachRequest): Promise<CanvasAttachResult> {
    return this.serialize(async () => {
      const domain = await this.getDomain()
      if (domain.table('canvases').get(request.canvasId) === undefined) {
        throw new CanvasInputError(`Canvas "${request.canvasId}" does not exist.`)
      }
      const associations = domain.table('associations')
      const key = associationKey(request.canvasId, request.sessionId)
      const attached = associations.get(key) === undefined
      if (attached) {
        await associations.put(key, { canvasId: request.canvasId, sessionId: request.sessionId, attachedAt: new Date().toISOString() })
      }
      const contexts = domain.table('contexts')
      if (contexts.get(request.sessionId)?.canvasId === undefined) {
        await contexts.put(request.sessionId, { sessionId: request.sessionId, canvasId: request.canvasId })
      }
      this.emitChanged({ canvasId: request.canvasId, kind: 'attached', sessionId: request.sessionId })
      return { canvasId: request.canvasId, sessionId: request.sessionId, attached }
    })
  }

  /** Remote form of {@link CanvasService.attach}. */
  @Remote('attach')
  async remoteAttach(request: CanvasAttachRequest): Promise<CanvasAttachResult> {
    try {
      return await this.attach(request)
    } catch (error: unknown) {
      throwRemoteCanvasInput(error)
    }
  }

  /** Remove one Canvas-Session association and clear it as the active context if selected. */
  async detach(request: CanvasDetachRequest): Promise<CanvasDetachResult> {
    return this.serialize(async () => {
      const domain = await this.getDomain()
      const key = associationKey(request.canvasId, request.sessionId)
      const detached = await domain.table('associations').delete(key)
      const contexts = domain.table('contexts')
      if (contexts.get(request.sessionId)?.canvasId === request.canvasId) {
        await contexts.put(request.sessionId, { sessionId: request.sessionId, canvasId: null })
      }
      this.emitChanged({ canvasId: request.canvasId, kind: 'detached', sessionId: request.sessionId })
      return { canvasId: request.canvasId, sessionId: request.sessionId, detached }
    })
  }

  /** Remote form of {@link CanvasService.detach}. */
  @Remote('detach')
  remoteDetach(request: CanvasDetachRequest): Promise<CanvasDetachResult> {
    return this.detach(request)
  }

  /** Read the Canvas identities associated with one Session, in attach order. */
  async listAttached(request: CanvasListAttachedRequest): Promise<CanvasListAttachedResult> {
    const associations = [...(await this.getDomain()).table('associations').entries()].map(([, assoc]) => assoc)
    const canvasIds = associations
      .filter(assoc => assoc.sessionId === request.sessionId)
      .map(assoc => assoc.canvasId)
    return { sessionId: request.sessionId, canvasIds }
  }

  /** Remote form of {@link CanvasService.listAttached}. */
  @Remote('listAttached')
  remoteListAttached(request: CanvasListAttachedRequest): Promise<CanvasListAttachedResult> {
    return this.listAttached(request)
  }

  /** Select or clear the active Canvas context of one Session. */
  async setContext(request: CanvasSetContextRequest): Promise<CanvasSetContextResult> {
    if (request.canvasId !== null && (await this.getDomain()).table('canvases').get(request.canvasId) === undefined) {
      throw new CanvasInputError(`Canvas "${request.canvasId}" does not exist.`)
    }
    return this.serialize(async () => {
      const domain = await this.getDomain()
      await domain.table('contexts').put(request.sessionId, { sessionId: request.sessionId, canvasId: request.canvasId })
      if (request.canvasId !== null) {
        this.emitChanged({ canvasId: request.canvasId, kind: 'context-changed', sessionId: request.sessionId })
      }
      return { sessionId: request.sessionId, canvasId: request.canvasId }
    })
  }

  /** Remote form of {@link CanvasService.setContext}. */
  @Remote('setContext')
  async remoteSetContext(request: CanvasSetContextRequest): Promise<CanvasSetContextResult> {
    try {
      return await this.setContext(request)
    } catch (error: unknown) {
      throwRemoteCanvasInput(error)
    }
  }

  /** Read the active Canvas context of one Session, with its summary when present. */
  async getContext(request: CanvasGetContextRequest): Promise<CanvasGetContextResult> {
    const domain = await this.getDomain()
    const context: CanvasSessionContext | undefined = domain.table('contexts').get(request.sessionId)
    const canvasId = context?.canvasId ?? null
    const record = canvasId === null ? undefined : domain.table('canvases').get(canvasId)
    return { sessionId: request.sessionId, canvasId, ...(record === undefined ? {} : { canvas: summarize(record) }) }
  }

  /** Remote form of {@link CanvasService.getContext}. */
  @Remote('getContext')
  remoteGetContext(request: CanvasGetContextRequest): Promise<CanvasGetContextResult> {
    return this.getContext(request)
  }

  private async getDomain(): Promise<Domain<typeof canvasDomain>> {
    await this.initialized
    return this.ready
  }

  private defaultRendererId(): CanvasRendererId | undefined {
    const all = [...this.renderers.values()]
    return all.find(renderer => renderer.default === true)?.id ?? all[0]?.id
  }

  private emitChanged(change: CanvasChangeNotice): void {
    try {
      this.ctx.emit('canvas/changed', change)
    } catch (error: unknown) {
      this.ctx.logger.warn(`canvas: canvas/changed listener failed: ${String(error)}`)
    }
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    if (this.stopping) return Promise.reject(new Error('Canvas service is stopping'))
    const pending = this.chain.then(work)
    this.chain = pending.catch(() => undefined)
    return pending
  }
}

/** All stored Canvas records of a domain, without their keys. */
function canvasValues(domain: Domain<typeof canvasDomain>): StoredCanvasRecord[] {
  return [...domain.table('canvases').entries()].map(([, record]) => record)
}

/** Convert a stored record to the public shape, dropping `undefined` optionals. */
export function toRecord(record: StoredCanvasRecord): CanvasRecord {
  return {
    id: record.id,
    name: record.name,
    ...(record.description === undefined ? {} : { description: record.description }),
    ...(record.workspaceId === undefined ? {} : { workspaceId: record.workspaceId }),
    ...(record.rendererId === undefined ? {} : { rendererId: record.rendererId }),
    schemaVersion: record.schemaVersion,
    revision: record.revision,
    state: record.state,
    resources: record.resources.map(toResource),
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

/** Convert one stored resource reference to the public shape, dropping `undefined` optionals. */
function toResource(ref: StoredCanvasRecord['resources'][number]): CanvasResourceReference {
  return {
    kind: ref.kind,
    address: ref.address,
    ...(ref.mimeType === undefined ? {} : { mimeType: ref.mimeType }),
    ...(ref.label === undefined ? {} : { label: ref.label }),
    ...(ref.unavailable === undefined ? {} : { unavailable: ref.unavailable }),
  }
}

/** Project a Canvas record onto its lightweight summary. */
export function summarize(record: StoredCanvasRecord): CanvasSummary {
  return {
    id: record.id,
    name: record.name,
    ...(record.description === undefined ? {} : { description: record.description }),
    ...(record.workspaceId === undefined ? {} : { workspaceId: record.workspaceId }),
    ...(record.rendererId === undefined ? {} : { rendererId: record.rendererId }),
    schemaVersion: record.schemaVersion,
    revision: record.revision,
    resourceCount: record.resources.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

/** Stable ordering: newest update first, ties by identity. */
function compareSummaries(left: CanvasSummary, right: CanvasSummary): number {
  return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)
}

export default CanvasService
