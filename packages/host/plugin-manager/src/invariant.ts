/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-plugin-manager`.
 * @module @deepseek-ai/dsh-host-plugin-manager/invariant
 */

import type {} from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-plugin-manager'

export const name = 'plugin-manager-invariant'

export const inject = ['invariants']

export const apply = (ctx: import('@deepseek-ai/cordis').Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, async () => {}))
