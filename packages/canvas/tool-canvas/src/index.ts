/**
 * Model-facing Canvas tools over the Host `ctx.canvas` service: list, create,
 * get, attach, detach, update, read context, and discover renderers. Mounting
 * the plugin registers them in the mounting scope, so a preset decides which
 * agents receive them. Canvases belong to the Host, not to a Session: the tools
 * read and change any accessible Canvas by id, and only attach/detach name a
 * Session.
 * @module @deepseek-ai/dsh-tool-canvas
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { brandString } from '@deepseek-ai/dsh-brand'
import { CanvasInputError } from '@deepseek-ai/dsh-canvas'
import type { CanvasId, CanvasRendererId } from '@deepseek-ai/dsh-canvas/client'
import type { CanvasCreateRequest, CanvasUpdateRequest } from '@deepseek-ai/dsh-canvas/client'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/** Plugin name registered with the Loader. */
export const name = 'tool-canvas'

/** Host services this plugin consumes. */
export const inject = ['tools']

/** Deterministic model content for every canonical Canvas value. */
function renderValue(_args: unknown, value: unknown): ContentBlock[] {
  return [{ type: 'text', text: JSON.stringify(value) }]
}

/** Deep-clone a Canvas result into plain lossless JSON, dropping brands and readonly wrappers. */
function jsonify(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

/** Pure generic pending card. */
function present(title: string, kind: 'read' | 'other', rawInput?: unknown): GenericCallView {
  return { card: 'generic', title, kind, ...rawInput === undefined ? {} : { rawInput } }
}

/** Stable error for failures not safe to expose. */
function internalError(): { code: 'invalid_input'; message: string } {
  return { code: 'invalid_input', message: 'The Canvas operation failed.' }
}

/** The acting Session of a call, or undefined for a human caller. */
function actorSession(exec: ToolRunContext): Agent['session'] | undefined {
  return exec.agent?.session
}

/** Run one Canvas operation, translating validation failures into the declared error shape. */
async function run<T>(operation: () => Promise<T> | T): Promise<T | { code: 'invalid_input'; message: string }> {
  try {
    return await operation()
  } catch (error: unknown) {
    if (error instanceof CanvasInputError) {
      return { code: 'invalid_input', message: error.message }
    }
    return internalError()
  }
}

const CREATE_DESCRIPTION =
  'Create a persistent Canvas instance and attach it to the current chat session. '
  + 'The Canvas outlives the session and can be shared with other sessions. '
  + 'Renderer-specific content belongs in `state`, which the host stores opaquely.'

const LIST_DESCRIPTION =
  'List accessible Canvas instances. Returned summaries omit the renderer state; retrieve it with canvas_get when needed.'

const GET_DESCRIPTION = 'Retrieve one Canvas instance by id, including its authoritative renderer state.'

const ATTACH_DESCRIPTION =
  'Associate an existing Canvas with the current chat session so its context becomes available here. '
  + 'Sharing a Canvas does not share conversational history.'

const DETACH_DESCRIPTION = 'Remove the association between an existing Canvas and the current chat session.'

const UPDATE_DESCRIPTION =
  'Update one Canvas by id. Pass expectedRevision from the latest result that returned this Canvas; '
  + 'if the Canvas changed after that, the result is canvas_conflict and nothing changes.'

const GET_CONTEXT_DESCRIPTION = 'Retrieve the active Canvas context of the current chat session, when one is selected.'

const LIST_RENDERERS_DESCRIPTION = 'Discover registered Canvas renderers and their capabilities.'

/**
 * Register the Canvas tools in the mounting scope.
 * @param ctx - Context owning the tool registry and the Host Canvas service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['canvas'], registerCanvasTools)
}

/** Register the tools in the scope that resolved Canvas. */
function registerCanvasTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'canvas_list',
    description: LIST_DESCRIPTION,
    parameters: {
      limit: { type: 'integer', description: 'Page size from 1 to 500; defaults to 100.' },
      offset: { type: 'integer', description: 'Number of Canvas instances to skip; defaults to 0.' },
    },
    output: { schema: { type: 'json' }, render: renderValue },
    isConcurrencySafe: () => true,
    execute(args) {
      return run(() => ctx.canvas.list({
        ...(args.limit === undefined ? {} : { limit: args.limit }),
        ...(args.offset === undefined ? {} : { offset: args.offset }),
      }).then(jsonify))
    },
    presentCall: () => present('List Canvas instances', 'read'),
  }))

  ctx.tools.register(defineTool({
    name: 'canvas_create',
    description: CREATE_DESCRIPTION,
    parameters: {
      name: { type: 'string', required: true, description: 'Canvas name, non-empty after trimming.' },
      description: { type: 'string', description: 'Optional description.' },
      rendererId: { type: 'string', description: 'Renderer to use; omission lets the host choose a default.' },
      state: { type: 'json', description: 'Initial renderer-owned state.' },
    },
    output: { schema: { type: 'json' }, render: renderValue },
    execute(args, exec) {
      return run(async () => {
        const session = actorSession(exec)
        const request: CanvasCreateRequest = {
          name: args.name,
          ...(args.description === undefined ? {} : { description: args.description }),
          ...(args.rendererId === undefined ? {} : { rendererId: brandString<CanvasRendererId>(args.rendererId) }),
          ...(args.state === undefined ? {} : { state: args.state }),
        }
        const record = await ctx.canvas.create(request)
        if (session !== undefined) await ctx.canvas.attach({ canvasId: record.id, sessionId: session.id })
        return jsonify(record)
      })
    },
    presentCall: args => present('Create Canvas', 'other', args.name),
  }))

  ctx.tools.register(defineTool({
    name: 'canvas_get',
    description: GET_DESCRIPTION,
    parameters: {
      id: { type: 'string', required: true, description: 'Canvas id.' },
    },
    output: { schema: { type: 'json' }, render: renderValue },
    isConcurrencySafe: () => true,
    execute(args) {
      return run(() => ctx.canvas.get({ id: brandString<CanvasId>(args.id) }).then(jsonify))
    },
    presentCall: args => present('Get Canvas', 'read', args.id),
  }))

  ctx.tools.register(defineTool({
    name: 'canvas_attach',
    description: ATTACH_DESCRIPTION,
    parameters: {
      canvasId: { type: 'string', required: true, description: 'Canvas id to associate.' },
    },
    output: { schema: { type: 'json' }, render: renderValue },
    execute(args, exec) {
      return run(async () => {
        const session = actorSession(exec)
        if (session === undefined) return internalError()
        return jsonify(await ctx.canvas.attach({ canvasId: brandString<CanvasId>(args.canvasId), sessionId: session.id }))
      })
    },
    presentCall: args => present('Attach Canvas', 'other', args.canvasId),
  }))

  ctx.tools.register(defineTool({
    name: 'canvas_detach',
    description: DETACH_DESCRIPTION,
    parameters: {
      canvasId: { type: 'string', required: true, description: 'Canvas id to dissociate.' },
    },
    output: { schema: { type: 'json' }, render: renderValue },
    execute(args, exec) {
      return run(async () => {
        const session = actorSession(exec)
        if (session === undefined) return internalError()
        return jsonify(await ctx.canvas.detach({ canvasId: brandString<CanvasId>(args.canvasId), sessionId: session.id }))
      })
    },
    presentCall: args => present('Detach Canvas', 'other', args.canvasId),
  }))

  ctx.tools.register(defineTool({
    name: 'canvas_update',
    description: UPDATE_DESCRIPTION,
    parameters: {
      id: { type: 'string', required: true, description: 'Canvas id.' },
      name: { type: 'string', description: 'Replacement name.' },
      description: { type: 'string', description: 'Replacement description.' },
      rendererId: { type: 'string', description: 'Replacement renderer.' },
      state: { type: 'json', description: 'Replacement renderer-owned state.' },
      expectedRevision: { type: 'integer', description: 'revision from the latest result that returned this Canvas.' },
    },
    output: { schema: { type: 'json' }, render: renderValue },
    execute(args) {
      return run(() => {
        const patch = {
          ...(args.name === undefined ? {} : { name: args.name }),
          ...(args.description === undefined ? {} : { description: args.description }),
          ...(args.rendererId === undefined ? {} : { rendererId: brandString<CanvasRendererId>(args.rendererId) }),
          ...(args.state === undefined ? {} : { state: args.state }),
        }
        if (Object.keys(patch).length === 0) {
          throw new CanvasInputError('update requires at least one of name, description, rendererId, or state.')
        }
        const request: CanvasUpdateRequest = {
          id: brandString<CanvasId>(args.id),
          patch,
          ...(args.expectedRevision === undefined ? {} : { expectedRevision: args.expectedRevision }),
        }
        return ctx.canvas.update(request).then(jsonify)
      })
    },
    presentCall: args => present('Update Canvas', 'other', args.id),
  }))

  ctx.tools.register(defineTool({
    name: 'canvas_get_context',
    description: GET_CONTEXT_DESCRIPTION,
    parameters: {},
    output: { schema: { type: 'json' }, render: renderValue },
    isConcurrencySafe: () => true,
    execute(_args, exec) {
      return run(async () => {
        const session = actorSession(exec)
        if (session === undefined) return internalError()
        return jsonify(await ctx.canvas.getContext({ sessionId: session.id }))
      })
    },
    presentCall: () => present('Get Canvas context', 'read'),
  }))

  ctx.tools.register(defineTool({
    name: 'canvas_list_renderers',
    description: LIST_RENDERERS_DESCRIPTION,
    parameters: {},
    output: { schema: { type: 'json' }, render: renderValue },
    isConcurrencySafe: () => true,
    execute() {
      return run(() => jsonify(ctx.canvas.listRenderers()))
    },
    presentCall: () => present('List Canvas renderers', 'read'),
  }))
}
