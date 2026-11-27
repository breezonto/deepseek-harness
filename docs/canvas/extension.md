# Canvas renderer extension

English | [中文](extension.zh.md)

A Canvas renderer is an independent plugin that teaches Canvas how to present and edit one kind of content. The host owns the durable record, the catalog, and selection; the renderer owns the presentation. This page is the contract a renderer plugin satisfies. [The guide](renderer-guide.md) walks a concrete build.

## Two halves

A renderer registers on two planes, linked by one renderer id:

- **Host descriptor** — the plugin's Host half calls `ctx.canvas.registerRenderer(descriptor)` so the catalog and the `canvas_list_renderers` tool discover it.
- **Browser slot entry** — the plugin's browser half registers a `canvas.renderer` slot entry under the same id; the Canvas host mounts it when a Canvas selects that renderer.

The reference renderer shows the split: the descriptor lives in [the JSON renderer Host half](../../packages/canvas/ui-canvas-json/src/index.ts) and the slot entry in [its browser half](../../packages/canvas/ui-canvas-json/src/client/index.ts).

## The descriptor

`CanvasRendererDescriptor` names the renderer and its opt-in capabilities. Its fields are `id`, `name`, `description`, `contentTypes`, `capabilities`, and an optional `default`; the capability flags are `selection`, `interaction`, `serialization`, and `application`. A renderer that advertises `application` is a standalone application: the Canvas host surfaces it as a top-level tab, provisioning a singleton Canvas for it, instead of behind the catalog and metadata chrome. The host validates a `rendererId` against the registered set and picks a default by the `default` flag, falling back to the first registered renderer. The type is declared in [types.ts](../../packages/canvas/canvas/src/types.ts); the registry and default selection live in [index.ts](../../packages/canvas/canvas/src/index.ts).

## The slot and its owner props

The browser host declares the keyed `canvas.renderer` slot in [slots.ts](../../packages/canvas/ui-canvas/src/client/contract/slots.ts). When a Canvas selects a renderer, the host mounts the slot entry whose key equals the Canvas `rendererId` and passes `CanvasRendererOwnerProps`:

- `canvasId` — the Canvas identity.
- `record` — the authoritative `CanvasRecord`.
- `update` — the validated write path back to the host.

The host stores and forwards the state but never interprets it.

## State, revision, and concurrency

A renderer owns the Canvas `state`, which is opaque lossless JSON (`JsonValue`). The host stores it unchanged and returns it in `record.state`. To change it the renderer calls `update({ id, patch: { state }, expectedRevision })`; a stale `expectedRevision` returns `canvas_conflict` instead of overwriting, and every committed change emits `canvas/changed` so other Sessions and the browser refresh. The event is declared in [types.ts](../../packages/canvas/canvas/src/types.ts) and forwarded to the browser through [api-remotes](../../packages/api/remotes/src/remote-events.ts).

## Discovery

The agent-facing `canvas_list_renderers` tool and the `listRenderers` Remote return the registered roster. A renderer needs only its two halves; it requires no additional Host service.

## Wiring

A renderer plugin follows the ordinary bundle wiring: declare the package as a dependency, add its `dsh.client` row, and mount `tool-canvas` in the agent preset for the model-facing tools. The shipped JSON renderer row lives in [web-app's patch](../../packages/bundle/web-app/cordis.patch.yml).
