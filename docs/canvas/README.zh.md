# Canvas

[English](README.md) | 中文

Canvas 是 DeepSeek Harness 的第一方持久化、可扩展可视化工作区。一个 Canvas 比创建它的会话（Session）存续更久，多个会话可以挂载并编辑同一份权威状态，而每个 Canvas 都将其展示委托给一个已注册的 renderer（渲染器）。该组由四个包组成：

- [`@deepseek-ai/dsh-canvas`](../../packages/canvas/canvas/src/index.ts) —— Host 服务、持久化存储、会话关联、renderer 注册表，以及面向 agent（智能体）的 Remote 表面。
- [`@deepseek-ai/dsh-tool-canvas`](../../packages/canvas/tool-canvas/src/index.ts) —— 面向模型的 Canvas 工具。
- [`@deepseek-ai/dsh-client-ui-canvas`](../../packages/canvas/ui-canvas/src/client/index.ts) —— 浏览器宿主页面与 `canvas.renderer` slot。
- [`@deepseek-ai/dsh-client-ui-canvas-json`](../../packages/canvas/ui-canvas-json/src/index.ts) —— 演示扩展接口的参考 renderer。

## 扩展 Canvas

Canvas 宿主拥有目录、存储与选择逻辑，但不包含任何 renderer 专属逻辑。一个 renderer 是一个独立插件，它注册一个 Host 描述符和一个浏览器端 `canvas.renderer` slot 条目。[扩展约定](extension.zh.md)定义了该接口；[renderer 指南](renderer-guide.zh.md)演示如何构建一个。

## 应用 renderer

Canvas 随附一个参考 renderer。[应用 renderer](renderers.zh.md)描述了 Canvas 插件可实现的领域 renderer——知识图谱可视化、3D 视口与节点工作流——以及每个 renderer 应拥有的状态。
