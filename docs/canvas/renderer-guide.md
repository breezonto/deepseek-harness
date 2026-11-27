# Building a Canvas renderer

English | [中文](renderer-guide.zh.md)

This tutorial builds a Canvas renderer plugin from the two halves the [extension contract](extension.md) defines. The shipped [JSON renderer](../../packages/canvas/ui-canvas-json/src/index.ts) is the working reference; each step here is what that package does.

## 1. Prerequisites

The plugin needs no service beyond the two Canvas already provides. The Host half reaches the Canvas service through `ctx.inject(['canvas'], ...)`; the browser half injects `slots`. Renderer types come from [`@deepseek-ai/dsh-canvas/client`](../../packages/canvas/canvas/src/client.ts).

## 2. Register the Host descriptor

The Host half calls `ctx.canvas.registerRenderer` with a `CanvasRendererDescriptor`. Pick a stable `id` — the browser slot entry reuses it — and set `default` only when this renderer should win when a Canvas is created without one. Advertise the `application` capability when the renderer is a standalone application: the Canvas host then surfaces it as a top-level tab.

## 3. Register the browser slot entry

The browser half registers into the keyed `canvas.renderer` slot under the same id. The Canvas host mounts it by that id and passes `canvasId`, `record`, and `update`; the component renders from `record` and writes back through `update`.

## 4. Render and edit the state

Treat `record.state` as opaque JSON owned by the renderer. Render it, and when the user edits it, call `update` with `patch.state` and the `record.revision` you loaded. A `canvas_conflict` result means the Canvas changed elsewhere; reload and retry.

## 5. Wire the plugin into a profile

Declare the package as a dependency of the web-app bundle and add one `dsh.client` row; the node half runs the descriptor registration and the browser half runs the slot entry.

```yaml
# One dsh.client row mounts both halves of a renderer package.
- id: ui-canvas-kg
  name: '@deepseek-ai/dsh-client-ui-canvas-kg'
```

Mount `tool-canvas` in the agent preset so agents can create and update Canvases with this renderer.

## 6. Verify

Open the Canvas page and confirm the renderer mounts: an `application` renderer appears as a top-level tab, otherwise create a Canvas through the `canvas_create` tool and select the renderer. Change the state from the page and from an agent through `canvas_update`; both edits should refresh through `canvas/changed`.
