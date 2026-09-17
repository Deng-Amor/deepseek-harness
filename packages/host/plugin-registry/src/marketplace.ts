/**
 * MarketplaceService — 插件市场服务
 * 整合 YELEBAI 注册表发现 + 热插拔安装
 *
 * @module @deepseek-ai/dsh-plugin-registry/marketplace
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { RegistryClient, type RegistryPlugin, type RegistrySearchResult, type RegistryConfig } from './registry.ts'
import { PluginRegistry, type PluginInfo } from './index.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    marketplace: MarketplaceService
  }
}

/** 市场服务配置 */
export interface MarketplaceConfig {
  /** 注册表 URL */
  registryUrl?: string
  /** 缓存时间（分钟） */
  registryCacheMinutes?: number
  /** 请求超时（毫秒） */
  registryRequestTimeoutMs?: number
}

/** 安装结果 */
export interface InstallResult {
  pluginName: string
  version: string
  activated: boolean
  requiresRestart: boolean
  message: string
}

/** 市场服务 */
export class MarketplaceService extends Service {
  /** Client used to query the configured verified registry. */
  readonly registry: RegistryClient
  private pluginRegistry: PluginRegistry

  constructor(ctx: Context, config: MarketplaceConfig, pluginRegistry: PluginRegistry) {
    super(ctx, 'marketplace')
    this.pluginRegistry = pluginRegistry
    this.registry = new RegistryClient({
      url: config.registryUrl ?? undefined,
      cacheMs: (config.registryCacheMinutes ?? 15) * 60 * 1000,
      timeoutMs: config.registryRequestTimeoutMs ?? 10000,
    } as Partial<RegistryConfig>)
  }

  /**
   * 搜索注册表中的插件。
   *
   * @param query - 用空格分隔的搜索词。
   * @param page - 从 1 开始的结果页码。
   * @param sort - 结果排序方式。
   * @returns 匹配的插件页和总数。
   */
  async search(query: string, page: number = 1, sort: 'stars' | 'updated' = 'stars'): Promise<RegistrySearchResult> {
    return this.registry.search(query, page, sort)
  }

  /**
   * 查找一个注册表插件。
   *
   * @param fullName - 插件的完整注册表名称。
   * @returns 匹配的插件；找不到时返回 `undefined`。
   */
  async details(fullName: string): Promise<RegistryPlugin | undefined> {
    return this.registry.find(fullName)
  }

  /**
   * 获取注册表和本地安装数量。
   *
   * @returns 注册表生成时间、插件总数和本地安装数量。
   */
  async info(): Promise<{ pluginCount: number; generatedAt: string; installedCount: number }> {
    const regInfo = await this.registry.getRegistryInfo()
    const installed = await this.pluginRegistry.list()
    return { ...regInfo, installedCount: installed.length }
  }

  /**
   * 下载并激活注册表中的插件。
   *
   * @param fullName - 要安装的插件完整名称。
   * @returns 已安装插件的结果。
   */
  async install(fullName: string): Promise<InstallResult> {
    const plugin = await this.registry.find(fullName)
    if (!plugin) throw new Error(`插件 "${fullName}" 不在注册表中`)

    // 检查是否已安装
    const existing = await this.pluginRegistry.getInfo(plugin.packageName)
    if (existing) throw new Error(`插件 "${plugin.packageName}" 已安装`)

    // 根据 source 类型选择安装方式
    switch (plugin.install.source) {
      case 'github':
        return this.installFromGitHub(plugin)
      case 'npm':
        return this.installFromNpm(plugin)
      default:
        throw new Error(`不支持的安装源: ${plugin.install.source}`)
    }
  }

  /** 从 GitHub 安装 */
  private async installFromGitHub(plugin: RegistryPlugin): Promise<InstallResult> {
    // 1. 下载 GitHub release
    const info = await this.pluginRegistry.installFromGitHub({
      repo: plugin.fullName,
      ref: plugin.verifiedCommit,
    })
    // 2. 热插拔激活
    await this.pluginRegistry.activate(info.name)
    return {
      pluginName: info.name,
      version: info.version,
      activated: true,
      requiresRestart: false,
      message: `插件 "${info.name}" v${info.version} 已安装并激活`,
    }
  }

  /** 从 npm 安装 */
  private async installFromNpm(_plugin: RegistryPlugin): Promise<InstallResult> {
    // 对于 npm 源，需要先通过 pnpm 安装到 profile，再热插拔
    // 简化版实现
    throw new Error('npm 源安装暂未实现')
  }

  /**
   * 卸载一个本地插件。
   *
   * @param packageName - 要卸载的包名。
   */
  async uninstall(packageName: string): Promise<void> {
    await this.pluginRegistry.uninstall(packageName)
  }

  /**
   * 激活一个已安装插件。
   *
   * @param packageName - 要激活的包名。
   */
  async activate(packageName: string): Promise<void> {
    await this.pluginRegistry.activate(packageName)
  }

  /**
   * 停用一个活动插件。
   *
   * @param packageName - 要停用的包名。
   */
  async deactivate(packageName: string): Promise<void> {
    await this.pluginRegistry.deactivate(packageName)
  }

  /**
   * 列出本地已安装插件。
   *
   * @returns 已安装插件的当前记录。
   */
  async listInstalled(): Promise<PluginInfo[]> {
    return this.pluginRegistry.list()
  }
}

/** 插件名 */
export const name = 'marketplace'

/** 依赖的服务 */
export const inject = ['pluginRegistry']

/** 配置 */
export interface Config extends MarketplaceConfig {}

/** 市场服务入口 */
export function apply(ctx: Context, config: MarketplaceConfig): void {
  // 获取已存在的 PluginRegistry 实例
  const pluginRegistry = ctx.get('pluginRegistry') as PluginRegistry
  if (!pluginRegistry) throw new Error('pluginRegistry 服务未找到')

  // Service 构造函数已自动注册 marketplace
  new MarketplaceService(ctx, config, pluginRegistry)
}

export default apply
