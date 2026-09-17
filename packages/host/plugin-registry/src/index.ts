/**
 * PluginRegistry — DSH 插件注册表服务
 * 管理插件安装、卸载、激活/停用（热插拔）
 *
 * @module @deepseek-ai/dsh-plugin-registry
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

// ── 类型定义 ──────────────────────────────────────────

export type PluginSource = { type: 'zip'; originalName: string } | { type: 'github'; repo: string; ref?: string }
export type PluginStatus = 'installed' | 'active' | 'error'

export interface PluginManifest {
  name: string
  version: string
  description: string
  author?: string
  license?: string
  entry: { host?: string; client?: string }
  inject?: string[]
  config?: Record<string, unknown>
  tools?: string[]
  platform?: string[]
  dsh?: { minVersion?: string; client?: boolean }
  hooks?: { onInstall?: string; onUninstall?: string; onActivate?: string; onDeactivate?: string }
  repository?: { type: string; url: string }
  homepage?: string
}

export interface PluginInfo {
  name: string
  version: string
  description: string
  manifest: PluginManifest
  status: PluginStatus
  installedAt: string
  source: PluginSource
  config: Record<string, unknown>
  error?: string | undefined
}

export interface PluginRegistryConfig {
  pluginsDir: string
  registryFile: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    pluginRegistry: PluginRegistry
  }
}

// ── 主服务 ─────────────────────────────────────────────

export class PluginRegistry extends Service {
  private installed = new Map<string, PluginInfo>()
  private activeEntries = new Map<string, string>()

  constructor(ctx: Context, readonly config: PluginRegistryConfig) {
    super(ctx, 'pluginRegistry')
  }

  /** 扫描插件目录 */
  async scan(): Promise<PluginInfo[]> {
    const results: PluginInfo[] = []
    const dir = this.config.pluginsDir
    if (!existsSync(dir)) { await mkdir(dir, { recursive: true }); return results }

    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pluginDir = join(dir, entry.name)
      const manifestPath = join(pluginDir, 'plugin.json')
      if (!existsSync(manifestPath)) continue
      try {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as PluginManifest
        const existing = this.installed.get(manifest.name)
        results.push({
          name: manifest.name, version: manifest.version, description: manifest.description, manifest,
          status: existing?.status ?? 'installed', installedAt: existing?.installedAt ?? new Date().toISOString(),
          source: existing?.source ?? { type: 'zip', originalName: 'unknown' },
          config: existing?.config ?? {},
          error: existing?.error,
        })
      } catch (err) {
        results.push({
          name: entry.name, version: '0.0.0', description: 'Invalid plugin.json', manifest: {} as PluginManifest,
          status: 'error', installedAt: new Date().toISOString(), source: { type: 'zip', originalName: 'unknown' },
          config: {}, error: String(err),
        })
      }
    }
    for (const info of results) this.installed.set(info.name, info)
    return results
  }

  /** 从 ZIP 安装 */
  async installFromZip(options: { zipData: Uint8Array; originalName: string }): Promise<PluginInfo> {
    const tempDir = join(this.config.pluginsDir, `.tmp-${Date.now()}`)
    try {
      await mkdir(tempDir, { recursive: true })
      await this.extractZip(options.zipData, tempDir)
      const manifestPath = join(tempDir, 'plugin.json')
      if (!existsSync(manifestPath)) throw new Error('ZIP 中未找到 plugin.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as PluginManifest
      if (!manifest.name || !manifest.version) throw new Error('plugin.json 缺少必填字段: name, version')

      const targetDir = join(this.config.pluginsDir, manifest.name)
      if (existsSync(targetDir)) throw new Error(`插件 "${manifest.name}" 已安装`)
      await mkdir(dirname(targetDir), { recursive: true })
      await this.moveDir(tempDir, targetDir)

      if (manifest.hooks?.onInstall) await this.runHook(targetDir, manifest.hooks.onInstall)

      const info: PluginInfo = {
        name: manifest.name, version: manifest.version, description: manifest.description, manifest,
        status: 'installed', installedAt: new Date().toISOString(),
        source: { type: 'zip', originalName: options.originalName }, config: {},
      }
      this.installed.set(manifest.name, info)
      await this.saveRegistry()
      return info
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  /** 从 GitHub 安装 */
  async installFromGitHub(options: { repo: string; ref?: string }): Promise<PluginInfo> {
    const { owner, repo } = this.parseGitHubRepo(options.repo)
    const ref = options.ref || 'main'
    const url = `https://api.github.com/repos/${owner}/${repo}/zipball/${ref}`
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } })
    if (!response.ok) throw new Error(`GitHub 下载失败: ${response.status} ${response.statusText}`)
    return this.installFromZip({
      zipData: new Uint8Array(await response.arrayBuffer()),
      originalName: `github:${owner}/${repo}@${ref}`,
    })
  }

  /** 卸载插件 */
  async uninstall(pluginName: string): Promise<void> {
    const info = this.installed.get(pluginName)
    if (!info) throw new Error(`插件 "${pluginName}" 未安装`)
    if (info.status === 'active') await this.deactivate(pluginName)

    const pluginDir = join(this.config.pluginsDir, pluginName)
    if (info.manifest.hooks?.onUninstall && existsSync(pluginDir)) {
      await this.runHook(pluginDir, info.manifest.hooks.onUninstall)
    }
    await rm(pluginDir, { recursive: true, force: true })
    this.installed.delete(pluginName)
    this.activeEntries.delete(pluginName)
    await this.saveRegistry()
  }

  /** 激活插件（热插拔） */
  async activate(pluginName: string): Promise<void> {
    const info = this.installed.get(pluginName)
    if (!info) throw new Error(`插件 "${pluginName}" 未安装`)
    if (info.status === 'active') return

    const pluginDir = join(this.config.pluginsDir, pluginName)
    if (!existsSync(pluginDir)) throw new Error(`插件目录不存在: ${pluginDir}`)

    try {
      const entryId = await this.ctx.loader.create({
        // 相对入口路径解析到插件目录（loader 以 baseUrl 解析相对路径，
        // 因此必须先把 ./dist/server.js 变成绝对路径）
        name: this.resolveEntryName(info.manifest.entry.host || pluginName, pluginDir),
        config: info.config,
        inject: info.manifest.inject as never,
      })
      info.status = 'active'
      this.activeEntries.set(pluginName, entryId)
      if (info.manifest.hooks?.onActivate && existsSync(pluginDir)) {
        await this.runHook(pluginDir, info.manifest.hooks.onActivate)
      }
      await this.saveRegistry()
    } catch (err) {
      info.status = 'error'
      info.error = String(err)
      await this.saveRegistry()
      throw err
    }
  }

  /**
   * 把插件的入口模块名解析为 loader 可导入的形式。
   * 相对路径（./ 或 ../ 开头）解析到插件目录的绝对路径；
   * cordis: 内置、npm 包名、绝对路径原样返回。
   */
  private resolveEntryName(entry: string, pluginDir: string): string {
    if (entry.startsWith('./') || entry.startsWith('../')) {
      // Windows 下 ESM 加载器要求绝对路径必须是 file:// URL
      return pathToFileURL(resolve(pluginDir, entry)).href
    }
    return entry
  }

  /** 停用插件（热卸载） */
  async deactivate(pluginName: string): Promise<void> {
    const info = this.installed.get(pluginName)
    if (!info || info.status !== 'active') return

    const entryId = this.activeEntries.get(pluginName)
    if (entryId) {
      const pluginDir = join(this.config.pluginsDir, pluginName)
      if (info.manifest.hooks?.onDeactivate && existsSync(pluginDir)) {
        await this.runHook(pluginDir, info.manifest.hooks.onDeactivate)
      }
      await this.ctx.loader.remove(entryId)
      this.activeEntries.delete(pluginName)
    }
    info.status = 'installed'
    await this.saveRegistry()
  }

  async getConfig(pluginName: string): Promise<Record<string, unknown>> {
    const info = this.installed.get(pluginName)
    if (!info) throw new Error(`插件 "${pluginName}" 未安装`)
    return { ...info.config }
  }

  async setConfig(pluginName: string, config: Record<string, unknown>): Promise<void> {
    const info = this.installed.get(pluginName)
    if (!info) throw new Error(`插件 "${pluginName}" 未安装`)
    info.config = { ...info.config, ...config }
    await this.saveRegistry()
    if (info.status === 'active') {
      const entryId = this.activeEntries.get(pluginName)
      if (entryId) {
        await this.ctx.loader.update(entryId, { config: info.config } as never)
      }
    }
  }

  async getInfo(pluginName: string): Promise<PluginInfo | null> {
    return this.installed.get(pluginName) ?? null
  }

  async list(): Promise<PluginInfo[]> {
    return [...this.installed.values()]
  }

  private parseGitHubRepo(repo: string): { owner: string; repo: string } {
    const m = repo.match(/(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/)
      || repo.match(/^([^/]+)\/([^/]+)$/)
    if (!m) throw new Error(`无法解析 GitHub 仓库: ${repo}`)
    const [_, owner, repoName] = m
    if (owner === undefined || repoName === undefined) throw new Error(`无法解析 GitHub 仓库: ${repo}`)
    return { owner, repo: repoName.replace(/\.git$/, '') }
  }

  private async extractZip(data: Uint8Array, targetDir: string): Promise<void> {
    const zipPath = join(targetDir, '..', 'temp.zip')
    await writeFile(zipPath, data)
    try {
      const { execSync } = await import('node:child_process')
      const opts: import('node:child_process').ExecSyncOptions = { stdio: 'pipe' }
      if (process.platform === 'win32') {
        execSync(
          `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`,
          opts,
        )
      } else {
        execSync(`unzip -o "${zipPath}" -d "${targetDir}"`, opts)
      }
    } finally {
      await rm(zipPath, { force: true })
    }
  }

  private async moveDir(src: string, dest: string): Promise<void> {
    const entries = await readdir(src)
    // GitHub zip 通常包含一个顶层目录
    if (entries.length === 1) {
      const [entry] = entries
      if (entry === undefined) return
      const single = join(src, entry)
      const { stat } = await import('node:fs/promises')
      if ((await stat(single)).isDirectory()) {
        await mkdir(dest, { recursive: true })
        const inner = await readdir(single)
        for (const item of inner) {
          const { execSync } = await import('node:child_process')
          const opts: import('node:child_process').ExecSyncOptions = { stdio: 'pipe' }
          const cmd = process.platform === 'win32'
            ? `move "${join(single, item)}" "${join(dest, item)}"`
            : `mv "${join(single, item)}" "${join(dest, item)}"`
          execSync(cmd, opts)
        }
        return
      }
    }
    await mkdir(dirname(dest), { recursive: true })
    const { execSync } = await import('node:child_process')
    const opts: import('node:child_process').ExecSyncOptions = { stdio: 'pipe' }
    const cmd = process.platform === 'win32'
      ? `move "${src}" "${dest}"`
      : `mv "${src}" "${dest}"`
    execSync(cmd, opts)
  }

  private async runHook(pluginDir: string, script: string): Promise<void> {
    if (!script || !script.trim()) return
    const { execSync } = await import('node:child_process')
    ;(execSync as (cmd: string, opts: Record<string, unknown>) => void)(script, {
      cwd: pluginDir, stdio: 'inherit', shell: true,
    })
  }

  private async saveRegistry(): Promise<void> {
    await mkdir(dirname(this.config.registryFile), { recursive: true })
    await writeFile(this.config.registryFile, JSON.stringify([...this.installed.values()], null, 2), 'utf-8')
  }

  async loadRegistry(): Promise<void> {
    try {
      const data = JSON.parse(await readFile(this.config.registryFile, 'utf-8')) as PluginInfo[]
      for (const info of data) this.installed.set(info.name, info)
    } catch {
      // 文件不存在, 忽略
    }
  }
}

/** 插件名 */
export const name = 'plugin-registry'

/** 依赖的服务 */
export const inject = ['loader']

/** 插件入口 */
export function apply(ctx: Context, config: PluginRegistryConfig): void {
  // Service 构造函数已自动注册 pluginRegistry（ctx.reflect.provide）
  const registry = new PluginRegistry(ctx, config)
  void registry.loadRegistry().then(() => registry.scan())
}

export default apply
