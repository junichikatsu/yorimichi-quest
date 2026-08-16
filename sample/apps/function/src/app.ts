import { Hono } from 'hono'
import { toErrorResponse } from './errors.js'
import { createRoutes } from './routes/index.js'
import type { AppEnv } from './types.js'

/**
 * enebular の HTTP トリガーは、**トリガーのパスを含めた**パスでハンドラを呼ぶ。
 * トリガーが /yorimichi-sample なら、Hono が受け取るのは /yorimichi-sample/v1/health であって
 * /v1/health ではない。
 *
 * 同じルート定義を 3 通りにマウントして吸収する。
 * トリガーのパスを環境変数で持つと、実設定とずれた瞬間に全リクエストが 404 になり、
 * 「関数は動いているのに何も応答しない」という最も切り分けにくい壊れ方をする。
 */
export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  app.route('/', createRoutes()) // /v1/health                 ローカル・テスト
  app.route('/:base', createRoutes()) // /yorimichi-sample/v1/health トリガー経由
  app.route('/:base/', createRoutes()) // /yorimichi-sample/          トリガーのルート URL

  app.onError((err, c) => toErrorResponse(err, c))

  // 受け取ったパスとメソッドを返す。イベント形式の想定違いをログ無しで切り分けられる。
  app.notFound((c) =>
    c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Not Found',
          path: c.req.path,
          method: c.req.method,
        },
      },
      404,
    ),
  )

  return app
}

export const app = createApp()
