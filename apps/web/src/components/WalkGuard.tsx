import type { Avatar } from '@imanouchi/shared'
import { AvatarCanvas } from './AvatarCanvas.js'
import type { Condition } from '../avatar/sprite.js'

interface WalkGuardProps {
  /** 直近の速度（km/h）。歩いていることが伝わるように出す */
  speedKmh: number
  /**
   * 覆っている間にチェックインできる圏内へ入った場所（FR-02-10）。
   *
   * ★ 出すのは「着いた」ことだけである。**覆いを外させる導線にはしない。**
   * 外させたらそれは歩きスマホであり、この覆いの存在意義が消える（NFR-14）。
   */
  arrivals: readonly string[]
  /** 開放済みの町丁目の数。歩いた成果が「見なくても増えている」ことを示す */
  unlockedCount: number
  /** 音を鳴らせているか。鳴らせないなら知らせが届かないので、そう書く */
  soundReady: boolean
  /**
   * 覆っている間に入った浸水想定区域（#72）。
   *
   * ★ 覆っていても知らせる。音（`notifyHazard`）だけでは聞き逃す。
   * **危ないところを歩いていることは、止まったときに残っていなければならない。**
   */
  hazards: readonly string[]
  /** 覆いの上に出すキャラクター。見た目が未取得なら出さない */
  avatar: Avatar | undefined
  /**
   * 身につけている道具（FR-07-8）。
   *
   * ★ 地図の姿と揃える。**同じキャラクターが画面によって違う姿だと、
   * 集めたものが身についている実感が消える。**
   */
  equip?: readonly string[]
  /** キャラクターの状態。浸水想定区域の中では濡れている */
  condition: Condition
  /** 「今すぐ見る」。歩いていても本人が必要なら開けなければならない */
  onDismiss: () => void
}

/**
 * 歩行中の操作止め（FR-02-9・NFR-14）。
 *
 * 歩いていることを検出したら地図を覆い、操作を受け付けない。
 * 「歩きながら見ないでください」と書くだけでは足りない。**見られる状態を残さない。**
 *
 * ★ ただし閉じ込めてはいけない。測位が乱れれば止まっているのに歩行中と判定される
 * ことがあり、そのとき開けなくなると地図が使えないアプリになる。
 * 「今すぐ見る」で必ず抜けられるようにしてある（抜けたあとは、止まるまで再表示しない）。
 *
 * ★ 進捗は音で伝える（FR-02-10）。覆っている最中に画面へ成果を出しても意味がない。
 */
export function WalkGuard({
  speedKmh,
  arrivals,
  hazards,
  unlockedCount,
  soundReady,
  avatar,
  equip,
  condition,
  onDismiss,
}: WalkGuardProps): React.JSX.Element {
  return (
    <div className="walkguard" role="alertdialog" aria-label="歩行中">
      <div className="walkguard__body">
        {/*
          ★ キャラクターを出す。覆っている間は地図も進捗も見せないが、
          **歩いていることが自分のキャラクターに起きている**ことは見せてよい。
          画面を見に来る動機にはならず（情報を持たない）、状態の変化（濡れ）だけは
          止まったときに分かる。
        */}
        {avatar && (
          <div className="walkguard__avatar">
            <AvatarCanvas
              avatar={avatar}
              scale={2.4}
              {...(equip ? { equip } : {})}
              animated
              condition={condition}
              label={condition === 'wet' ? '歩いているキャラクター（足元が濡れている）' : '歩いているキャラクター'}
            />
          </div>
        )}

        <p className="walkguard__title">歩いている間は画面を見ないでください</p>

        <p className="walkguard__lead">
          このまま<strong>ポケットに入れて歩けます</strong>。
          歩いたところは記録され続けます。
        </p>

        {/*
          ★ 着いたことは覆いの上に出す。音は聞き逃す（車の音・イヤホンをしていない
          ・端末が鞄の中）ので、**立ち止まって見たときに残っている**必要がある。
        */}
        {arrivals.length > 0 && (
          <div className="walkguard__arrival" role="status">
            <p className="walkguard__arrival-title">チェックインできる場所に着きました</p>
            <ul className="walkguard__arrival-list">
              {arrivals.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="walkguard__arrival-note">
              立ち止まると自動で戻ります。<strong>止まってから</strong>記録してください。
            </p>
          </div>
        )}

        {/*
          ★ ハザードは到着より前に出す。**危ないことのほうが先に読まれるべき**である。
          ここも「立ち止まってから」の導線で、覆いを外させる誘いは置かない。
        */}
        {hazards.length > 0 && (
          <div className="walkguard__hazard" role="status">
            <p className="walkguard__hazard-title">浸水想定区域を通りました</p>
            <ul className="walkguard__hazard-list">
              {hazards.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="walkguard__hazard-note">
              想定です。いま水が来ていることを示すものではありません。
            </p>
          </div>
        )}

        <dl className="walkguard__stats">
          <div>
            <dt>いまの速さ</dt>
            <dd>{speedKmh.toFixed(1)} km/h</dd>
          </div>
          <div>
            <dt>歩ききった町丁目</dt>
            <dd>{unlockedCount}</dd>
          </div>
        </dl>

        <p className="walkguard__note">
          {soundReady
            ? '町丁目を歩ききると音でお知らせします。立ち止まると自動で戻ります。'
            : '音が使えないため、お知らせは画面だけになります。立ち止まると自動で戻ります。'}
        </p>

        <button type="button" className="button button--ghost walkguard__dismiss" onClick={onDismiss}>
          今すぐ見る
        </button>
        <p className="walkguard__caution">立ち止まってから操作してください。</p>
      </div>
    </div>
  )
}
