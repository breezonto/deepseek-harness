# Canvas renderer 扩展

[English](extension.md) | 中文

Canvas renderer 是一个独立插件，它教会 Canvas 如何呈现并编辑一类内容。宿主拥有持久化记录、目录与选择逻辑；renderer 拥有呈现逻辑。本页是 renderer 插件需要满足的约定。[指南](renderer-guide.zh.md)演示一次具体构建。

## 两个半边

一个 renderer 在两个平面注册，二者由同一个 renderer id 关联：

- **Host 描述符** —— 插件的 Host 半边调用 `ctx.canvas.registerRenderer(descriptor)`，使目录与 `canvas_list_renderers` 工具能够发现它。
- **浏览器 slot 条目** —— 插件的浏览器半边以同一 id 注册一个 `canvas.renderer` slot 条目；当某个 Canvas 选择该 renderer 时，Canvas 宿主会挂载它。

参考 renderer 展示了这种拆分：描述符位于 [JSON renderer 的 Host 半边](../../packages/canvas/ui-canvas-json/src/index.ts)，slot 条目位于[其浏览器半边](../../packages/canvas/ui-canvas-json/src/client/index.ts)。

## 描述符

`CanvasRendererDescriptor` 命名 renderer 及其可选的各项能力。其字段为 `id`、`name`、`description`、`contentTypes`、`capabilities` 与可选的 `default`；能力标志为 `selection`、`interaction`、`serialization` 与 `application`。声明 `application` 的 renderer 是一个独立应用：Canvas 宿主会将其作为顶层标签页呈现，并为其提供单一 Canvas，而非置于目录与元数据界面之后。宿主会依据已注册集合校验 `rendererId`，并依据 `default` 标志选择默认项，若无则回退到第一个已注册的 renderer。该类型声明于 [types.ts](../../packages/canvas/canvas/src/types.ts)；注册表与默认选择逻辑位于 [index.ts](../../packages/canvas/canvas/src/index.ts)。

## slot 及其宿主属性

浏览器宿主在 [slots.ts](../../packages/canvas/ui-canvas/src/client/contract/slots.ts) 中声明带键的 `canvas.renderer` slot。当某个 Canvas 选择 renderer 时，宿主挂载键等于该 Canvas `rendererId` 的 slot 条目，并传入 `CanvasRendererOwnerProps`：

- `canvasId` —— Canvas 身份。
- `record` —— 权威的 `CanvasRecord`。
- `update` —— 写回宿主的经过校验的写入路径。

宿主只存储并转发状态，从不解释它。

## 状态、修订与并发

renderer 拥有 Canvas 的 `state`，它是不透明的无损 JSON（`JsonValue`）。宿主原样存储它，并在 `record.state` 中返回。要修改它，renderer 调用 `update({ id, patch: { state }, expectedRevision })`；陈旧的 `expectedRevision` 会返回 `canvas_conflict` 而非覆盖，且每次已提交的修改都会发出 `canvas/changed`，使其他会话与浏览器刷新。该事件声明于 [types.ts](../../packages/canvas/canvas/src/types.ts)，并经 [api-remotes](../../packages/api/remotes/src/remote-events.ts) 转发到浏览器。

## 发现

面向 agent 的 `canvas_list_renderers` 工具与 `listRenderers` Remote 返回已注册的名册。一个 renderer 只需要它的两个半边，无需任何额外的 Host 服务。

## 接线

renderer 插件遵循普通的 bundle 接线方式：将包声明为依赖、添加其 `dsh.client` 行，并在 agent preset 中挂载 `tool-canvas` 以获得面向模型的工具。随附的 JSON renderer 行位于 [web-app 的 patch](../../packages/bundle/web-app/cordis.patch.yml)。
