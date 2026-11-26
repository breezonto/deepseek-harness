# Application renderers

English | [中文](renderers.zh.md)

Canvas ships one reference renderer. A Canvas plugin can realize a domain renderer by owning a renderer-specific state and advertising the capabilities it offers; the [extension contract](extension.md) fixes the interface. This page describes the domain shapes three application renderers take.

## Knowledge-graph visualization

A knowledge-graph renderer presents nodes and edges and lets the agent and the user expand and annotate the graph. It owns state shaped as a node and edge list:

```json
{ "nodes": [{ "id": "n1", "label": "Canvas", "kind": "concept" }], "edges": [{ "from": "n1", "to": "n2" }] }
```

It advertises the `selection` and `interaction` capabilities and names the graph media types it handles in `contentTypes`.

## 3D viewport

A 3D viewport renderer presents a scene and keeps heavyweight assets out of the Canvas state. It stores camera and scene metadata in `state` and references meshes and textures through `CanvasResourceReference`, so the host tracks the references without embedding the assets.

## Node workflows

A node-workflow renderer presents a graph of typed nodes and their ports. It stores the workflow in `state` and advertises `interaction` and `serialization`; agent tools such as `canvas_update` write the graph while the user edits it through the same `update` path.
