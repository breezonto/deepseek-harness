/** Canvas management page and sidebar entry copy. */
export type CanvasLocaleKey =
  | 'panel'
  | 'empty.title'
  | 'empty.body'
  | 'create'
  | 'create.placeholder'
  | 'rename'
  | 'delete'
  | 'delete.confirm'
  | 'loading'
  | 'error'
  | 'retry'
  | 'noRenderer'
  | 'rendererUnavailable'
  | 'meta.renderer'
  | 'meta.revision'
  | 'meta.created'
  | 'meta.updated'

export const en: Record<CanvasLocaleKey, string> = {
  panel: 'Canvas',
  'empty.title': 'No Canvas yet',
  'empty.body': 'Create a Canvas to start a persistent visual workspace.',
  create: 'New Canvas',
  'create.placeholder': 'Canvas name',
  rename: 'Rename',
  delete: 'Delete',
  'delete.confirm': 'Delete this Canvas? Its chat sessions and external resources are not deleted.',
  loading: 'Loading…',
  error: 'The Canvas catalog could not be loaded.',
  retry: 'Retry',
  noRenderer: 'No renderer is selected for this Canvas.',
  rendererUnavailable: 'This Canvas uses a renderer that is not available. Its content is preserved.',
  'meta.renderer': 'Renderer',
  'meta.revision': 'Revision',
  'meta.created': 'Created',
  'meta.updated': 'Updated',
}

export const zh: Record<CanvasLocaleKey, string> = {
  panel: 'Canvas',
  'empty.title': '还没有 Canvas',
  'empty.body': '创建一个 Canvas 以开始一个持久的可视化工作区。',
  create: '新建 Canvas',
  'create.placeholder': 'Canvas 名称',
  rename: '重命名',
  delete: '删除',
  'delete.confirm': '删除此 Canvas？其关联的聊天会话和外部资源不会被删除。',
  loading: '加载中…',
  error: '无法加载 Canvas 列表。',
  retry: '重试',
  noRenderer: '此 Canvas 未选择渲染器。',
  rendererUnavailable: '此 Canvas 使用的渲染器不可用。其内容已保留。',
  'meta.renderer': '渲染器',
  'meta.revision': '修订',
  'meta.created': '创建时间',
  'meta.updated': '更新时间',
}
