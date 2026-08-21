import archiver from 'archiver'
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sampleRoot = join(here, '..', '..')
const webDir = join(sampleRoot, 'apps', 'web')
const buildDir = join(here, 'build')
const zipPath = join(here, 'imanouchi-function.zip')

const MAX_ZIP_BYTES = 250 * 1024 * 1024

/** 配信する静的ファイル。1 つでも欠けたらビルドを失敗させる。 */
const STATIC_ASSETS = [
  { name: 'index.html', contentType: 'text/html; charset=utf-8', binary: false },
  { name: 'styles.css', contentType: 'text/css; charset=utf-8', binary: false },
  { name: 'app.js', contentType: 'text/javascript; charset=utf-8', binary: false },
  { name: 'app.css', contentType: 'text/css; charset=utf-8', binary: false },
  { name: 'caps.html', contentType: 'text/html; charset=utf-8', binary: false },
]

function resolveCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sampleRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

/* 0) apps/web をビルドする。
      public/app.js は生成物で git 管理しない。ここで作らずに読むと古い app.js が ZIP に入る。 */
console.log('[zip] 0/6 building web assets')
execFileSync(process.execPath, [join(webDir, 'build.mjs')], { stdio: 'inherit' })

/* 1) zip-package.json の検証 */
console.log('[zip] 1/6 validating zip-package.json')
const zipPackageRaw = await readFile(join(here, 'zip-package.json'), 'utf8')
const zipPackage = JSON.parse(zipPackageRaw)
if (zipPackage.type === 'module') {
  throw new Error('zip-package.json に "type": "module" があります。ZIP は CommonJS 必須です。')
}

/* 2) esbuild で単一 CJS にバンドルし、ビルド情報と静的ファイルを define で埋め込む */
console.log('[zip] 2/6 bundling function')
await rm(buildDir, { recursive: true, force: true })
await mkdir(buildDir, { recursive: true })

const assets = {}
for (const asset of STATIC_ASSETS) {
  const path = join(webDir, 'public', asset.name)
  let body
  try {
    body = asset.binary
      ? (await readFile(path)).toString('base64')
      : await readFile(path, 'utf8')
  } catch {
    // 画面が白いままデプロイされる方が損失が大きい
    throw new Error(`静的ファイルが見つかりません: ${path}`)
  }
  assets[asset.name] = {
    contentType: asset.contentType,
    encoding: asset.binary ? 'base64' : 'utf8',
    body,
  }
}

const buildInfo = {
  version: zipPackage.version,
  commit: resolveCommit(),
  builtAt: new Date().toISOString(),
}

await build({
  entryPoints: [join(here, 'src', 'index.ts')],
  outfile: join(buildDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
    __STATIC_ASSETS__: JSON.stringify(assets),
  },
})

/* 3) zip-package.json を build/package.json へコピー */
console.log('[zip] 3/6 writing package.json')
await writeFile(join(buildDir, 'package.json'), `${JSON.stringify(zipPackage, null, 2)}\n`)

/* 4) require して handler が関数として公開されているか検証する。
      文字列 grep はしない（esbuild の CJS 出力に "exports.handler" という字面は現れない）。 */
console.log('[zip] 4/6 verifying handler export')
const require = createRequire(import.meta.url)
const bundled = require(join(buildDir, 'index.js'))
if (typeof bundled.handler !== 'function') {
  throw new Error('build/index.js が handler 関数を公開していません')
}

/* 5) build/ の「中身」を ZIP ルートへ */
console.log('[zip] 5/6 creating zip')
await rm(zipPath, { force: true })
await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  output.on('close', resolve)
  archive.on('error', reject)
  archive.pipe(output)
  archive.directory(buildDir, false) // false = 親フォルダで包まない
  void archive.finalize()
})

/* 6) サイズ確認 */
const { size } = await stat(zipPath)
if (size > MAX_ZIP_BYTES) {
  throw new Error(`ZIP が 250MB を超えています: ${size} bytes`)
}

console.log(
  `[zip] 6/6 done: ${zipPath} (${(size / 1024).toFixed(0)} KB, commit ${buildInfo.commit.slice(0, 12)})`,
)
