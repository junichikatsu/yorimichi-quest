import {
  AVATAR_NAME_MAX_LENGTH,
  CLOTH_COLORS,
  CLOTH_NAMES,
  EMPTY_EQUIPMENT,
  equippedKeys,
  HAIR_COLORS,
  HAIR_NAMES,
  isItemKey,
  ITEM_DEFS,
  ITEM_SLOT_LABELS,
  SKIN_COLORS,
  type Avatar,
  type Equipment,
  type ItemSlot,
} from '@imanouchi/shared'
import { useState } from 'react'
import { AvatarCanvas } from './AvatarCanvas.js'

interface AvatarCreatorProps {
  avatar: Avatar
  /** 身につけている道具（FR-07-8） */
  equipment: Equipment
  /**
   * 持っている道具（達成した道具カードのキー）。
   *
   * ★ ここに無いものは選べない。**最終判定はサーバー**が達成カードと突き合わせて行う。
   * 画面側の制限は「押せないものを見せない」ためのものである。
   */
  ownedTools: readonly string[]
  busy: boolean
  onSave: (avatar: Avatar) => void
  onSaveEquipment: (equipment: Equipment) => void
  onClose: () => void
}

interface ChoiceRow {
  key: 'hair' | 'cloth'
  label: string
  names: readonly string[]
}

const CHOICE_ROWS: ChoiceRow[] = [
  { key: 'hair', label: 'かみがた', names: HAIR_NAMES },
  { key: 'cloth', label: 'ふく', names: CLOTH_NAMES },
]

interface SwatchRow {
  key: 'hairColor' | 'clothColor' | 'skin'
  label: string
  colors: readonly string[]
}

const SWATCH_ROWS: SwatchRow[] = [
  { key: 'hairColor', label: 'かみのいろ', colors: HAIR_COLORS },
  { key: 'clothColor', label: 'ふくのいろ', colors: CLOTH_COLORS },
  { key: 'skin', label: 'はだのいろ', colors: SKIN_COLORS },
]

/**
 * キャラメイク。
 *
 * 保存するまで元の見た目に戻せるよう、編集中の状態はここで持ち、
 * 保存ボタンを押したときだけ親へ渡す。
 */
export function AvatarCreator({
  avatar,
  equipment,
  ownedTools,
  busy,
  onSave,
  onSaveEquipment,
  onClose,
}: AvatarCreatorProps): React.JSX.Element {
  const [draft, setDraft] = useState<Avatar>(avatar)

  /**
   * 装備は**押した時点で保存する**（見た目と違い「決定」を待たない）。
   *
   * ★ 見た目は迷いながら作るので下書きにしているが、装備は1タップの切り替えで、
   * 地図の姿にすぐ出るほうが分かりやすい。
   */
  const toggle = (slot: ItemSlot, key: string): void => {
    const next: Equipment = { ...equipment, [slot]: equipment[slot] === key ? null : key }
    onSaveEquipment(next)
  }

  const trimmedName = draft.name.trim()
  const canSave = trimmedName.length > 0 && trimmedName.length <= AVATAR_NAME_MAX_LENGTH

  return (
    <section className="panel panel--creator" aria-label="キャラクターづくり">
      <div className="panel__head">
        <h2 className="panel__title">キャラクターをつくる</h2>
        <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      <div className="creator__preview">
        <AvatarCanvas
          avatar={draft}
          equip={equippedKeys(equipment ?? EMPTY_EQUIPMENT)}
          scale={6}
          label="作成中のすがた"
        />
      </div>

      <label className="creator__name">
        <span>なまえ</span>
        <input
          type="text"
          value={draft.name}
          maxLength={AVATAR_NAME_MAX_LENGTH}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
      </label>

      {/*
        ★ 髪型と服は**その姿を並べて選ぶ**。
        以前は ◀ ▶ で1つずつ送る形だったが、名前を読んでも見た目が想像できず、
        目当てのものへ行くまで何回も押すことになっていた。
      */}
      {CHOICE_ROWS.map((row) => (
        <div className="creator__group" key={row.key}>
          <span className="creator__label">{row.label}</span>
          <div className="creator__choices">
            {row.names.map((name, index) => (
              <button
                type="button"
                key={name}
                className={draft[row.key] === index ? 'choice choice--on' : 'choice'}
                onClick={() => setDraft((current) => ({ ...current, [row.key]: index }))}
                aria-pressed={draft[row.key] === index}
                title={name}
              >
                <AvatarCanvas avatar={{ ...draft, [row.key]: index }} scale={2} label={name} />
                <span className="choice__name">{name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {SWATCH_ROWS.map((row) => (
        <div className="creator__group" key={row.key}>
          <span className="creator__label">{row.label}</span>
          <div className="creator__swatches">
            {row.colors.map((color, index) => (
              <button
                type="button"
                key={color}
                className={draft[row.key] === index ? 'swatch swatch--on' : 'swatch'}
                style={{ ['--swatch' as string]: color }}
                onClick={() => setDraft((current) => ({ ...current, [row.key]: index }))}
                aria-label={`${row.label} ${index + 1}`}
                aria-pressed={draft[row.key] === index}
              />
            ))}
          </div>
        </div>
      ))}

      {/*
        装備（FR-07-8）。
        ★ 持っている道具だけを出す。1つも無いときは、どうすれば増えるかを書く
        （空の枠だけを見せると壊れているように見える）。
      */}
      <div className="creator__group">
        <span className="creator__label">そうび</span>
        {ownedTools.length === 0 ? (
          <p className="panel__note">
            まだ道具がありません。チェックインとクイズの正解で手に入ります。
          </p>
        ) : (
          <div className="creator__choices">
            {ownedTools.filter(isItemKey).map((key) => {
              const def = ITEM_DEFS[key]
              const on = equipment[def.slot] === key
              return (
                <button
                  type="button"
                  key={key}
                  className={on ? 'choice choice--on' : 'choice'}
                  onClick={() => toggle(def.slot, key)}
                  aria-pressed={on}
                  title={`${def.name}（${ITEM_SLOT_LABELS[def.slot]}）`}
                  disabled={busy}
                >
                  <AvatarCanvas avatar={draft} equip={[key]} scale={2} label={def.name} />
                  <span className="choice__name">{def.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ★ 決定は右下に小さく置く。画面の幅いっぱいの大きなボタンは、選び直す作業の邪魔になる */}
      <div className="creator__actions">
        <button type="button" className="button button--ghost" onClick={onClose}>
          やめる
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!canSave || busy}
          onClick={() => onSave({ ...draft, name: trimmedName })}
        >
          {busy ? '保存中…' : '決定'}
        </button>
      </div>

      <p className="panel__note">
        装備しているアイテムは見た目に反映されます。アイテムはチェックインとクイズ正解で手に入ります。
      </p>
    </section>
  )
}
