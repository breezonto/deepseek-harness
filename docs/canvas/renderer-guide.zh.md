# 构建 Canvas renderer

[English](renderer-guide.md) | 中文

本教程从[扩展约定](extension.zh.md)定义的两个半边出发构建一个 Canvas renderer 插件。随附的 [JSON renderer](../../packages/canvas/ui-canvas-json/src/index.ts) 是可运行的参考；这里每一步都对应那个包所做的事情。

## 1. 前置条件

该插件除了 Canvas 已经提供的两项服务之外，不需要任何额外服务。Host 半边通过 `ctx.inject(['canvas'], ...)` 访问 Canvas 服务；浏览器半边注入 `slots`。renderer 类型来自 [`@deepseek-ai/dsh-canvas/client`](../../packages/canvas/canvas/src/client.ts)。

## 2. 注册 Host 描述符

Host 半边调用 `ctx.canvas.registerRenderer`，传入一个 `CanvasRendererDescriptor`。选择一个稳定的 `id` —— 浏览器 slot 条目会复用它 —— 并且仅当在创建 Canvas 时未指定 renderer 且本 renderer 应当胜出时，才设置 `default`。

## 3. 注册浏览器 slot 条目

浏览器半边以同一 id 注册到带键的 `canvas.renderer` slot。Canvas 宿主按该 id 挂载它，并传入 `canvasId`、`record` 与 `update`；组件从 `record` 渲染，并通过 `update` 写回。

## 4. 渲染并编辑状态

把 `record.state` 视为 renderer 拥有的不透明 JSON。渲染它；当用户编辑它时，以 `patch.state` 和你加载的 `record.revision` 调用 `update`。`canvas_conflict` 结果表示 Canvas 已在别处发生变化；重新加载并重试。

## 5. 将插件接入一个 profile

把该包声明为 web-app bundle 的依赖，并添加一个 `dsh.client` 行；node 半边执行描述符注册，浏览器半边执行 slot 条目注册。

```yaml
# One dsh.client row mounts both halves of a renderer package.
- id: ui-canvas-kg
  name: '@deepseek-ai/dsh-client-ui-canvas-kg'
```

在 agent preset 中挂载 `tool-canvas`，使 agent 能够用该 renderer 创建和更新 Canvas。

## 6. 验证

打开 Canvas 页面，创建一个 Canvas，并确认该 renderer 会针对选中的 `rendererId` 挂载。分别从页面和通过 agent 的 `canvas_update` 修改状态；两处编辑都应通过 `canvas/changed` 刷新。
