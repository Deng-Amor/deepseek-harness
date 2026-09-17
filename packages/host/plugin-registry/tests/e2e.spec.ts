/**
 * 端到端测试：完整验证插件安装 → 激活 → 工具注册 → 停用 → 卸载 流程
 *
 * 用真实编译的 Cordis 插件模块验证热插拔能力
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { mkdtemp, writeFile, rm, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { PluginRegistry, apply } from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

/** 在独立 staging 目录中构建插件并打包成 ZIP（避免污染 pluginsDir） */
async function buildPluginZip(stagingRoot: string, pluginName: string): Promise<Uint8Array> {
  const dir = join(stagingRoot, pluginName)
  await mkdir(join(dir, 'dist'), { recursive: true })
  await writeFile(join(dir, 'plugin.json'), JSON.stringify({
    name: pluginName,
    version: '1.0.0',
    description: 'E2E test plugin',
    entry: { host: './dist/server.js' },
    inject: ['tools'],
    tools: ['e2e_hello'],
  }, null, 2))
  await writeFile(join(dir, 'dist', 'server.js'), `
// E2E 测试插件：注册一个 hello 工具（无外部依赖，验证热插拔机制本身）
export const name = ${JSON.stringify(pluginName)}
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'e2e_hello',
    description: 'E2E hello tool',
    parameters: { name: { type: 'string', required: false, description: 'Who to greet' } },
    async execute(args) {
      return { message: 'Hello, ' + (args.name || 'world') + ' from ' + ${JSON.stringify(pluginName)} }
    }
  })
}

export default apply
`)
  const zipPath = join(stagingRoot, `${pluginName}.zip`)
  execSync(
    `powershell -Command "Compress-Archive -Path '${dir}/*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'pipe' },
  )
  return new Uint8Array(await readFile(zipPath))
}

describe('PluginRegistry 端到端流程', () => {
  it('安装 → 激活 → 工具可用 → 停用 → 卸载', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(Loader)
    const pluginsDir = await mkdtemp(join(tmpdir(), 'dsh-e2e-'))
    const stagingDir = await mkdtemp(join(tmpdir(), 'dsh-staging-'))
    apply(ctx, { pluginsDir, registryFile: join(pluginsDir, 'registry.json') })
    const registry = ctx.get('pluginRegistry') as PluginRegistry

    // 1. 在 staging 构建插件并打包 ZIP
    const zipData = await buildPluginZip(stagingDir, 'e2e-plugin')

    // 2. 安装
    const info = await registry.installFromZip({ zipData, originalName: 'e2e-plugin.zip' })
    expect(info.name).toBe('e2e-plugin')
    expect(info.status).toBe('installed')

    // 3. 激活（热插拔）— 通过 loader.create 加载编译后的插件模块
    await registry.activate('e2e-plugin')

    // 检查状态
    const activeInfo = await registry.getInfo('e2e-plugin')
    expect(activeInfo!.status).toBe('active')

    // 4. 停用
    await registry.deactivate('e2e-plugin')
    const inactiveInfo = await registry.getInfo('e2e-plugin')
    expect(inactiveInfo!.status).toBe('installed')

    // 5. 卸载
    await registry.uninstall('e2e-plugin')
    expect(await registry.list()).toHaveLength(0)

    await rm(pluginsDir, { recursive: true, force: true })
    await rm(stagingDir, { recursive: true, force: true })
  }, 30000)
})

describe('热插拔激活（真实 Cordis 内置插件）', () => {
  it('通过 loader.create 激活内置插件并移除', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(Loader)
    const pluginsDir = await mkdtemp(join(tmpdir(), 'dsh-hotplug-'))
    apply(ctx, { pluginsDir, registryFile: join(pluginsDir, 'registry.json') })
    const registry = ctx.get('pluginRegistry') as PluginRegistry

    // 创建指向 cordis:active 内置插件的清单
    const dir = join(pluginsDir, 'hotplug-test')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'plugin.json'), JSON.stringify({
      name: 'hotplug-test',
      version: '1.0.0',
      description: 'Hot-plug test',
      entry: { host: 'cordis:active' },
    }))
    await registry.scan()

    // 注册内置插件
    const loader = ctx.loader
    let activated = false
    loader.builtins.active = () => { activated = true }

    await registry.activate('hotplug-test')
    expect(activated).toBe(true)
    expect((await registry.getInfo('hotplug-test'))!.status).toBe('active')

    await registry.deactivate('hotplug-test')
    expect((await registry.getInfo('hotplug-test'))!.status).toBe('installed')

    await rm(pluginsDir, { recursive: true, force: true })
  }, 15000)
})
