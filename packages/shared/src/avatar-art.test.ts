import { describe, expect, it } from 'vitest'
import {
  AVATAR_ART_CHARS,
  AVATAR_ART_HEIGHT,
  AVATAR_ART_WIDTH,
  AVATAR_BASE,
  AVATAR_CLOTH,
  AVATAR_EQUIP,
  AVATAR_HAIR,
  composeAvatarArt,
} from './avatar-art.js'

/**
 * キャラクターのドット絵。
 *
 * ★ **1行でも長さが違うと、その行だけ横にずれる。** 層を重ねる作りなので、
 * ずれた層が他の層を欠けさせる。手で並べる作業は必ず数え間違いが起きるので固定する。
 */

const layers = [
  ...[AVATAR_BASE].map((value, index) => [`base[${index}]`, value] as const),
  ...AVATAR_HAIR.map((value, index) => [`hair[${index}]`, value] as const),
  ...AVATAR_CLOTH.map((value, index) => [`cloth[${index}]`, value] as const),
  ...Object.entries(AVATAR_EQUIP).map(([key, value]) => [`equip[${key}]`, value] as const),
]

describe('キャラクターのドット絵', () => {
  it('すべての層が 24 列で、はみ出さない', () => {
    for (const [name, target] of layers) {
      for (const [index, row] of target.rows.entries()) {
        expect(row.length, `${name} の ${index} 行目`).toBe(AVATAR_ART_WIDTH)
      }
      expect(target.top + target.rows.length, `${name} の下端`).toBeLessThanOrEqual(
        AVATAR_ART_HEIGHT,
      )
      expect(target.top, `${name} の上端`).toBeGreaterThanOrEqual(0)
    }
  })

  it('知らない文字が混ざっていない', () => {
    const allowed = new Set<string>(AVATAR_ART_CHARS)
    for (const [name, target] of layers) {
      const unknown = [...new Set(target.rows.join('').split(''))].filter((ch) => !allowed.has(ch))
      expect(unknown, `${name} の未知の文字`).toEqual([])
    }
  })

  it('合成すると 24×32 になる', () => {
    const art = composeAvatarArt({ hair: 0, cloth: 0 })
    expect(art.length).toBe(AVATAR_ART_HEIGHT)
    for (const row of art) expect(row.length).toBe(AVATAR_ART_WIDTH)
  })

  it('★ 顔（肌と目）が髪や服で埋まっていない', () => {
    /*
     * 層の重ね順を間違えると、髪が顔を覆って「目が無いキャラ」になる。
     * 地図の上では 32px しかないので、顔が消えると何の点か分からなくなる。
     */
    for (let hair = 0; hair < AVATAR_HAIR.length; hair += 1) {
      for (let cloth = 0; cloth < AVATAR_CLOTH.length; cloth += 1) {
        const art = composeAvatarArt({ hair, cloth }).join('')
        expect(art, `hair=${hair} cloth=${cloth} に目が無い`).toContain('k')
        expect(art.split('').filter((ch) => ch === 's').length).toBeGreaterThan(20)
      }
    }
  })

  it('★ 絵の無いインデックスでも穴をあけない（0番へ落とす）', () => {
    const art = composeAvatarArt({ hair: 99, cloth: 99 })
    expect(art.join('')).toContain('h')
    expect(art.join('')).toContain('c')
  })

  it('装備は指定した分だけ乗る', () => {
    const bare = composeAvatarArt({ hair: 0, cloth: 0 }).join('')
    const armed = composeAvatarArt({ hair: 0, cloth: 0, equip: ['helmet'] }).join('')

    expect(bare).not.toContain('e')
    expect(armed).toContain('e')
  })

  it('知らない装備は無視する（落ちない）', () => {
    const art = composeAvatarArt({ hair: 0, cloth: 0, equip: ['no-such-item'] })
    expect(art.length).toBe(AVATAR_ART_HEIGHT)
  })
})
