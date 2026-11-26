# 应用 renderer

[English](renderers.md) | 中文

Canvas 随附一个参考 renderer。一个 Canvas 插件可以通过拥有 renderer 专属的状态并声明其提供的能力来实现一个领域 renderer；[扩展约定](extension.zh.md)固定了该接口。本页描述三类应用 renderer 的领域形态。

## 知识图谱可视化

知识图谱 renderer 呈现节点与边，并让 agent 与用户扩展和标注图谱。它拥有的状态形状是一个节点与边列表：

```json
{ "nodes": [{ "id": "n1", "label": "Canvas", "kind": "concept" }], "edges": [{ "from": "n1", "to": "n2" }] }
```

它声明 `selection` 与 `interaction` 能力，并在 `contentTypes` 中列出它处理的图谱媒体类型。

## 3D 视口

3D 视口 renderer 呈现一个场景，并把重量级资产排除在 Canvas 状态之外。它把相机与场景元数据存入 `state`，并通过 `CanvasResourceReference` 引用网格与纹理，从而让宿主在追踪引用时不内嵌这些资产。

## 节点工作流

节点工作流 renderer 呈现一个由带类型的节点及其端口组成的图。它把工作流存入 `state` 并声明 `interaction` 与 `serialization`；`canvas_update` 等 agent 工具写入该图，用户则通过同一条 `update` 路径编辑它。
