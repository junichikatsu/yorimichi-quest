import {
  SPOT_CATEGORY_COLORS,
  SPOT_CATEGORY_GLYPHS,
  chomeByCode,
  type AreaSummary,
  type Avatar,
  type ExploredTile,
  type SpotId,
  type SpotWithDistance,
  type UnlockedAreaBounds,
} from '@imanouchi/shared'
import mapboxgl from 'mapbox-gl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite, type Condition } from '../avatar/sprite.js'
import {
  HAZARD_LAYERS,
  HAZARD_MAX_TILES,
  HAZARD_MAX_ZOOM,
  HAZARD_MIN_ZOOM,
  tileNorthWest,
  tilePointOf,
} from '../hazard.js'
import { getHazardTile } from '../hazard-tiles.js'
import { mapOptions, mapStyleFor } from '../map-options.js'
import type { Position } from '../hooks/useGeolocation.js'

interface MapViewProps {
  token: string
  area: AreaSummary
  spots: SpotWithDistance[]
  position: Position | undefined
  selectedSpotId: SpotId | undefined
  onSelectSpot: (spotId: SpotId) => void
  /** 歩いたタイル（FR-02-7） */
  exploredTiles: ExploredTile[]
  /** 全面が開放された町丁目（FR-02-7） */
  unlockedAreas: UnlockedAreaBounds[]
  revealRadiusM: number
  /** 現在地に描くキャラクター（FR-02-8）。未取得なら点で描く */
  avatar: Avatar | undefined
  /** 有事モードか（FR-08-2） */
  emergency: boolean
  /**
   * キャラクターの状態（#72）。浸水想定区域の中では濡れた見た目にする。
   *
   * ★ 有事モードでは親が `dry` を渡す。逃げている最中にゲームの演出を出さない
   * （ハザードそのものは有事でも**全面に出す**）。
   */
  condition: Condition
  /**
   * いまチェックインできるスポット。マーカーを目立たせる（FR-03-2）。
   *
   * ★ **押せるときだけ**目立たせる。遠い・時間をおくといった押せない理由は
   * 文言で出しているので、光らせる意味が無い（光っているのに押せない、が最悪）。
   */
  readySpotIds: readonly SpotId[]
  /**
   * チェックインボタンを地図上に出す1件。
   *
   * ★ 圏内の全件には出さない。半径100mにはAEDだけで何件も入るため、
   * ボタンを全部出すと地図がボタンで埋まる。**いちばん近い1件だけ**に出す。
   */
  checkinSpotId: SpotId | undefined
  onCheckinSpot: (spotId: SpotId) => void
}

/**
 * 霧の色。
 *
 * ★ 不透明にしない。マーカーが霧越しでも判別できる必要がある。未踏の場所にも
 * スポットはあり、そこへ向かえることが分からないと歩く動機にならない。
 */
const FOG_COLOR = 'rgba(22, 28, 17, 0.55)'

/** 霧の外周をぼかす割合。1.0 だと切り抜きが真円で「穴」に見えてしまう */
const FOG_FEATHER_START = 0.55

/**
 * ハザードの濃さ（#72）。
 *
 * ★ 塗りつぶさない。想定区域は広く、濃く重ねると道も避難所も見えなくなる。
 * **有事に地図が読めなくなるのは危険である。**
 */
const HAZARD_ALPHA = 0.6

/**
 * m からピクセルへの換算。
 *
 * Mapbox GL のズームは 512px タイル基準で、赤道の 1px は 78271.51696 / 2^zoom メートル。
 * ★ メルカトル図法の前提なので、地図側も projection: 'mercator' に固定する。
 * 既定の globe のままだと低ズームで半径がずれる。
 */
function metersToPixels(meters: number, lat: number, zoom: number): number {
  const metersPerPixel = (78271.51696 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
  return meters / metersPerPixel
}

/**
 * マーカーの要素。
 *
 * ★ `textContent` だけを使い、`innerHTML` は使わない。スポット名は
 * オープンデータ由来の外部文字列なので、HTML として解釈させない（lint でも塞いでいる）。
 */
function createMarkerElement(spot: SpotWithDistance, selected: boolean): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = selected ? 'marker marker--selected' : 'marker'
  el.style.setProperty('--marker-color', SPOT_CATEGORY_COLORS[spot.category])
  el.textContent = SPOT_CATEGORY_GLYPHS[spot.category]
  el.setAttribute('aria-label', spot.name)
  el.title = spot.name
  return el
}

