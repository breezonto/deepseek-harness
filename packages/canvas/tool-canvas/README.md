# @deepseek-ai/dsh-tool-canvas

Model-facing Canvas tools over the Host `ctx.canvas` service. Mounting this plugin registers `canvas_list`, `canvas_create`, `canvas_get`, `canvas_attach`, `canvas_detach`, `canvas_update`, `canvas_get_context`, and `canvas_list_renderers` in the mounting scope. Mutations that accept `expectedRevision` return `canvas_conflict` instead of overwriting newer state.
