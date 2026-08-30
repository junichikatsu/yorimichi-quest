/**
 * ★ 自動生成ファイル。手で編集しないこと。
 *
 * 生成元: tools/ingest/hazard.ts（#72・#75）／再生成: pnpm ingest:hazard
 *
 * 町丁目ごとの浸水想定。**判定は apps/web/src/hazard.ts の実装をそのまま使っている**
 * ので、地図の色と取り込んだ深さが食い違わない。
 *
 * ★ **区域が無い町丁目は載せていない。** 「区域が無い」と「深さが分からない」は
 * 違うので、載せないことで前者を表す（chome.ts が0件の町丁目を返さないのと同じ）。
 *
 * ★ `ratio` は町丁目の中に置いた標本点のうち、区域内だった割合である。
 * **危険度ではない。** 面積の割合の目安であって、そこに居る人の危なさではない。
 *
 * 出典: 国土交通省 ハザードマップポータルサイト
 *       （洪水浸水想定区域・高潮浸水想定区域）https://disaportal.gsi.go.jp/
 * 取得日: 2026-08-30
 * 標本の間隔: 25m ／ 判定ズーム: z16
 * 町丁目: 全 256 のうち、区域にかかるもの 249
 * ハザードの型: 8 通り
 */

export interface ChomeHazardLayer {
  id: string
  label: string
  /** 区域内だった標本の割合（0〜1）。**危険度ではない** */
  ratio: number
  /**
   * いちばん深い区分。
   *
   * ★ **省略されることがある**（区域内だが凡例に無い色だった場合）。
   * JSON は undefined のキーを持てないので、任意の項目にしてある。
   * **「区域外」ではなく「深さが分からない」である。**
   */
  worstDepth?: string
}

export interface ChomeHazard {
  code: string
  samples: number
  layers: ChomeHazardLayer[]
  /**
   * ハザードの型（避難行動が変わる境目でまとめたもの）。
   *
   * ★ 249 区画それぞれにナレッジを作ると防災士が読み切れないので、
   * **行動が変わるところだけで割ってある**（`HAZARD_PROFILES` を参照）。
   */
  profile: string
}

export interface HazardProfile {
  id: string
  label: string
  /** 層のID。'flood' ｜ 'hightide' */
  layers: string[]
  /** 'shallow' ｜ 'mid' ｜ 'deep' ｜ 'unknown' */
  depthBucket: string
  depthLabel: string
  /** この型に属する町丁目の数 */
  chomeCount: number
}

/**
 * ハザードの型の一覧。
 *
 * ★ 深さの3段は建物の階と対応している：
 *   0.5m未満   足首程度。屋内に留まれる
 *   0.5〜3m    1階が水没しうる。上の階へ
 *   3m以上     2階でも危ない。区域の外へ立ち退く
 * **独自の危険度ではなく**、浸水想定区域図の一般的な読み方に沿っている。
 */
export const HAZARD_PROFILES: readonly HazardProfile[] = [
  {
    "id": "flood-hightide-mid",
    "label": "洪水と高潮の浸水想定区域（最大 0.5〜3m未満）",
    "layers": [
      "flood",
      "hightide"
    ],
    "depthBucket": "mid",
    "depthLabel": "0.5〜3m未満",
    "chomeCount": 83
  },
  {
    "id": "flood-mid",
    "label": "洪水の浸水想定区域（最大 0.5〜3m未満）",
    "layers": [
      "flood"
    ],
    "depthBucket": "mid",
    "depthLabel": "0.5〜3m未満",
    "chomeCount": 68
  },
  {
    "id": "flood-hightide-deep",
    "label": "洪水と高潮の浸水想定区域（最大 3m以上）",
    "layers": [
      "flood",
      "hightide"
    ],
    "depthBucket": "deep",
    "depthLabel": "3m以上",
    "chomeCount": 41
  },
  {
    "id": "flood-shallow",
    "label": "洪水の浸水想定区域（最大 0.5m未満）",
    "layers": [
      "flood"
    ],
    "depthBucket": "shallow",
    "depthLabel": "0.5m未満",
    "chomeCount": 32
  },
  {
    "id": "flood-deep",
    "label": "洪水の浸水想定区域（最大 3m以上）",
    "layers": [
      "flood"
    ],
    "depthBucket": "deep",
    "depthLabel": "3m以上",
    "chomeCount": 12
  },
  {
    "id": "hightide-mid",
    "label": "高潮の浸水想定区域（最大 0.5〜3m未満）",
    "layers": [
      "hightide"
    ],
    "depthBucket": "mid",
    "depthLabel": "0.5〜3m未満",
    "chomeCount": 8
  },
  {
    "id": "flood-hightide-shallow",
    "label": "洪水と高潮の浸水想定区域（最大 0.5m未満）",
    "layers": [
      "flood",
      "hightide"
    ],
    "depthBucket": "shallow",
    "depthLabel": "0.5m未満",
    "chomeCount": 4
  },
  {
    "id": "hightide-unknown",
    "label": "高潮の浸水想定区域（最大 深さ不明）",
    "layers": [
      "hightide"
    ],
    "depthBucket": "unknown",
    "depthLabel": "深さ不明",
    "chomeCount": 1
  }
]