/**
 * 地図の上に出すチェックインボタン。
 *
 * ★ スポットをタップして詳細を開いてから押す、という経路だけにしてはいけない。
 * 「タップすれば何かある」ことは画面から分からない。**押せる場所に着いたら、
 * 押せるボタンをその場所の上に出す。**
 *
 * ★ 文字は `textContent` で入れる（スポット名はオープンデータ由来の外部文字列）。
 */
function createCheckinElement(spot: SpotWithDistance, onClick: () => void): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'mapcheckin'
  el.textContent = 'チェックイン'
  // 読み上げでは「どこに」が要る。見た目に名前を入れると地図が名前で埋まる
  el.setAttribute('aria-label', `${spot.name} にチェックインする`)
  el.title = spot.name

  el.addEventListener('click', (event) => {
    // 地図まで伝わると、選択した直後に閉じてしまう（マーカーと同じ理由）
    event.stopPropagation()
    onClick()
  })

  return el
}

/**
 * 現在地の要素。
 *
 * ★ 見た目が未取得のときは点で描く。キャラクターを待って現在地が出ないほうが困る。
 */
function createMeElement(avatar: Avatar | undefined, condition: Condition): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('aria-label', condition === 'wet' ? '現在地（浸水想定区域の中）' : '現在地')

  if (!avatar) {
    el.className = condition === 'wet' ? 'me me--wet' : 'me'
    return el
  }

  el.className = 'me me--avatar'
  const canvas = document.createElement('canvas')
  const scale = 1
  canvas.width = SPRITE_WIDTH * scale
  canvas.height = SPRITE_HEIGHT * scale
  drawSprite(canvas, { avatar, frame: 0, moving: false, direction: 'down', condition }, scale)
  el.appendChild(canvas)
  return el
}

/**
 * 霧を晴らす形を描く（歩いたところ）。
 *
 * ★ 霧の切り抜きと、ハザードの切り抜きで**同じ形**を使う。二重に持つと
 * 「霧は晴れているのにハザードが出ない」がすぐ起きる。合成のしかた
 * （`destination-out` か `destination-in` か）だけを呼ぶ側が決める。
 */
