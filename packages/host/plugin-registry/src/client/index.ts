/**
 * Plugin Marketplace UI — 浏览器端插件市场页面
 * 注册到 Web Settings 的插件标签页，提供搜索/浏览/一键安装
 *
 * @module @deepseek-ai/dsh-plugin-registry/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'

/** 市场插件信息（客户端视图） */
export interface MarketplacePluginView {
  fullName: string
  description: string | null
  stars: number
  language: string | null
  license: string | null
  updatedAt: string
  packageName: string
  version: string
  installMode: 'automatic' | 'guided'
  installSource: 'github' | 'npm' | 'tarball' | 'manual'
  profiles: string[]
  requiresRestart: boolean
  hasClient: boolean
  htmlUrl: string
}

/** 远程服务接口 */
interface MarketplaceRemote {
  search(query: string, page: number, sort: string): Promise<{ totalCount: number; items: MarketplacePluginView[] }>
  details(fullName: string): Promise<MarketplacePluginView | undefined>
  info(): Promise<{ pluginCount: number; generatedAt: string; installedCount: number }>
  install(fullName: string): Promise<{ pluginName: string; version: string; activated: boolean; requiresRestart: boolean; message: string }>
  uninstall(packageName: string): Promise<void>
  activate(packageName: string): Promise<void>
  deactivate(packageName: string): Promise<void>
  listInstalled(): Promise<unknown[]>
}

declare module '@deepseek-ai/dsh-api-remotes/client' {
  interface RemoteServiceMap {
    marketplace: MarketplaceRemote
  }
}

/** 字典命名空间 */
const NS = 'settings.marketplace'

/** 中文字典 */
const zh = {
  title: '插件市场',
  search: '搜索插件...',
  install: '安装',
  installing: '安装中...',
  installed: '已安装',
  uninstall: '卸载',
  activate: '启用',
  deactivate: '停用',
  active: '运行中',
  stars: '⭐ {count}',
  loading: '加载中...',
  noResults: '没有找到匹配的插件',
  installSuccess: '插件 "{name}" 安装成功',
  installError: '安装失败: {message}',
  requiresRestart: '需要重启生效',
  githubSource: 'GitHub',
  npmSource: 'npm',
  totalPlugins: '共 {count} 个插件',
  refresh: '刷新',
  backToTop: '返回顶部',
}

/** 英文字典 */
const en = {
  title: 'Plugin Marketplace',
  search: 'Search plugins...',
  install: 'Install',
  installing: 'Installing...',
  installed: 'Installed',
  uninstall: 'Uninstall',
  activate: 'Activate',
  deactivate: 'Deactivate',
  active: 'Active',
  stars: '⭐ {count}',
  loading: 'Loading...',
  noResults: 'No matching plugins found',
  installSuccess: 'Plugin "{name}" installed successfully',
  installError: 'Install failed: {message}',
  requiresRestart: 'Requires restart',
  githubSource: 'GitHub',
  npmSource: 'npm',
  totalPlugins: '{count} plugins total',
  refresh: 'Refresh',
  backToTop: 'Back to top',
}

/**
 * 注册插件市场 UI 到设置页面
 */
export function apply(ctx: ClientContext): void {
  // 注册字典
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-marketplace: dictionaries')

  // 注册市场标签页
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'plugin-marketplace',
    order: 10,
    locale: NS,
    render: props => ({
      tab: {
        id: 'marketplace',
        label: props.t('title'),
        render: () => createMarketplaceTab(props),
      },
    }),
  }))
}

/** 创建市场标签页 */
function createMarketplaceTab(props: unknown): { type: string; props: unknown } {
  // 实际渲染由 React 组件处理
  return { type: 'plugin-marketplace', props }
}

export default apply
