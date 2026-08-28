import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  PluginManagerListEntry,
  PluginManagerActionResult,
  PluginManagerInstallResult,
  PluginMarketplaceSearchResult,
} from '@deepseek-ai/dsh-host-plugin-manager/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './PluginManagerSettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface PluginManagerSettingsTabInjected {
  /** Read all installed plugins. */
  list: () => Promise<PluginManagerListEntry[]>
  /** Activate (hot-plug) a plugin. */
  activate: (name: string) => Promise<PluginManagerActionResult>
  /** Deactivate (hot-unplug) a plugin. */
  deactivate: (name: string) => Promise<PluginManagerActionResult>
  /** Uninstall a plugin completely. */
  uninstall: (name: string) => Promise<PluginManagerActionResult>
  /** Install a plugin from a URL (GitHub or ZIP). */
  installFromUrl: (url: string) => Promise<PluginManagerInstallResult>
  /** Search the configured verified marketplace. */
  searchMarketplace: (query: string) => Promise<PluginMarketplaceSearchResult>
  /** Install and activate a marketplace plugin. */
  installMarketplace: (fullName: string) => Promise<PluginManagerInstallResult>
}

/** Full component props assembled by the Settings slot renderer. */
export type PluginManagerSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginManager'>
  & InjectFace<PluginManagerSettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: string }
  | { readonly status: 'ready'; readonly plugins: PluginManagerListEntry[] }

type TabId = 'marketplace' | 'all' | 'active' | 'installed'

type MarketplaceState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: string }
  | { readonly status: 'ready'; readonly result: PluginMarketplaceSearchResult }

/** One verified marketplace plugin with its installation action. */
function MarketplaceCard({
  plugin, t, onInstall, busy,
}: {
  plugin: PluginMarketplaceSearchResult['items'][number]
  t: PluginManagerSettingsTabProps['t']
  onInstall: () => void
  busy: string | null
}): ReactNode {
  const isBusy = busy === plugin.fullName

  return (
    <div className={css.card} data-plugin={plugin.packageName}>
      <div className={css.cardHeader}>
        <strong className={css.cardTitle}>{plugin.fullName}</strong>
        <span className={css.versionBadge}>{plugin.version}</span>
        <span className={css.statusBadge} data-active={plugin.installed ? 'true' : 'false'}>
          {plugin.installed ? t('installed') : plugin.source}
        </span>
      </div>
      <p className={css.cardDescription}>{plugin.description || t('description')}</p>
      <div className={css.cardMeta}>
        <span>★ {plugin.stars}</span>
      </div>
      <div className={css.cardActions}>
        <button type="button" className={css.actionBtn} onClick={onInstall} disabled={plugin.installed || isBusy}>
          {plugin.installed ? t('installed') : isBusy ? t('installing') : t('install')}
        </button>
      </div>
    </div>
  )
}

/** Single plugin card with management buttons. */
function PluginCard({
  plugin, t, onActivate, onDeactivate, onUninstall, busy,
}: {
  plugin: PluginManagerListEntry
  t: PluginManagerSettingsTabProps['t']
  onActivate: () => void
  onDeactivate: () => void
  onUninstall: () => void
  busy: string | null
}): ReactNode {
  const isActive = plugin.status === 'active'
  const isBusy = busy === plugin.name

  return (
    <div className={css.card} data-plugin={plugin.name}>
      <div className={css.cardHeader}>
        <strong className={css.cardTitle}>{plugin.name}</strong>
        <span className={css.versionBadge}>{plugin.version}</span>
        <span className={css.statusBadge} data-active={isActive ? 'true' : 'false'}>
          {isActive ? t('active') : t('inactive')}
        </span>
      </div>
      <p className={css.cardDescription}>{plugin.description}</p>
      <div className={css.cardMeta}>
        {plugin.author ? <span>{t('author')}: {plugin.author}</span> : null}
        {plugin.tools ? <span>{t('tools')}: {plugin.tools}</span> : null}
      </div>
      {plugin.error ? <p className={css.cardError}>{plugin.error}</p> : null}
      <div className={css.cardActions}>
        {isActive ? (
          <button
            type="button"
            className={css.actionBtn}
            onClick={onDeactivate}
            disabled={isBusy}
          >
            {isBusy ? '…' : t('deactivate')}
          </button>
        ) : (
          <button
            type="button"
            className={css.actionBtn}
            onClick={onActivate}
            disabled={isBusy}
          >
            {isBusy ? '…' : t('activate')}
          </button>
        )}
        <button
          type="button"
          className={`${css.actionBtn} ${css.dangerBtn}`}
          onClick={onUninstall}
          disabled={isBusy}
        >
          {isBusy ? '…' : t('uninstall')}
        </button>
      </div>
    </div>
  )
}

