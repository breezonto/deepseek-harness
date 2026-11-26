# Canvas

English | [中文](README.zh.md)

Canvas is the first-party persistent, extensible visual workspace of DeepSeek Harness. One Canvas outlives the Session that created it, several Sessions can attach to and edit the same authoritative state, and each Canvas delegates its presentation to a registered renderer. The group is four packages:

- [`@deepseek-ai/dsh-canvas`](../../packages/canvas/canvas/src/index.ts) — Host service, durable store, Session associations, renderer registry, and the agent-facing Remote surface.
- [`@deepseek-ai/dsh-tool-canvas`](../../packages/canvas/tool-canvas/src/index.ts) — model-facing Canvas tools.
- [`@deepseek-ai/dsh-client-ui-canvas`](../../packages/canvas/ui-canvas/src/client/index.ts) — browser host page and the `canvas.renderer` slot.
- [`@deepseek-ai/dsh-client-ui-canvas-json`](../../packages/canvas/ui-canvas-json/src/index.ts) — reference renderer demonstrating the extension interface.

## Extending Canvas

The Canvas host owns catalog, storage, and selection but holds no renderer-specific logic. A renderer is an independent plugin that registers a Host descriptor and a browser `canvas.renderer` slot entry. The [extension contract](extension.md) defines that interface; the [renderer guide](renderer-guide.md) walks building one.

## Application renderers

Canvas ships one reference renderer. [Application renderers](renderers.md) describes the domain renderers a Canvas plugin can realize — knowledge-graph visualization, a 3D viewport, and node workflows — and the state each would own.
