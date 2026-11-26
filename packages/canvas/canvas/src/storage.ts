/** Durable Host-wide Canvas instances and Canvas-Session associations. */
import { z } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { CanvasId, CanvasRendererId } from './types.ts'

/** Canonical millisecond UTC instant with a four-digit year. */
const instantSchema = z.iso.datetime({ precision: 3 }).refine(value => !value.startsWith('0000-'), {
  message: 'Expected a canonical four-digit-year UTC calendar instant',
})

const sessionIdSchema = z.string().min(1).transform(brandString<SessionId>)
const canvasIdSchema = z.string().min(1).transform(brandString<CanvasId>)
const rendererIdSchema = z.string().min(1).transform(brandString<CanvasRendererId>)
const workspaceIdSchema = z.string().min(1).transform(brandString<WorkspaceId>)

const resourceReferenceSchema = z.object({
  kind: z.string().min(1),
  address: z.string().min(1),
  mimeType: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  unavailable: z.boolean().optional(),
}).strict()

/** Opaque renderer state: any lossless JSON value. */
const stateSchema = z.json()

/** Authoritative Canvas record. */
export const canvasRecordSchema = z.object({
  id: canvasIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  workspaceId: workspaceIdSchema.optional(),
  rendererId: rendererIdSchema.optional(),
  schemaVersion: z.number().int().min(0),
  revision: z.number().int().min(0),
  state: stateSchema,
  resources: z.array(resourceReferenceSchema),
  metadata: z.record(z.string(), z.json()),
  createdAt: instantSchema,
  updatedAt: instantSchema,
}).strict()

/** Persistent Canvas value, structurally compatible with the public {@link CanvasRecord}. */
export type StoredCanvasRecord = z.infer<typeof canvasRecordSchema>

const canvasAssociationSchema = z.object({
  canvasId: canvasIdSchema,
  sessionId: sessionIdSchema,
  attachedAt: instantSchema,
}).strict()

/** Persistent Canvas-Session association value. */
export type CanvasAssociation = z.infer<typeof canvasAssociationSchema>

const canvasSessionContextSchema = z.object({
  sessionId: sessionIdSchema,
  canvasId: canvasIdSchema.nullable(),
}).strict()

/** Persistent Session Canvas-context value. */
export type CanvasSessionContext = z.infer<typeof canvasSessionContextSchema>

/** Composite association key, joining a Canvas and a Session. */
export type CanvasAssociationKey = `${CanvasId}\u0000${SessionId}`

/** Encode an association key from its two identities. */
export function associationKey(canvasId: CanvasId, sessionId: SessionId): CanvasAssociationKey {
  return `${canvasId}\u0000${sessionId}`
}

/** Authoritative Canvas domain: records plus independent association and context tables. */
export const canvasDomain = defineDomain({
  name: 'canvas',
  version: 1,
  tables: {
    canvases: domainTable<CanvasId, StoredCanvasRecord>(canvasRecordSchema),
    associations: domainTable<CanvasAssociationKey, CanvasAssociation>(canvasAssociationSchema),
    contexts: domainTable<SessionId, CanvasSessionContext>(canvasSessionContextSchema),
  },
})
