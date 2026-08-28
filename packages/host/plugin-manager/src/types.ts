/** Shared types for the Plugin-Manager Remote. */

/** One installed plugin visible to the client. */
export interface PluginManagerListEntry {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly status: string
  readonly author: string
  readonly tools: string
  readonly error?: string
}

/** Result of an activate/deactivate/uninstall call. */
export interface PluginManagerActionResult {
  readonly ok: boolean
  readonly error?: string
}

/** Result of an installFromUrl call. */
export interface PluginManagerInstallResult {
  readonly ok: boolean
  readonly plugin?: PluginManagerListEntry
  readonly error?: string
}

/** One verified marketplace plugin visible to the client. */
export interface PluginMarketplaceEntry {
  readonly fullName: string
  readonly packageName: string
  readonly version: string
  readonly description: string
  readonly stars: number
  readonly source: string
  readonly installed: boolean
}

/** A page of marketplace search results. */
export interface PluginMarketplaceSearchResult {
  readonly totalCount: number
  readonly items: readonly PluginMarketplaceEntry[]
}
