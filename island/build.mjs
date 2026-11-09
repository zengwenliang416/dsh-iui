// Bundle the isolated renderer into one script and one stylesheet for the card iframe, and write the
// license notices of every third-party package the bundle contains to ../THIRD_PARTY_NOTICES.md.
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const result = await build({
  entryPoints: { island: 'src/main.tsx' },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  jsx: 'automatic',
  legalComments: 'none',
  metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.svg': 'dataurl' },
  logLevel: 'warning',
})

/** Nearest package.json directory at or above a bundled file. */
function packageRoot(file) {
  for (let dir = dirname(realpathSync(file)); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json')
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name !== undefined) return dir
  }
  throw new Error(`no package.json above ${file}`)
}

const roots = new Set(Object.keys(result.metafile.inputs).filter(input => input.includes('node_modules/')).map(packageRoot))
const notices = [...roots].map((root) => {
  const { name, version, license, repository } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const file = readdirSync(root).find(entry => /^(license|licence|copying)(\.|$)/i.test(entry))
  const source = typeof repository === 'string' ? repository : repository?.url
  // Some published packages declare a license without shipping its text; point to the source instead.
  const text = file === undefined
    ? `The published package ships no license file. It declares the ${String(license)} license; see ${String(source)}.`
    : readFileSync(join(root, file), 'utf8').trim()
  return { name, version, license, text }
}).sort((a, b) => a.name.localeCompare(b.name))
writeFileSync('../THIRD_PARTY_NOTICES.md', [
  '# Third-party notices',
  '',
  'The card renderer in `lib/client.js` bundles the following packages.',
  ...notices.flatMap(({ name, version, license, text }) => ['', `## ${name}@${version} (${license})`, '', '```text', text, '```']),
  '',
].join('\n'))
