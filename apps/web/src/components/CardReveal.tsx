import { CARD_KIND_LABELS, type CardView } from '@imanouchi/shared'
import { useEffect } from 'react'
import { useAutoDismiss } from '../hooks/useAutoDismiss.js'
import { notifyCardAcquired } from '../feedback.js'
import { CardArt, cardColorStyle } from './CardArt.js'

interface CardRevealProps {
  cards: CardView[]
  onDone: () => void
}

/**
 * 表示しておく時間。
 *
 * ★ 演出で操作権を長く奪わない（G-7）。タップすればすぐ終わる。
 * チェックインの演出（`CheckinBurst`）と同じ長さにそろえてある。
 */
const VISIBLE_MS = 3200

/**
 * カードを手に入れた演出（FR-14-8）。
 *
 * ★ **獲得は必ず立ち止まっているときに起きる。** 歩行中は操作を止めているため
 * （FR-02-9）、チェックインもクイズも立ち止まってから行う。したがって
 * 「溜まった獲得を順に開く」キューは要らない。
 *
 * ★ 裏から表へ返す動きは CSS だけで作る（`rotateY` と `backface-visibility`）。
 * アニメーションライブラリを入れるとバンドルにそのまま乗る（同一オリジン配信で
 * CDN が使えず、Lambda の応答上限 6MB に対して余裕は減っている）。
 */
export function CardReveal({ cards, onDone }: CardRevealProps): React.JSX.Element {
  /*
   * ★ 音は**出た瞬間**に鳴らす（獲得した瞬間ではない）。
   * この演出はポイントの演出が消えてから出るので、獲得時に鳴らすと
   * 何も出ていないところで鳴り、返る動きと音がずれる。
   *
   * ★ 音を出せない状態なら黙って通り過ぎる（`feedback.ts` が受け止める）。
   */
  useEffect(() => {
    notifyCardAcquired()
  }, [cards])

  // ★ 時計は `useAutoDismiss` に任せる（親の描き直しで数え直さない）
  useAutoDismiss(onDone, VISIBLE_MS, cards)

  return (
    <div
      className="reveal"
      role="status"
      aria-live="polite"
      /* ★ どこを触っても閉じる。「閉じる」を探させない */
      onClick={onDone}
    >
      <p className="reveal__lead">カードを手に入れた</p>

      <ul className="reveal__cards">
        {cards.map((card, index) => (
          <li
            key={card.cardId}
            className="reveal__slot"
            /* 1枚ずつ間を置いて返す。同時に返すと何枚あるか分からない */
            style={{ ['--reveal-delay' as string]: `${index * 0.16}s` }}
          >
            <div className="reveal__flip">
              {/* 裏面。めくる前に見える面（決定した案：ドット枠＋ロゴ） */}
              <div className="reveal__back" aria-hidden="true">
                <span className="reveal__mark">今</span>
                <span className="reveal__word">イマノウチ・ヨリミチ</span>
              </div>
              <article
                className={`reveal__front card card--${card.kind} card--achieved`}
                style={cardColorStyle(card)}
              >
                <CardArt card={card} />
                <p className="card__kind">{CARD_KIND_LABELS[card.kind]}</p>
                <h3 className="card__title">{card.title}</h3>
                <p className="card__body">{card.body}</p>
              </article>
            </div>
          </li>
        ))}
      </ul>

      <p className="reveal__hint">画面をタップすると閉じます</p>
    </div>
  )
}
