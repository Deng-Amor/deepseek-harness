/**
 * RegistryClient — 兼容 YELEBAI 注册表格式的客户端
 * 从中央注册表加载、缓存、搜索已验证的 DSH 插件
 *
 * @module @deepseek-ai/dsh-plugin-registry/registry
 */

import { readFile } from 'node:fs/promises'

// ── 类型定义（兼容 YELEBAI dsh-plugin-marketplace 格式） ──

export interface RegistryPlugin {
  fullName: string
  description: string | null
  stars: number
  forks: number
  language: string | null
  license: string | null
  updatedAt: string
  defaultBranch: string
  verifiedCommit: string
  htmlUrl: string
  topics: string[]
  packageName: string
  version: string
  bundlePatch: string
  hasClient: boolean
  verifiedAt: string
  install: {
    mode: 'automatic' | 'guided'
    source: 'github' | 'npm' | 'tarball' | 'manual'
    spec: string
    profiles: string[]
    requiresBuildApproval: boolean
    requiresRestart: boolean
    manualSteps: boolean
    instructionsUrl: string
  }
  categories: string[]
  starGrowth7d: number
}

export interface RegistryData {
  schemaVersion: number
  generatedAt: string
  plugins: RegistryPlugin[]
}

export interface RegistrySearchResult {
  totalCount: number
  items: RegistryPlugin[]
}

export interface RegistryConfig {
  /** 注册表 URL（https:// 或 file://） */
  url?: string
  /** 缓存时间（毫秒） */
  cacheMs: number
  /** 请求超时（毫秒） */
  timeoutMs: number
}

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/YELEBAI/dsh-plugin-marketplace/main/registry/plugins.json'
const PAGE_SIZE = 30

/** 注册表客户端 */
export class RegistryClient {
  private cache: { data: RegistryData; etag: string | null; expiresAt: number } | undefined
  private readonly source: string
  private readonly cacheMs: number
  private readonly timeoutMs: number

  constructor(config?: Partial<RegistryConfig>) {
    this.source = config?.url ?? DEFAULT_REGISTRY_URL
    this.cacheMs = config?.cacheMs ?? 15 * 60 * 1000
    this.timeoutMs = config?.timeoutMs ?? 10000
  }

  /** 搜索插件 */
  async search(query: string, page = 1, sort: 'stars' | 'updated' = 'stars'): Promise<RegistrySearchResult> {
    const registry = await this.load()
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    const filtered = registry.plugins.filter((plugin) => {
      if (terms.length === 0) return true
      const text = [
        plugin.fullName,
        plugin.packageName,
        plugin.description ?? '',
        plugin.language ?? '',
        ...plugin.topics,
      ].join('\n').toLocaleLowerCase()
      return terms.every(term => text.includes(term))
    })
    filtered.sort((a, b) => sort === 'updated'
      ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      : b.stars - a.stars)
    const offset = (page - 1) * PAGE_SIZE
    return {
      totalCount: filtered.length,
      items: filtered.slice(offset, offset + PAGE_SIZE),
    }
  }

  /** 按 fullName 查找插件 */
  async find(fullName: string): Promise<RegistryPlugin | undefined> {
    const key = fullName.trim().toLocaleLowerCase()
    return (await this.load()).plugins.find(p => p.fullName.toLocaleLowerCase() === key)
  }

  /** 按 packageName 查找插件 */
  async findByPackage(packageName: string): Promise<RegistryPlugin | undefined> {
    return (await this.load()).plugins.find(p => p.packageName === packageName)
  }

  /** 获取注册表信息 */
  async getRegistryInfo(): Promise<{ pluginCount: number; generatedAt: string }> {
    const registry = await this.load()
    return { pluginCount: registry.plugins.length, generatedAt: registry.generatedAt }
  }

  /** 加载注册表（带缓存） */
  private async load(): Promise<RegistryData> {
    if (this.cache && Date.now() < this.cache.expiresAt) return this.cache.data
    try {
      return await this.fetchRegistry()
    } catch (error) {
      if (this.cache) {
        this.cache.expiresAt = Date.now() + Math.min(this.cacheMs, 60_000)
        return this.cache.data
      }
      throw new Error(`无法加载插件注册表: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** 从源获取注册表 */
  private async fetchRegistry(): Promise<RegistryData> {
    const url = new URL(this.source)
    let raw: string
    let etag: string | null = null

    if (url.protocol === 'file:') {
      raw = await readFile(url, 'utf-8')
    } else if (url.protocol === 'https:' || url.protocol === 'http:') {
      const headers: Record<string, string> = { accept: 'application/json' }
      if (this.cache?.etag) headers['if-none-match'] = this.cache.etag
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) })
      if (response.status === 304 && this.cache) {
        this.cache.expiresAt = Date.now() + this.cacheMs
        return this.cache.data
      }
      if (!response.ok) throw new Error(`注册表返回 HTTP ${response.status}`)
      raw = await response.text()
      etag = response.headers.get('etag')
    } else {
      throw new Error(`不支持的注册表协议: ${url.protocol}`)
    }

    const data = JSON.parse(raw) as RegistryData
    this.cache = { data, etag, expiresAt: Date.now() + this.cacheMs }
    return data
  }
}
