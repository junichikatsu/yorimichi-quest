import { context, build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')

/**
 * フロントエンドのバンドル。
 *
 * minify を有効にしている点はプレイブックからの意図的な逸脱。
 * プレイブックは「配信される JS は読める状態に保つ（数十 KB の差）」として minify:false を
 * 指定しているが、React + Mapbox GL JS では未圧縮バンドルが数 MB になり、
 * Lambda のレスポンスサイズ上限（6MB）に近づく。前提が変わるため minify する。
 */
const options = {
  entryPoints: [join(here, 'src/main.tsx')],
  outfile: join(here, 'public/app.js'),
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'iife', // module にすると index.html 側で type="module" が要る
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  banner: {
    js: '/* 生成物です。編集しないでください。編集先は apps/web/src/ です。 */',
  },
}

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('[web] watching src/ …')
} else {
  await build(options)
  console.log('[web] built public/app.js, public/app.css')
}