/** Toast notification. */
function Toast({ message, type, onClose }: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}): ReactNode {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={css.toast} data-type={type} role="alert">
      <span>{message}</span>
      <button type="button" className={css.toastClose} onClick={onClose} aria-label="Close">&times;</button>
    </div>
  )
}

/** Main Plugin Manager tab. */
export function PluginManagerSettingsTab({
  list, activate, deactivate, uninstall, installFromUrl, searchMarketplace, installMarketplace, t,
}: PluginManagerSettingsTabProps): ReactNode {
  const [activeTab, setActiveTab] = useState<TabId>('marketplace')
  const [request, setRequest] = useState(0)
  const [marketplaceRequest, setMarketplaceRequest] = useState(0)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [marketplace, setMarketplace] = useState<MarketplaceState>({ status: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [installUrl, setInstallUrl] = useState('')
  const [query, setQuery] = useState('')
  const [installing, setInstalling] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const refresh = useCallback(() => {
    setState({ status: 'loading' })
    setRequest((v: number) => v + 1)
  }, [])

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (plugins) => { if (current) setState({ status: 'ready', plugins }) },
      (err: Error) => { if (current) setState({ status: 'error', error: err.message }) },
    )
    return () => { current = false }
  }, [list, request])

  useEffect(() => {
    let current = true
    setMarketplace({ status: 'loading' })
    void Promise.resolve().then(() => searchMarketplace(query)).then(
      (result) => { if (current) setMarketplace({ status: 'ready', result }) },
      (err: Error) => { if (current) setMarketplace({ status: 'error', error: err.message }) },
    )
    return () => { current = false }
  }, [query, searchMarketplace, marketplaceRequest])

  const filteredPlugins: PluginManagerListEntry[] = useMemo(() => {
    if (state.status !== 'ready') return []
    const p = state.plugins
    if (activeTab === 'active') return p.filter((pl: PluginManagerListEntry) => pl.status === 'active')
    if (activeTab === 'installed') return p.filter((pl: PluginManagerListEntry) => pl.status === 'installed')
    return p
  }, [activeTab, state])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const handleActivate = async (pluginName: string) => {
    setBusy(pluginName)
    try {
      const result = await activate(pluginName)
      if (result.ok) {
        showToast(t('activateSuccess'), 'success')
        refresh()
      } else {
        showToast(`${t('activateFailed')}: ${result.error}`, 'error')
      }
    } catch (err: unknown) {
      showToast(`${t('activateFailed')}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleDeactivate = async (pluginName: string) => {
    setBusy(pluginName)
    try {
      const result = await deactivate(pluginName)
      if (result.ok) {
        showToast(t('deactivateSuccess'), 'success')
        refresh()
      } else {
        showToast(`${t('deactivateFailed')}: ${result.error}`, 'error')
      }
    } catch (err: unknown) {
      showToast(`${t('deactivateFailed')}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleUninstall = async (pluginName: string) => {
    if (!window.confirm(t('uninstallConfirm').replace('{name}', pluginName))) return
    setBusy(pluginName)
    try {
      const result = await uninstall(pluginName)
      if (result.ok) {
        showToast(t('uninstallSuccess'), 'success')
        refresh()
      } else {
        showToast(`${t('uninstallFailed')}: ${result.error}`, 'error')
      }
    } catch (err: unknown) {
      showToast(`${t('uninstallFailed')}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleInstall = async () => {
    const url = installUrl.trim()
    if (!url) return
    setInstalling(true)
    try {
      const result = await installFromUrl(url)
      if (result.ok) {
        showToast(t('installSuccess'), 'success')
        setInstallUrl('')
        refresh()
      } else {
        showToast(`${t('installFailed')}: ${result.error}`, 'error')
      }
    } catch (err: unknown) {
      showToast(`${t('installFailed')}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setInstalling(false)
    }
  }

  const handleMarketplaceInstall = async (fullName: string) => {
    setBusy(fullName)
    try {
      const result = await installMarketplace(fullName)
      if (!result.ok) throw new Error(result.error ?? t('installFailed'))
      showToast(t('installSuccess'), 'success')
      refresh()
      setMarketplaceRequest(value => value + 1)
    } catch (err: unknown) {
      showToast(`${t('installFailed')}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'marketplace', label: t('marketplace') },
    { id: 'all', label: t('all') },
    { id: 'active', label: t('activeTab') },
    { id: 'installed', label: t('installedTab') },
  ]

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Tab bar */}
      <div className={css.tabBar} role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={css.tabBtn}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'marketplace' ? (
        <>
          <div className={css.installRow}>
            <label className={css.installLabel}>{t('search')}</label>
            <input
              type="search"
              className={css.installInput}
              value={query}
              placeholder={t('searchPlaceholder')}
              aria-label={t('search')}
              onChange={event => setQuery(event.currentTarget.value)}
            />
          </div>
          {marketplace.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
          {marketplace.status === 'error' ? <p className={css.failure}>{t('noMarketplace')}: {marketplace.error}</p> : null}
          {marketplace.status === 'ready' && marketplace.result.items.length === 0 ? <p className={css.status}>{t('noResults')}</p> : null}
          {marketplace.status === 'ready' && marketplace.result.items.length > 0 ? (
            <div className={css.cards} role="list">
              {marketplace.result.items.map(plugin => (
                <MarketplaceCard
                  key={plugin.fullName}
                  plugin={plugin}
                  t={t}
                  onInstall={() => handleMarketplaceInstall(plugin.fullName)}
                  busy={busy}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab !== 'marketplace' ? (
        <>
          <div className={css.installRow}>
            <label className={css.installLabel}>{t('installFromUrl')}</label>
            <div className={css.installInputGroup}>
              <input
                type="text"
                className={css.installInput}
                value={installUrl}
                placeholder={t('installFromUrlPlaceholder')}
                aria-label={t('installFromUrl')}
                disabled={installing}
                onChange={e => setInstallUrl(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInstall() }}
              />
              <button
                type="button"
                className={css.installBtn}
                onClick={handleInstall}
                disabled={installing || !installUrl.trim()}
              >
                {installing ? t('installing') : t('installFromUrlButton')}
              </button>
            </div>
          </div>

          {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
          {state.status === 'error' ? (
            <div className={css.failure}>
              <p role="alert">{t('error')}: {state.error}</p>
              <button type="button" onClick={refresh}>{t('retry')}</button>
            </div>
          ) : null}
          {state.status === 'ready' ? (
            filteredPlugins.length === 0 ? <p className={css.status}>{t('empty')}</p> : (
              <div className={css.cards} role="list">
                {filteredPlugins.map(plugin => (
                  <PluginCard
                    key={plugin.name}
                    plugin={plugin}
                    t={t}
                    onActivate={() => handleActivate(plugin.name)}
                    onDeactivate={() => handleDeactivate(plugin.name)}
                    onUninstall={() => handleUninstall(plugin.name)}
                    busy={busy}
                  />
                ))}
              </div>
            )
          ) : null}
        </>
      ) : null}

    </div>
  )
}
