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
import { SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite } from '../avatar/sprite.js'
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
 * 現在地の要素。
 *
 * ★ 見た目が未取得のときは点で描く。キャラクターを待って現在地が出ないほうが困る。
 */
function createMeElement(avatar: Avatar | undefined): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('aria-label', '現在地')

  if (!avatar) {
    el.className = 'me'
    return el
  }

  el.className = 'me me--avatar'
  const canvas = document.createElement('canvas')
  const scale = 1
  canvas.width = SPRITE_WIDTH * scale
  canvas.height = SPRITE_HEIGHT * scale
  drawSprite(canvas, { avatar, frame: 0, moving: false, direction: 'down' }, scale)
  el.appendChild(canvas)
  return el
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
}: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const fogRef = useRef<HTMLCanvasElement>(null)
  const markersRef = useRef<Map<SpotId, mapboxgl.Marker>>(new Map())
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null)
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
      map.remove()
      mapRef.current = null
    }
  }, [token, area])

  /** スポットのピン。差分だけ更新する（毎回作り直すと選択が飛ぶ） */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const alive = new Set(spots.map((spot) => spot.spotId))

    for (const spot of spots) {
      const existing = markersRef.current.get(spot.spotId)
      if (existing) {
        existing.setLngLat([spot.lng, spot.lat])
        const el = existing.getElement()
        el.classList.toggle('marker--selected', spot.spotId === selectedSpotId)
        continue
      }

      const marker = new mapboxgl.Marker({
        element: createMarkerElement(spot, spot.spotId === selectedSpotId),
      })
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
  }, [spots, selectedSpotId, onSelectSpot])

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
  }, [avatar])

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
      meMarkerRef.current = new mapboxgl.Marker({ element: createMeElement(avatar) })
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
  }, [position, following, avatar])

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
   * 霧を描く（フォグ・オブ・ウォー）。
   *
   * 画面全体を霧で塗ったあと、歩いたところを destination-out で削る。
   * 重なりの合成はブラウザに任せられるので、円の和集合を自前で計算しなくてよい。
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
    ctx.clearRect(0, 0, width, height)

    /*
     * ★ 有事モードでは霧を出さない（FR-08-2）。
     * 未踏のエリアが霧のままでは、そこにある避難所へ向かえない。
     * 霧はゲーム要素であり、有事に残しておくと**それ自体が危険**である。
     */
    if (emergency) return

    ctx.fillStyle = FOG_COLOR
    ctx.fillRect(0, 0, width, height)

    ctx.globalCompositeOperation = 'destination-out'
    const zoom = map.getZoom()

    /*
     * 先に開放済みの町丁目をくり抜く。
     *
     * 円だけで晴らすと道に沿った筋しか消えず、区画の内側が白いまま残る。
     *
     * ★ 形は API から来ない。コードから境界データを引く。256区画ぶんの座標を
     * 毎回送る意味がない。
     *
     * 隣の町丁目と辺を共有しているので、塗るだけだと境界に髪の毛のような隙間が
     * 残る。同じ経路を太い線でなぞって塗り足す。
     */
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'

    for (const area of areasRef.current) {
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

    for (const tile of tilesRef.current) {
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

    ctx.globalCompositeOperation = 'source-over'
  }, [revealRadiusM, emergency])

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
