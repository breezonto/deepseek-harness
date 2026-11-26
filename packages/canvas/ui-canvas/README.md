# @deepseek-ai/dsh-client-ui-canvas

Canvas host, browser half. Adds the **Canvas** sidebar entry between Corpora and Automation tasks, opens the management page, and declares the keyed `canvas.renderer` slot that renderer plugins register into. The page owns the Canvas catalog, selection, metadata, and management actions, and mounts one renderer per Canvas by its `rendererId`. It holds no renderer-specific logic.
