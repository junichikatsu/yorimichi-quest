import {
  AVATAR_NAME_MAX_LENGTH,
  CLOTH_COLORS,
  CLOTH_NAMES,
  HAIR_COLORS,
  HAIR_NAMES,
  SKIN_COLORS,
  type Avatar,
  type Equipment,
} from '@map-checkin/shared'
import { useState } from 'react'
import { AvatarCanvas } from './AvatarCanvas.js'

interface AvatarCreatorProps {
  avatar: Avatar
  equipment: Equipment
  busy: boolean
  onSave: (avatar: Avatar) => void
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
  busy,
  onSave,
  onClose,
}: AvatarCreatorProps): React.JSX.Element {
  const [draft, setDraft] = useState<Avatar>(avatar)

  const cycle = (key: ChoiceRow['key'], delta: number, max: number): void => {
    setDraft((current) => ({ ...current, [key]: (current[key] + delta + max) % max }))
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
        <AvatarCanvas avatar={draft} equipment={equipment} scale={5} animated label="作成中のすがた" />
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

      {CHOICE_ROWS.map((row) => (
        <div className="creator__row" key={row.key}>
          <span className="creator__label">{row.label}</span>
          <div className="creator__stepper">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => cycle(row.key, -1, row.names.length)}
              aria-label={`${row.label}を前へ`}
            >
              ◀
            </button>
            <span className="creator__value">{row.names[draft[row.key]] ?? '—'}</span>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => cycle(row.key, 1, row.names.length)}
              aria-label={`${row.label}を次へ`}
            >
              ▶
            </button>
          </div>
        </div>
      ))}

      {SWATCH_ROWS.map((row) => (
        <div className="creator__row" key={row.key}>
          <span className="creator__label">{row.label}</span>
          <div className="creator__swatches">
            {row.colors.map((color, index) => (
              <button
                type="button"
                key={color}
                className={`swatch${draft[row.key] === index ? ' swatch--on' : ''}`}
                style={{ background: color }}
                onClick={() => setDraft((current) => ({ ...current, [row.key]: index }))}
                aria-label={`${row.label} ${index + 1}`}
                aria-pressed={draft[row.key] === index}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="button button--primary"
        disabled={!canSave || busy}
        onClick={() => onSave({ ...draft, name: trimmedName })}
      >
        {busy ? '保存中…' : 'このすがたで決定'}
      </button>

      <p className="panel__note">
        装備しているアイテムは見た目に反映されます。アイテムはチェックインとクイズ正解で手に入ります。
      </p>
    </section>
  )
}
