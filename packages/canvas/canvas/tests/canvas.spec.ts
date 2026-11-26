import { describe, expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { CanvasId, CanvasRendererId } from '../src/types.ts'
import { harness } from './harness.ts'

const sessionA = brandString<SessionId>('session-a')
const sessionB = brandString<SessionId>('session-b')
const sessionC = brandString<SessionId>('session-c')

describe('Canvas instance lifecycle', () => {
  it('creates, lists, and reads a Canvas with an independent identity', async () => {
    const { service } = await harness()
    const created = await service.create({ name: '  Scene  ', description: 'A test canvas', state: { nodes: [1, 2, 3] } })
    expect(created.id).toMatch(/^canvas-/)
    expect(created.name).toBe('Scene')
    expect(created.revision).toBe(1)
    expect(created.schemaVersion).toBe(1)

    const got = await service.get({ id: created.id })
    expect(got).toEqual(created)

    const page = await service.list({})
    expect(page.total).toBe(1)
    expect(page.items[0]!.id).toBe(created.id)
    expect(page.items[0]!.resourceCount).toBe(0)
    expect('state' in page.items[0]!).toBe(false)
  })

  it('renames and re-renders state through validated updates', async () => {
    const { service } = await harness()
    const created = await service.create({ name: 'Before' })
    const updated = await service.update({ id: created.id, patch: { name: 'After', state: { a: 1 } }, expectedRevision: 1 })
    expect(updated).toEqual(expect.objectContaining({ name: 'After', revision: 2 }))
    if (!('code' in updated)) expect(updated.state).toEqual({ a: 1 })
  })

  it('deletes a Canvas without deleting its Sessions', async () => {
    const { service } = await harness()
    const created = await service.create({ name: 'Doomed' })
    await service.attach({ canvasId: created.id, sessionId: sessionA })
    const deleted = await service.delete({ id: created.id })
    expect(deleted).toEqual({ id: created.id, deleted: true })
    expect(await service.get({ id: created.id })).toEqual({ id: created.id, code: 'canvas_not_found' })
    expect((await service.listAttached({ sessionId: sessionA })).canvasIds).toEqual([])
  })
})

describe('Cross-session sharing', () => {
  it('shares authoritative state across many-to-many associations', async () => {
    const { service } = await harness()
    const canvas = await service.create({ name: 'Shared', state: { version: 1 } })
    await service.attach({ canvasId: canvas.id, sessionId: sessionA })
    await service.attach({ canvasId: canvas.id, sessionId: sessionB })

    const updated = await service.update({ id: canvas.id, patch: { state: { version: 2 } }, expectedRevision: 1 })
    if ('code' in updated) throw new Error('unexpected conflict')

    const fromB = await service.get({ id: canvas.id })
    if ('code' in fromB) throw new Error('unexpected miss')
    expect(fromB.state).toEqual({ version: 2 })

    expect((await service.listAttached({ sessionId: sessionA })).canvasIds).toEqual([canvas.id])
    expect((await service.listAttached({ sessionId: sessionB })).canvasIds).toEqual([canvas.id])
    expect((await service.listAttached({ sessionId: sessionC })).canvasIds).toEqual([])
  })

  it('keeps the Canvas accessible after a Session detaches', async () => {
    const { service } = await harness()
    const canvas = await service.create({ name: 'Keep' })
    await service.attach({ canvasId: canvas.id, sessionId: sessionA })
    await service.detach({ canvasId: canvas.id, sessionId: sessionA })
    expect((await service.listAttached({ sessionId: sessionA })).canvasIds).toEqual([])
    expect(await service.get({ id: canvas.id })).toEqual(canvas)
  })

  it('selects and reads the active Canvas context per Session', async () => {
    const { service } = await harness()
    const first = await service.create({ name: 'First' })
    const second = await service.create({ name: 'Second' })
    await service.attach({ canvasId: first.id, sessionId: sessionA })
    await service.attach({ canvasId: second.id, sessionId: sessionA })
    expect((await service.getContext({ sessionId: sessionA })).canvasId).toBe(first.id)
    await service.setContext({ sessionId: sessionA, canvasId: second.id })
    const context = await service.getContext({ sessionId: sessionA })
    expect(context.canvasId).toBe(second.id)
    expect(context.canvas?.name).toBe('Second')
  })
})

describe('Concurrent updates', () => {
  it('detects a stale expected revision instead of overwriting', async () => {
    const { service } = await harness()
    const canvas = await service.create({ name: 'Contended' })
    const first = await service.update({ id: canvas.id, patch: { name: 'A' }, expectedRevision: 1 })
    if ('code' in first) throw new Error('unexpected conflict')
    const stale = await service.update({ id: canvas.id, patch: { name: 'B' }, expectedRevision: 1 })
    expect(stale).toEqual({ id: canvas.id, code: 'canvas_conflict', currentRevision: 2 })
    const got = await service.get({ id: canvas.id })
    if ('code' in got) throw new Error('unexpected miss')
    expect(got.name).toBe('A')
  })
})

describe('Renderer registry', () => {
  it('registers renderers, selects a default, and rejects unknown renderers', async () => {
    const { service } = await harness()
    const remove = service.registerRenderer({
      id: brandString<CanvasRendererId>('canvas.json'),
      name: 'JSON viewer',
      description: 'Structured JSON editor',
      contentTypes: ['application/json'],
      capabilities: { interaction: true, serialization: true },
      default: true,
    })
    expect(service.listRenderers().items.map(item => item.id)).toEqual(['canvas.json'])
    const created = await service.create({ name: 'Defaulted' })
    expect(created.rendererId).toBe('canvas.json')
    await expect(service.create({ name: 'Bad', rendererId: brandString<CanvasRendererId>('canvas.missing') }))
      .rejects.toThrow(/not registered/)
    remove()
    expect(service.listRenderers().items).toEqual([])
  })
})

describe('Persistence across restart', () => {
  it('reopens Canvas state from the same medium', async () => {
    const first = await harness()
    const canvas = await first.service.create({ name: 'Durable', state: { ok: true } })
    await first.service.attach({ canvasId: canvas.id, sessionId: sessionA })
    const firstId: CanvasId = canvas.id
    await first.ctx.fiber.dispose()

    const second = await harness({ pool: first.pool })
    const got = await second.service.get({ id: firstId })
    if ('code' in got) throw new Error('unexpected miss after restart')
    expect(got.name).toBe('Durable')
    expect(got.state).toEqual({ ok: true })
    expect((await second.service.listAttached({ sessionId: sessionA })).canvasIds).toEqual([firstId])
  })
})