function paintRevealShapes(
  ctx: CanvasRenderingContext2D,
  map: mapboxgl.Map,
  areas: readonly UnlockedAreaBounds[],
  tiles: readonly ExploredTile[],
  revealRadiusM: number,
  width: number,
  height: number,
): void {
  const zoom = map.getZoom()

  /*
   * 先に開放済みの町丁目を塗る。
   *
   * 円だけでは道に沿った筋しか消えず、区画の内側が残る。
   * 隣の町丁目と辺を共有しているので、同じ経路を太い線でなぞって塗り足す
   * （塗るだけだと境界に髪の毛のような隙間が残る）。
   */
  ctx.fillStyle = 'rgba(0, 0, 0, 1)'
  ctx.strokeStyle = 'rgba(0, 0, 0, 1)'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'

  for (const area of areas) {
    const chome = chomeByCode(area.areaKey)
    if (!chome) continue

    // 画面外の区画は描かない。外接矩形で弾く
    const [minLng, minLat, maxLng, maxLat] = chome.bbox
    const topLeft = map.project([minLng, maxLat])
    const bottomRight = map.project([maxLng, minLat])
    if (
      Math.max(topLeft.x, bottomRight.x) < 0 ||
      Math.max(topLeft.y, bottomRight.y) < 0 ||
      Math.min(topLeft.x, bottomRight.x) > width ||
      Math.min(topLeft.y, bottomRight.y) > height
    ) {
      continue
    }

    ctx.beginPath()
    for (const ring of chome.rings) {
      ring.forEach(([lng, lat], index) => {
        const point = map.project([lng, lat])
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.closePath()
    }
    ctx.fill()
    ctx.stroke()
  }

  for (const tile of tiles) {
    const point = map.project([tile.lng, tile.lat])
    const radius = metersToPixels(revealRadiusM, tile.lat, zoom)
    // 画面外のタイルは描かない（歩くほど件数が増えるため）
    if (
      point.x < -radius ||
      point.y < -radius ||
      point.x > width + radius ||
      point.y > height + radius
    ) {
      continue
    }

    const gradient = ctx.createRadialGradient(
      point.x,
      point.y,
      radius * FOG_FEATHER_START,
      point.x,
      point.y,
      radius,
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient

    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * ハザード（浸水想定）のタイルを描く（#72）。
 *
 * ★ Mapbox のラスタレイヤでは**多角形で切り抜けない**。素直にレイヤとして足すと、
 * 半透明の霧の下から未踏の範囲でも透けて見える。霧と同じ作法で自前に描く。
 *
 * ★ 描く枚数に上限を置く。引きの画では意味が薄いのに枚数だけ増える。
 */
function paintHazardTiles(
  ctx: CanvasRenderingContext2D,
  map: mapboxgl.Map,
  onTileReady: () => void,
): void {
  const zoom = Math.round(map.getZoom())
  if (zoom < HAZARD_MIN_ZOOM) return
  const z = Math.min(HAZARD_MAX_ZOOM, zoom)

  const bounds = map.getBounds()
  if (!bounds) return

  const nw = tilePointOf(bounds.getNorth(), bounds.getWest(), z)
  const se = tilePointOf(bounds.getSouth(), bounds.getEast(), z)
  const count = (se.x - nw.x + 1) * (se.y - nw.y + 1)
  if (count <= 0 || count > HAZARD_MAX_TILES) return

  for (const layer of HAZARD_LAYERS) {
    for (let x = nw.x; x <= se.x; x += 1) {
      for (let y = nw.y; y <= se.y; y += 1) {
        const image = getHazardTile(layer, z, x, y, onTileReady)
        if (!image) continue

        const topLeft = tileNorthWest(z, x, y)
        const bottomRight = tileNorthWest(z, x + 1, y + 1)
        const a = map.project([topLeft.lng, topLeft.lat])
        const b = map.project([bottomRight.lng, bottomRight.lat])
        // 1px の隙間が縞になって見えるので、わずかに広げて描く
        ctx.drawImage(image, a.x, a.y, b.x - a.x + 1, b.y - a.y + 1)
      }
    }
  }
}

/**
 * 地図（FR-02-1）。
 *
 * ★ 帰属表示（`attributionControl`）を消さない。Mapbox の利用規約で必須であり、
 * **提出資料のスクリーンショットにも写っている必要がある**（FR-02-6）。
 */
export function MapView({
  token,
  area,
  spots,
  position,
  selectedSpotId,
  onSelectSpot,
  exploredTiles,
  unlockedAreas,
  revealRadiusM,
  avatar,
  emergency,
  condition,
  readySpotIds,
  checkinSpotId,
  onCheckinSpot,
}: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const fogRef = useRef<HTMLCanvasElement>(null)
  /** ハザードを切り抜くための作業用キャンバス（画面には出さない） */
  const hazardCanvasRef = useRef<HTMLCanvasElement | undefined>(undefined)
  const markersRef = useRef<Map<SpotId, mapboxgl.Marker>>(new Map())
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null)
  /** 地図上のチェックインボタン。出しているスポットも一緒に覚える */
  const checkinMarkerRef = useRef<{ spotId: SpotId; marker: mapboxgl.Marker } | null>(null)

  /**
   * 押されたときに呼ぶ処理。
   *
   * ★ ref に持つ。ボタンの要素は作り直さない（押した瞬間に作り替わると取りこぼす）
   * ため、生成時に閉じ込めた関数は古くなる。**古い現在地でチェックインを送る**
   * ことになるので、呼ぶ側を常に最新にしておく。
   */
  const checkinHandlerRef = useRef(onCheckinSpot)
  useEffect(() => {
    checkinHandlerRef.current = onCheckinSpot
  }, [onCheckinSpot])
  // 地図のイベントから毎フレーム読むので、再購読が要らない ref に持つ
  const tilesRef = useRef<ExploredTile[]>(exploredTiles)
  const areasRef = useRef<UnlockedAreaBounds[]>(unlockedAreas)

  /** 地図の中心を現在地に合わせ続けるか。利用者が自分で動かしたら解除する */
  const [following, setFollowing] = useState(true)
  const centeredRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = token
    // 言語・投影法・操作部品の文言は map-options.ts に置いてある（検査で固定するため）
    const map = new mapboxgl.Map({
      container: containerRef.current,
      ...mapOptions(area),
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    /*
     * 利用者が自分で地図を動かしたら追従をやめる。
     *
     * ドラッグ・ピンチ・ダブルタップはいずれも movestart を伴い、easeTo など
     * 画面側からの移動には originalEvent が付かない。それで見分けられる。
     */
    map.on('movestart', (event) => {
      if (event.originalEvent) setFollowing(false)
    })

    return () => {
      for (const marker of markersRef.current.values()) marker.remove()
      markersRef.current.clear()
      meMarkerRef.current?.remove()
      meMarkerRef.current = null
      checkinMarkerRef.current?.marker.remove()
      checkinMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [token, area])

  /** スポットのピン。差分だけ更新する（毎回作り直すと選択が飛ぶ） */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const alive = new Set(spots.map((spot) => spot.spotId))
    const ready = new Set(readySpotIds)

    for (const spot of spots) {
      const existing = markersRef.current.get(spot.spotId)
      if (existing) {
        existing.setLngLat([spot.lng, spot.lat])
        const el = existing.getElement()
        el.classList.toggle('marker--selected', spot.spotId === selectedSpotId)
        el.classList.toggle('marker--ready', ready.has(spot.spotId))
        continue
      }

      const element = createMarkerElement(spot, spot.spotId === selectedSpotId)
      element.classList.toggle('marker--ready', ready.has(spot.spotId))

      const marker = new mapboxgl.Marker({ element })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map)

      marker.getElement().addEventListener('click', (event) => {
        // 地図のクリックまで伝わると、選択した直後に閉じてしまう
        event.stopPropagation()
        onSelectSpot(spot.spotId)
      })

      markersRef.current.set(spot.spotId, marker)
    }

    for (const [spotId, marker] of markersRef.current) {
      if (!alive.has(spotId)) {
        marker.remove()
        markersRef.current.delete(spotId)
      }
    }
  }, [spots, selectedSpotId, onSelectSpot, readySpotIds])

  /**
   * 地図上のチェックインボタン（FR-03-1・FR-03-2）。
   *
   * ★ 出しているスポットが変わらない限り**作り直さない**。押した瞬間に作り替わると
   * クリックが取りこぼされる（要素が入れ替わると click が発火しない）。
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const spot = checkinSpotId ? spots.find((item) => item.spotId === checkinSpotId) : undefined
    const current = checkinMarkerRef.current

    if (!spot) {
      current?.marker.remove()
      checkinMarkerRef.current = null
      return
    }

    if (current?.spotId === spot.spotId) {
      current.marker.setLngLat([spot.lng, spot.lat])
      return
    }

    current?.marker.remove()

    const marker = new mapboxgl.Marker({
      element: createCheckinElement(spot, () => checkinHandlerRef.current(spot.spotId)),
      // ピンの上に出す。重ねるとピンが押せなくなる
      anchor: 'bottom',
      offset: [0, -22],
    })
      .setLngLat([spot.lng, spot.lat])
      .addTo(map)

    checkinMarkerRef.current = { spotId: spot.spotId, marker }
  }, [checkinSpotId, spots])

  /**
   * 現在地の見た目（FR-02-8）。
   *
   * ★ キャラクターはキャンバスに描く。見た目が変わったら作り直す必要があるので、
   * 要素の再利用は座標更新だけに限る。
   */
  useEffect(() => {
    const marker = meMarkerRef.current
    if (!marker) return
    marker.remove()
    meMarkerRef.current = null
    // 次の描画で作り直される（下の効果が position を見て作る）
  }, [avatar, condition])

  /** 現在地のマーカーと追従 */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!position) {
      meMarkerRef.current?.remove()
      meMarkerRef.current = null
      return
    }

    if (!meMarkerRef.current) {
      meMarkerRef.current = new mapboxgl.Marker({ element: createMeElement(avatar, condition) })
        .setLngLat([position.lng, position.lat])
        .addTo(map)
    } else {
      meMarkerRef.current.setLngLat([position.lng, position.lat])
    }

    if (!following) return
    if (centeredRef.current) {
      map.easeTo({ center: [position.lng, position.lat], duration: 500 })
    } else {
      // 初回はアニメーションなしで合わせる。動きながら始まると位置が分かりにくい
      map.jumpTo({ center: [position.lng, position.lat] })
      centeredRef.current = true
    }
  }, [position, following, avatar, condition])

  /**
   * 有事モードの配色へ切り替える（FR-08-2・FR-08-8）。
   *
   * ★ 地図を作り直さない。`setStyle` は**中心・縮尺・向きを保つ**ので、
   * 切替が画面遷移ではなく状態遷移になる（FR-08-8）。作り直すと現在地へ跳ね戻る。
   *
   * ★ マーカーと霧のキャンバスはスタイルに属さないので消えない
   * （マーカーは DOM 要素、霧は地図の上に重ねた別のキャンバス）。
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(mapStyleFor(emergency))
  }, [emergency])

  /**
   * 霧とハザードを描く（フォグ・オブ・ウォー ＋ #72）。
   *
   * 画面全体を霧で塗ったあと、歩いたところを destination-out で削る。
   * 重なりの合成はブラウザに任せられるので、円の和集合を自前で計算しなくてよい。
   *
   * ★ ハザードは**歩いたところにだけ**出す。別のキャンバスに描いてから
   * 同じ形で destination-in で切り抜き、霧の穴の中へ重ねる。
   *
   * ★ 有事モードでは霧を出さず、ハザードを**切り抜かずに全面へ出す**。
   * 「歩いていないから危険が見えない」は有事に人を危険へ晒す（FR-08-2 と同じ理由）。
   */
  const drawFog = useCallback(() => {
    const map = mapRef.current
    const canvas = fogRef.current
    if (!map || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return

    // CSS ピクセルと描画バッファを合わせる（Retina で霧がぼやけないように）
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, width, height)

    /* ---------------- ハザード（#72） ---------------- */

    // タイルが届いたら描き直す。ref 越しに最新の描画を呼ぶ（自分自身を依存にしない）
    const onTileReady = (): void => drawRef.current?.()

    const hazard = hazardCanvasRef.current ?? document.createElement('canvas')
    hazardCanvasRef.current = hazard
    if (hazard.width !== canvas.width || hazard.height !== canvas.height) {
      hazard.width = canvas.width
      hazard.height = canvas.height
    }

    const hazardCtx = hazard.getContext('2d')
    if (hazardCtx) {
      hazardCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      hazardCtx.globalCompositeOperation = 'source-over'
      hazardCtx.globalAlpha = 1
      hazardCtx.clearRect(0, 0, width, height)

      paintHazardTiles(hazardCtx, map, onTileReady)

      /*
       * ★ 平時は歩いたところだけに残す。
       * 有事モードでは切り抜かない（全面に出す）。
       */
      if (!emergency) {
        hazardCtx.globalCompositeOperation = 'destination-in'
        paintRevealShapes(
          hazardCtx,
          map,
          areasRef.current,
          tilesRef.current,
          revealRadiusM,
          width,
          height,
        )
        hazardCtx.globalCompositeOperation = 'source-over'
      }
    }

    /* ---------------- 霧（FR-02-7） ---------------- */

    /*
     * ★ 有事モードでは霧を出さない（FR-08-2）。
     * 未踏のエリアが霧のままでは、そこにある避難所へ向かえない。
     * 霧はゲーム要素であり、有事に残しておくと**それ自体が危険**である。
     */
    if (!emergency) {
      ctx.fillStyle = FOG_COLOR
      ctx.fillRect(0, 0, width, height)

      ctx.globalCompositeOperation = 'destination-out'
      paintRevealShapes(ctx, map, areasRef.current, tilesRef.current, revealRadiusM, width, height)
      ctx.globalCompositeOperation = 'source-over'
    }

    /*
     * ハザードを最後に重ねる。
     *
     * ★ 地図が読めなくなるほど濃くしない。想定区域は広く、真上から塗りつぶすと
     * 道も避難所も見えなくなる（有事にそれは危険である）。
     */
    if (hazardCtx) {
      ctx.globalAlpha = HAZARD_ALPHA
      ctx.drawImage(hazard, 0, 0, width, height)
      ctx.globalAlpha = 1
    }
  }, [revealRadiusM, emergency])

  /** 最新の描画関数。タイルが遅れて届いたときに呼ぶ */
  const drawRef = useRef<(() => void) | undefined>(undefined)
  useEffect(() => {
    drawRef.current = drawFog
  }, [drawFog])

  // 地図が動いている間ずっと追従させる（move はアニメーション中も毎フレーム発火する）
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.on('move', drawFog)
    map.on('resize', drawFog)
    map.on('load', drawFog)
    drawFog()

    return () => {
      map.off('move', drawFog)
      map.off('resize', drawFog)
      map.off('load', drawFog)
    }
  }, [drawFog])

  // 霧の元データが変わったら描き直す。ref に写してから呼ぶ
  useEffect(() => {
    tilesRef.current = exploredTiles
    areasRef.current = unlockedAreas
    drawFog()
  }, [exploredTiles, unlockedAreas, drawFog])

  return (
    <div className="map">
      <div ref={containerRef} className="map__canvas" />
      {/* 霧は地図の上に重ねる。操作を奪わないよう pointer-events は CSS で切る */}
      <canvas ref={fogRef} className="map__fog" aria-hidden="true" />
      {!following && (
        <button type="button" className="map__recenter" onClick={() => setFollowing(true)}>
          現在地へ戻る
        </button>
      )}
    </div>
  )
}
