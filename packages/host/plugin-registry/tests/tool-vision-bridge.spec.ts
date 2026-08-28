/**
 * 真实插件验证：用打包好的 tool-vision-bridge 插件验证完整安装 → 热插拔 → 工具注册 流程
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { PluginRegistry, apply } from '../src/index.ts'

const contexts: Context[] = []
const PLUGIN_SRC = 'G:/dsh_space/plugin-system/plugins/tool-vision-bridge'

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('tool-vision-bridge 真实插件安装验证', () => {
  it('ZIP 安装 → 热插拔激活 → read_image_as_text 工具注册 → 停用 → 卸载', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const cwd = await mkdtemp(join(tmpdir(), 'dsh-tvb-cwd-'))
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime, { mode: 'native' })
    await ctx.plugin(LocalFileSystem, { cwd })
    await ctx.plugin(Loader)
    const pluginsDir = await mkdtemp(join(tmpdir(), 'dsh-tvb-'))
    apply(ctx, { pluginsDir, registryFile: join(pluginsDir, 'registry.json') })
    const registry = ctx.get('pluginRegistry') as PluginRegistry

    // 1. 将已构建的 tool-vision-bridge 打包成 ZIP
    const zipPath = join(pluginsDir, 'tool-vision-bridge.zip')
    execSync(
      `powershell -Command "Compress-Archive -Path '${PLUGIN_SRC}/*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'pipe' },
    )
    const zipData = new Uint8Array(await readFile(zipPath))

    // 2. 安装
    const info = await registry.installFromZip({ zipData, originalName: 'tool-vision-bridge.zip' })
    expect(info.name).toBe('tool-vision-bridge')
    expect(info.status).toBe('installed')

    // 3. 激活（热插拔）
    await registry.activate('tool-vision-bridge')
    expect((await registry.getInfo('tool-vision-bridge'))!.status).toBe('active')

    // 4. 验证工具已注册到 ctx.tools
    const tools = ctx.tools
    const schema = tools.schemas().find(s => s.name === 'read_image_as_text')
    expect(schema).toBeDefined()
    expect(schema!.description).toContain('VLM')

    // 5. 停用 → 工具应移除
    await registry.deactivate('tool-vision-bridge')
    expect((await registry.getInfo('tool-vision-bridge'))!.status).toBe('installed')

    // 6. 卸载
    await registry.uninstall('tool-vision-bridge')
    expect(await registry.list()).toHaveLength(0)

    await rm(pluginsDir, { recursive: true, force: true })
  }, 30000)
})
