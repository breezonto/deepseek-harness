---
description: "Persistent, extensible visual workspace: renderer registry, durable shared state, cross-session associations, and agent tools."
kind: "package-reference"
---

# @deepseek-ai/dsh-canvas

Canvas is a persistent visual working environment for DeepSeek Harness. It hosts independently registered renderers (3D scenes, node editors, knowledge graphs, dashboards, document previews) without depending on any domain-specific framework. A Canvas has a stable id independent of any chat Session, an authoritative renderer-owned `state`, and a revision for optimistic concurrency. Several Sessions can attach to and edit the same Canvas; it survives the Session that created it.

## Packages

| Package | Role |
| --- | --- |
| `@deepseek-ai/dsh-canvas` | Host service: durable storage, Session associations, renderer registry, `canvas/changed` event, `@Remote` methods. |
| `@deepseek-ai/dsh-tool-canvas` | Model-facing tools: `canvas_list`, `canvas_create`, `canvas_get`, `canvas_attach`, `canvas_detach`, `canvas_update`, `canvas_get_context`, `canvas_list_renderers`. |
| `@deepseek-ai/dsh-client-ui-canvas` | Browser half: the **Canvas** sidebar entry, the management page, and the keyed `canvas.renderer` slot contract. |
| `@deepseek-ai/dsh-client-ui-canvas-json` | Reference renderer registered through the public extension interface. |

## Public renderer extension interface

A third-party plugin extends Canvas without modifying it:

**Host half** — register a descriptor:

```ts
ctx.inject(['canvas'], (ctx) => {
  ctx.canvas.registerRenderer({
    id: 'canvas.example',          // links to the Client slot key
    name: 'Example renderer',
    description: 'Renders example content.',
    contentTypes: ['application/x-example'],
    capabilities: { interaction: true, serialization: true },
  })
})
```

**Client half** — register the component under the keyed slot:

```ts
ctx.slots.inject('canvas.renderer', () => ctx.slots.register({
  name: 'canvas.renderer',
  key: 'canvas.example',
}, ExampleRenderer))
```

The mounted component receives `CanvasRendererOwnerProps`: `{ canvasId, record, update }`. `record` is the authoritative `CanvasRecord`; `update(request)` submits a validated change (returning `CanvasRecord`, `canvas_not_found`, or `canvas_conflict`). The renderer must not keep its own authoritative copy.

## Agent tools

`canvas_list`, `canvas_create`, `canvas_get`, `canvas_attach`, `canvas_detach`, `canvas_update`, `canvas_get_context`, `canvas_list_renderers`. Summaries omit `state` (progressive context retrieval); agents request full state on demand with `canvas_get`. Renderer content is untrusted data.

## Concurrency

`canvas_update` accepts `expectedRevision`; a mismatch returns `{ id, code: 'canvas_conflict', currentRevision }` and changes nothing.

## Security

Canvas methods touch the `global` resource: the owner Peer always passes, and a non-owner Peer is denied unless a future `remote-access` policy grants it. Renderer state and resources are untrusted data; the frontend renderer is not a security sandbox.

## Known limitations

One active renderer per Canvas (composite layouts are future work); no CRDT, undo/redo, or revision history; non-owner access control is not yet wired beyond the secure owner default; `resources` are opaque references.
