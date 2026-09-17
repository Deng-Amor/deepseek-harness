/** Plugin Manager tab in Web Settings: install, activate, deactivate, uninstall plugins. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PluginManagerSettingsTab, type PluginManagerSettingsTabInjected } from './PluginManagerSettingsTab.tsx'
import { en, zh, type PluginManagerLocaleKey } from './locales.ts'

export type { PluginManagerSettingsTabInjected, PluginManagerSettingsTabProps } from './PluginManagerSettingsTab.tsx'
export type { PluginManagerLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Plugin Manager tab copy. */
    'settings.pluginManager': PluginManagerLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.pluginManager'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.pluginManager']

/** Contribute the manager tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-plugin-manager: dictionaries')

  const t = ctx.locale.bind(NS)

  /** Call the pluginManager.list remote. */
  const list = async (): Promise<import('@deepseek-ai/dsh-host-plugin-manager/types').PluginManagerListEntry[]> => {
    const result = await ctx.remote.pluginManager.list()
    if (!result.ok) throw new Error(`pluginManager.list failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }

  /** Call the pluginManager.activate remote. */
  const activate = async (pluginName: string) => {
    const result = await ctx.remote.pluginManager.activate(pluginName)
    if (!result.ok) throw new Error(result.error?.code ?? 'unknown')
    return result.value
  }

  /** Call the pluginManager.deactivate remote. */
  const deactivate = async (pluginName: string) => {
    const result = await ctx.remote.pluginManager.deactivate(pluginName)
    if (!result.ok) throw new Error(result.error?.code ?? 'unknown')
    return result.value
  }

  /** Call the pluginManager.uninstall remote. */
  const uninstall = async (pluginName: string) => {
    const result = await ctx.remote.pluginManager.uninstall(pluginName)
    if (!result.ok) throw new Error(result.error?.code ?? 'unknown')
    return result.value
  }

  /** Call the pluginManager.installFromUrl remote. */
  const installFromUrl = async (url: string) => {
    const result = await ctx.remote.pluginManager.installFromUrl(url)
    if (!result.ok) throw new Error(result.error?.code ?? 'unknown')
    return result.value
  }

  /** Call the pluginManager.searchMarketplace remote. */
  const searchMarketplace = async (query: string) => {
    const result = await ctx.remote.pluginManager.searchMarketplace(query)
    if (!result.ok) throw new Error(result.error?.code ?? 'unknown')
    return result.value
  }

  /** Call the pluginManager.installMarketplace remote. */
  const installMarketplace = async (fullName: string) => {
    const result = await ctx.remote.pluginManager.installMarketplace(fullName)
    if (!result.ok) throw new Error(result.error?.code ?? 'unknown')
    return result.value
  }

  const injected = (): PluginManagerSettingsTabInjected => ({
    list, activate, deactivate, uninstall, installFromUrl, searchMarketplace, installMarketplace,
  })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'manager',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, PluginManagerSettingsTab))
}
