/** Canvas host page and sidebar entry copy. */
export type CanvasLocaleKey =
  | 'panel'
  | 'empty.title'
  | 'empty.body'
  | 'loading'
  | 'error'
  | 'retry'
  | 'rendererUnavailable'
  | 'sidebar.title'
  | 'sidebar.toggle'

export const en: Record<CanvasLocaleKey, string> = {
  panel: 'Canvas',
  'empty.title': 'No Canvas application',
  'empty.body': 'Canvas hosts application renderers from plugins. Install an application renderer to open it here.',
  loading: 'Loading…',
  error: 'The Canvas catalog could not be loaded.',
  retry: 'Retry',
  rendererUnavailable: 'This Canvas uses a renderer that is not available. Its content is preserved.',
  'sidebar.title': 'Inspector',
  'sidebar.toggle': 'Toggle inspector',
}

export const zh: Record<CanvasLocaleKey, string> = {
  panel: 'Canvas',
  'empty.title': '没有 Canvas 应用',
  'empty.body': 'Canvas 承载来自插件的应用渲染器。安装一个应用渲染器以在此打开。',
  loading: '加载中…',
  error: '无法加载 Canvas 列表。',
  retry: '重试',
  rendererUnavailable: '此 Canvas 使用的渲染器不可用。其内容已保留。',
  'sidebar.title': '检查器',
  'sidebar.toggle': '切换检查器',
}
