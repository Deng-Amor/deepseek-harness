import { defineConfig } from 'tsdown'

/** Build every public Node entry declared by dsh-plugin-registry. */
export default defineConfig({
  entry: [
    'lib/types/index.js',
    'lib/types/invariant.js',
    'lib/types/marketplace.js',
    'lib/types/registry.js',
  ],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