export const CHOME_HAZARDS: readonly ChomeHazard[] = [
  {
    "code": "13101001001",
    "samples": 602,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.915,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.92,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101001002",
    "samples": 229,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.996,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.991,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101001003",
    "samples": 200,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.795,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.845,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101002001",
    "samples": 435,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.644,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.582,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101002002",
    "samples": 277,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.823,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.711,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101003001",
    "samples": 194,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.897,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.938,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101003002",
    "samples": 82,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.183,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.28,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101004001",
    "samples": 176,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101004002",
    "samples": 112,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.705,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.857,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101005001",
    "samples": 323,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.266,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101005002",
    "samples": 221,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.231,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101005003",
    "samples": 269,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.093,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13101006001",
    "samples": 580,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.252,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13101006002",
    "samples": 537,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.196,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010070",
    "samples": 191,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.115,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101008001",
    "samples": 62,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.032,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101008002",
    "samples": 200,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.34,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13101009001",
    "samples": 104,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.048,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101009002",
    "samples": 75,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.04,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101009003",
    "samples": 76,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.013,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101009004",
    "samples": 88,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.045,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101009005",
    "samples": 69,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.188,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101009006",
    "samples": 109,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.22,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "131010100",
    "samples": 438,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.192,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "131010110",
    "samples": 341,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.065,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "131010120",
    "samples": 740,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.212,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.385,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010130",
    "samples": 325,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.249,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.572,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "131010140",
    "samples": 2315,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.01,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.06,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010150",
    "samples": 683,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.007,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.05,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101016001",
    "samples": 132,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.311,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.447,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101016002",
    "samples": 129,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.124,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101016003",
    "samples": 51,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.118,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101016004",
    "samples": 88,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.034,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101017001",
    "samples": 141,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.326,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.447,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101017002",
    "samples": 118,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.076,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101017003",
    "samples": 159,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.101,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101017004",
    "samples": 154,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.175,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101018001",
    "samples": 194,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.196,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101018002",
    "samples": 351,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.034,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.103,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101019001",
    "samples": 52,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.212,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.481,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101019002",
    "samples": 87,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.851,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.989,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101019003",
    "samples": 198,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.687,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.884,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101019004",
    "samples": 79,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.392,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.646,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101020001",
    "samples": 76,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.303,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.487,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101020002",
    "samples": 129,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.884,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101021001",
    "samples": 191,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.513,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.702,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101021002",
    "samples": 137,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101021003",
    "samples": 124,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.887,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101022001",
    "samples": 42,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.5,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.738,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101022002",
    "samples": 136,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.831,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.956,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101022003",
    "samples": 83,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.88,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.976,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101023001",
    "samples": 27,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.963,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101023002",
    "samples": 63,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101023003",
    "samples": 53,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.906,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101024001",
    "samples": 57,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.193,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101024002",
    "samples": 64,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.156,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.406,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101025001",
    "samples": 112,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.098,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101025002",
    "samples": 199,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.005
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.286,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101025003",
    "samples": 79,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.215,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101025004",
    "samples": 88,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.08,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13101026001",
    "samples": 79,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.038,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.342,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101026002",
    "samples": 70,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.114,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.229,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101026003",
    "samples": 165,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.63,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.733,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101027001",
    "samples": 45,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.556,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101027002",
    "samples": 48,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.167,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101027003",
    "samples": 106,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.009
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.123,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-shallow"
  },
  {
    "code": "131010280",
    "samples": 32,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.313,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101029001",
    "samples": 135,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.022,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.281,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101029002",
    "samples": 106,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.009
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.302,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-shallow"
  },
  {
    "code": "13101029003",
    "samples": 85,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.765,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010300",
    "samples": 81,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.148,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "131010310",
    "samples": 46,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.587,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13101032001",
    "samples": 28,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.5,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101032002",
    "samples": 90,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.656,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101033001",
    "samples": 151,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.742,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101033002",
    "samples": 114,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.132,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.939,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101034001",
    "samples": 124,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.823,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101034002",
    "samples": 133,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.045,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.233,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101034003",
    "samples": 108,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.398,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.991,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101034004",
    "samples": 113,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.982,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101034005",
    "samples": 45,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.689
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101034006",
    "samples": 81,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.136
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.926,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101035001",
    "samples": 60,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.833,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101035002",
    "samples": 110,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.973,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010360",
    "samples": 30,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010370",
    "samples": 17,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.059
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010370",
    "samples": 14,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010380",
    "samples": 11,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.091
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010390",
    "samples": 21,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010400",
    "samples": 13,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13101041001",
    "samples": 71,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.07
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101041002",
    "samples": 136,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.699,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101041003",
    "samples": 107,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.738,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010420",
    "samples": 8,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010430",
    "samples": 49,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.082,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010440",
    "samples": 3,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.333
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010450",
    "samples": 25,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.56,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101046001",
    "samples": 104,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.625,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101046002",
    "samples": 86,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.837,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101046003",
    "samples": 41,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.78,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "131010470",
    "samples": 126,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.968,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13101048001",
    "samples": 48,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.979,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101048002",
    "samples": 25,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101048003",
    "samples": 64,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13101048004",
    "samples": 14,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010490",
    "samples": 5,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010500",
    "samples": 26,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010510",
    "samples": 36,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010520",
    "samples": 16,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.813,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "131010530",
    "samples": 53,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.943,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131010540",
    "samples": 10,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "131010550",
    "samples": 175,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.246,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010560",
    "samples": 345,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.116,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "131010570",
    "samples": 158,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.108,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "131010580",
    "samples": 173,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.329,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131010590",
    "samples": 182,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.104,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103001001",
    "samples": 111,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.775,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.892,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103001002",
    "samples": 261,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.92,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.923,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103001003",
    "samples": 242,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.215,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.616,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103001004",
    "samples": 151,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.841,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.748,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103001005",
    "samples": 342,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.096,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.257,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103002001",
    "samples": 625,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.861,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.738,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103002002",
    "samples": 221,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.937,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.299,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103002003",
    "samples": 883,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.898,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.248,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103003001",
    "samples": 379,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.322,
        "worstDepth": "5〜10m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.172,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103003002",
    "samples": 114,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.825,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103004001",
    "samples": 121,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.231,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.504,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103004002",
    "samples": 160,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.475,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.669,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103004003",
    "samples": 101,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.911,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.861,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103004004",
    "samples": 104,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.99,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.923,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103004005",
    "samples": 119,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.782,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.782,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103004006",
    "samples": 127,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.835,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.772,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103005001",
    "samples": 165,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.17,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103005002",
    "samples": 145,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.055,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.241,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-shallow"
  },
  {
    "code": "13103005003",
    "samples": 183,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.049,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.284,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-shallow"
  },
  {
    "code": "13103006001",
    "samples": 370,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.262,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.419,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103006002",
    "samples": 505,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.002
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.263,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103006003",
    "samples": 307,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.088,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.179,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103006004",
    "samples": 389,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.067,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103006005",
    "samples": 181,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.834,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13103007001",
    "samples": 142,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.993,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103007002",
    "samples": 133,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.985,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.985,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103008001",
    "samples": 134,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.993,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.993,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103008002",
    "samples": 108,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.917,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.944,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103009001",
    "samples": 117,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.906,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.94,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103009002",
    "samples": 159,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.956,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.962,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103009003",
    "samples": 343,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.023
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.108,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103009004",
    "samples": 419,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.196,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.253,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103010001",
    "samples": 207,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.174,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103010002",
    "samples": 201,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.234,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103010003",
    "samples": 207,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.072,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103010004",
    "samples": 135,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.111,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103010005",
    "samples": 125,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.08,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103011001",
    "samples": 56,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.286,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103011002",
    "samples": 66,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.121,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "131030120",
    "samples": 30,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.467,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131030130",
    "samples": 80,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.063,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103014001",
    "samples": 258,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.198,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.597,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103014002",
    "samples": 228,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.298,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.711,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103014003",
    "samples": 307,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.013,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.261,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103014004",
    "samples": 410,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.261,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13103014005",
    "samples": 373,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.212,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103015001",
    "samples": 152,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.092,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103015002",
    "samples": 226,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.164,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103015003",
    "samples": 222,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.189,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103016001",
    "samples": 158,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.044,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103016002",
    "samples": 227,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.079,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103016003",
    "samples": 291,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.027,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103016004",
    "samples": 268,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.183,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103017001",
    "samples": 225,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.098,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103017002",
    "samples": 126,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.079,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103017003",
    "samples": 296,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.047,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103017004",
    "samples": 158,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.076,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103017005",
    "samples": 319,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.088,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103017006",
    "samples": 327,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.153,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103017007",
    "samples": 443,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.126,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13103018001",
    "samples": 196,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.117,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103018002",
    "samples": 92,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.033,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103018003",
    "samples": 58,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.086,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103019001",
    "samples": 89,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.124,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.483,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103019002",
    "samples": 109,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.303,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.615,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103019003",
    "samples": 52,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.192,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.654,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103019004",
    "samples": 26,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.808,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 1,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103020001",
    "samples": 142,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.282,
        "worstDepth": "5〜10m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.599,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103020002",
    "samples": 161,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.348,
        "worstDepth": "5〜10m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.484,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103020003",
    "samples": 66,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.47,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.697,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103021001",
    "samples": 139,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.266,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103021002",
    "samples": 1165,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.087,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022001",
    "samples": 251,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.235,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022002",
    "samples": 330,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.309,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022003",
    "samples": 150,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.5,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022004",
    "samples": 237,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.232,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022005",
    "samples": 171,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.041,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022006",
    "samples": 293,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.198,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022007",
    "samples": 256,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.219,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022008",
    "samples": 271,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.155,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103022009",
    "samples": 288,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.097,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103023001",
    "samples": 273,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.106,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103023002",
    "samples": 793,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.05,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103023003",
    "samples": 190,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.116,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103023004",
    "samples": 327,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.101,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103023005",
    "samples": 254,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.047,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103023006",
    "samples": 217,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.157,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103023007",
    "samples": 159,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.063,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103024001",
    "samples": 240,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.008,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103024002",
    "samples": 324,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.173,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103024003",
    "samples": 260,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.038,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103025001",
    "samples": 394,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.173,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103025002",
    "samples": 629,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.027,
        "worstDepth": "0.5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.334,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103025003",
    "samples": 738,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.073,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.164,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103025004",
    "samples": 523,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.002
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.101,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103026001",
    "samples": 218,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.028,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.766,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103026002",
    "samples": 251,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.135,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103026003",
    "samples": 168,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.375,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13103026004",
    "samples": 244,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.09,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103026005",
    "samples": 157,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.522,
        "worstDepth": "5〜10m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13103026006",
    "samples": 188,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.202,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103027001",
    "samples": 233,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.262,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-deep"
  },
  {
    "code": "13103027002",
    "samples": 239,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.146,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103027003",
    "samples": 255,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.043,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103027004",
    "samples": 267,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.011,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-shallow"
  },
  {
    "code": "13103027005",
    "samples": 571,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.159,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "13103028001",
    "samples": 408,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.64,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.294,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103028002",
    "samples": 189,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.931,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.037,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103028003",
    "samples": 398,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.822,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.264,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103028004",
    "samples": 704,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.634,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.261,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103029001",
    "samples": 593,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.558,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.192,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103029002",
    "samples": 931,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.749,
        "worstDepth": "5〜10m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.492,
        "worstDepth": "3〜5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103029003",
    "samples": 320,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.672,
        "worstDepth": "5〜10m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.481,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103029004",
    "samples": 612,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.304,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.351,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103029005",
    "samples": 716,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.306,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.384,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "13103030001",
    "samples": 581,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.174,
        "worstDepth": "3〜5m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.086,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "13103030002",
    "samples": 353,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.133,
        "worstDepth": "5〜10m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.303,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "131030310",
    "samples": 36,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.194,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.028,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 4,
    "layers": [
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.25,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-mid"
  },
  {
    "code": "131030310",
    "samples": 3,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.333,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.333,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 60,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.083,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 48,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.125,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 22,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.045,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 11,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.182,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 11,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.091
      }
    ],
    "profile": "hightide-unknown"
  },
  {
    "code": "131030310",
    "samples": 62,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.048,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 53,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.113,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 19,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.053,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 5721,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.009,
        "worstDepth": "10〜20m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.002,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-deep"
  },
  {
    "code": "131030310",
    "samples": 174,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.011,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 27,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.185,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.037,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 38,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.132,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.053,
        "worstDepth": "0.5m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  },
  {
    "code": "131030310",
    "samples": 106,
    "layers": [
      {
        "id": "hightide",
        "label": "高潮",
        "ratio": 0.066,
        "worstDepth": "0.5〜3m未満"
      },
      {
        "id": "flood",
        "label": "洪水",
        "ratio": 0.009,
        "worstDepth": "0.5〜3m未満"
      }
    ],
    "profile": "flood-hightide-mid"
  }
]

const BY_CODE = new Map<string, ChomeHazard>(CHOME_HAZARDS.map((entry) => [entry.code, entry]))

/** 町丁目の浸水想定。区域にかからなければ undefined */
export function chomeHazardOf(code: string): ChomeHazard | undefined {
  return BY_CODE.get(code)
}

const PROFILE_BY_ID = new Map<string, HazardProfile>(HAZARD_PROFILES.map((entry) => [entry.id, entry]))

export function hazardProfileOf(id: string): HazardProfile | undefined {
  return PROFILE_BY_ID.get(id)
}
