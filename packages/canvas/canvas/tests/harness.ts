/** Host Canvas tests use real domain storage backed by an in-memory medium. */
import { Context } from '@deepseek-ai/cordis'
import Storage, { type StorageBackend } from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import CanvasService from '../src/index.ts'
import { canvasDomain } from '../src/storage.ts'

export async function harness(options: { backend?: StorageBackend; pool?: MemoryMediaPool } = {}) {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const pool = options.pool ?? new MemoryMediaPool()
  const backend = options.backend ?? new MemoryStorageBackend(pool)
  ctx.effect(() => ctx.storage.backend.register('fixture', backend))
  ctx.effect(() => async () => { await backend.close() })
  const facility = new DomainFacility(ctx, { backend: 'fixture' })
  ctx.effect(() => {
    const unmount = ctx.storage.mount('domain', facility)
    ctx.provide('storageDomain', facility)
    return async () => { await facility.closeAll(); unmount() }
  })
  await ctx.plugin(CanvasService)
  return { ctx, service: ctx.canvas, pool, facility, backend }
}

export { canvasDomain }
