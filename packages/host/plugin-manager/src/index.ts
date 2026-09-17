/**
 * Plugin-Manager — Remote interface for plugin management operations.
 *
 * Wraps the PluginRegistry service with Typert remote methods so the
 * Web GUI client can install, activate, deactivate, and uninstall plugins.
 *
 * @module @deepseek-ai/dsh-host-plugin-manager
 */

import type { Context } from '@deepseek-ai/cordis'
import type { PluginRegistry } from '@deepseek-ai/dsh-plugin-registry'
import type { MarketplaceService } from '@deepseek-ai/dsh-plugin-registry/marketplace'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { PluginManagerListEntry as PluginManagerEntry, PluginMarketplaceSearchResult } from './types.ts'

export type * from './types.ts'

/** Remote service exposing plugin management operations to the Web GUI. */
export class PluginManagerGateway extends TypertRemoteService {
  static inject = ['pluginRegistry', 'marketplace']

  constructor(ctx: Context) {
    super(ctx, 'pluginManager')
  }

  /** Get the PluginRegistry instance. */
  private get registry(): PluginRegistry {
    return this.ctx.get('pluginRegistry') as PluginRegistry
  }

  /** Get the verified marketplace service. */
  private get marketplace(): MarketplaceService {
    return this.ctx.get('marketplace') as MarketplaceService
  }

  /** List all installed plugins with their status. */
  @Remote('list')
  async list(): Promise<PluginManagerEntry[]> {
    try {
      const plugins = await this.registry.list()
      return plugins.map(p => ({
        name: p.name,
        version: p.version,
        description: p.description,
        status: p.status,
        author: p.manifest.author ?? '',
        tools: (p.manifest.tools ?? []).join(', '),
        ...(p.error !== undefined ? { error: p.error } : {}),
      }))
    } catch (_err) {
      return []
    }
  }

  /** Activate (hot-plug) a plugin. */
  @Remote('activate')
  async activate(pluginName: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.registry.activate(pluginName)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  /** Deactivate (hot-unplug) a plugin. */
  @Remote('deactivate')
  async deactivate(pluginName: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.registry.deactivate(pluginName)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  /** Uninstall a plugin completely. */
  @Remote('uninstall')
  async uninstall(pluginName: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.registry.uninstall(pluginName)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  /** Install from a URL (GitHub release ZIP or direct ZIP). */
  @Remote('installFromUrl')
  async installFromUrl(url: string): Promise<{
    ok: boolean
    plugin?: PluginManagerEntry
    error?: string
  }> {
    try {
      // Try GitHub short format first
      if (url.includes('github.com') || url.includes('/')) {
        const repoMatch = url.match(/(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/)
          || url.match(/^([^/]+)\/([^/]+)$/)
        if (repoMatch) {
          const [_, owner, repoName] = repoMatch
          if (owner === undefined || repoName === undefined) throw new Error('无法解析 GitHub 仓库')
          const repo = `${owner}/${repoName.replace(/\.git$/, '')}`
          const info = await this.registry.installFromGitHub({ repo })
          return {
            ok: true,
            plugin: {
              name: info.name, version: info.version, description: info.description,
              status: info.status, author: info.manifest.author ?? '',
              tools: (info.manifest.tools ?? []).join(', '),
            },
          }
        }
      }
      // Fallback: download ZIP from URL
      const response = await fetch(url)
      if (!response.ok) throw new Error(`下载失败: ${response.status}`)
      const zipData = new Uint8Array(await response.arrayBuffer())
      const info = await this.registry.installFromZip({
        zipData,
        originalName: url.split('/').pop() ?? 'plugin.zip',
      })
      return {
        ok: true,
        plugin: {
          name: info.name, version: info.version, description: info.description,
          status: info.status, author: info.manifest.author ?? '',
          tools: (info.manifest.tools ?? []).join(', '),
        },
      }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  /** Search the configured verified marketplace. */
  @Remote('searchMarketplace')
  async searchMarketplace(query: string): Promise<PluginMarketplaceSearchResult> {
    const result = await this.marketplace.search(query)
    const installed = new Set((await this.registry.list()).map(plugin => plugin.name))
    return {
      totalCount: result.totalCount,
      items: result.items.map(plugin => ({
        fullName: plugin.fullName,
        packageName: plugin.packageName,
        version: plugin.version,
        description: plugin.description ?? '',
        stars: plugin.stars,
        source: plugin.install.source,
        installed: installed.has(plugin.packageName),
      })),
    }
  }

  /** Install and activate one verified marketplace plugin. */
  @Remote('installMarketplace')
  async installMarketplace(fullName: string): Promise<{ ok: boolean; plugin?: PluginManagerEntry; error?: string }> {
    try {
      const info = await this.marketplace.install(fullName)
      const plugin = await this.registry.getInfo(info.pluginName)
      if (!plugin) throw new Error(`安装后找不到插件 "${info.pluginName}"`)
      return {
        ok: true,
        plugin: {
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
          status: plugin.status,
          author: plugin.manifest.author ?? '',
          tools: (plugin.manifest.tools ?? []).join(', '),
        },
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export default PluginManagerGateway
