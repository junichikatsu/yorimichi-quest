import type { DataSourceCredit } from '@imanouchi/shared'

interface DataCreditsProps {
  sources: DataSourceCredit[]
}

/**
 * 出典表示（FR-10-2）。
 *
 * ★ 装飾ではない。取り込んだオープンデータのライセンスが出典明記を求めるため、
 * 画面に出しておく必要がある。畳めるが、消せる作りにはしていない。
 *
 * ★ スポット以外（ハザードのタイル・#72）もここへ並べる。出典の置き場を
 * 分けると、片方だけ消える。
 */
export function DataCredits({ sources }: DataCreditsProps): React.JSX.Element | null {
  if (sources.length === 0) return null

  return (
    <details className="credits">
      <summary className="credits__summary">データの出典（{sources.length}件）</summary>
      <ul className="credits__list">
        {sources.map((source) => (
          <li key={`${source.title}:${source.url}`} className="credits__item">
            {source.url === '' ? (
              <span>{source.title}</span>
            ) : (
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
              </a>
            )}
            {source.fetchedAt !== '' && <span className="credits__date">取得 {source.fetchedAt}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}
