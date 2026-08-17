import type { AreaSummary, ExploredTile, SpotWithDistance } from '@map-checkin/shared'
import mapboxgl from 'mapbox-gl'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Position } from '../hooks/useGeolocation.js'

interface MapViewProps {
  token: string
  area: AreaSummary
  spots: SpotWithDistance[]
  exploredTiles: ExploredTile[]
  revealRadiusM: number
  position: Position | undefined
  selectedSpotId: string | undefined
  onSelectSpot: (spotId: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  shelter: '#2f6f3e',
  aed: '#c0392b',
  accessible_toilet: '#2d6ca2',
  water: '#1f8a8a',
}

/**
 * 未踏エリアを覆う霧の色。
 *
 * 地図スタイルは streets-v12 固定（常に明るい）なので、OS のダークモードでは切り替えない。
 * マーカーが霧越しでも判別できるよう不透明度は 0.55 に留めている。
 */
const FOG_COLOR = 'rgba(22, 28, 17, 0.55)'

/** 霧の外周をぼかす割合。1.0 だと切り抜きが真円で「穴」に見えてしまう */
const FOG_FEATHER_START = 0.55

/** 現在地へ寄せるときのアニメーション時間（ms）。歩行中に酔わない程度に短く */
const FOLLOW_DURATION_MS = 600

/**
 * m からピクセルへの換算。
 *
 * Mapbox GL のズームは 512px タイル基準で、赤道の 1px は 78271.51696 / 2^zoom メートル。
 * メルカトル図法の前提なので、地図側も projection: 'mercator' に固定している。
 */
function metersToPixels(meters: number, lat: number, zoom: number): number {
  const metersPerPixel = (78271.51696 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
  return meters / metersPerPixel
}

function createMarkerElement(spot: SpotWithDistance, selected: boolean): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'marker'
  if (spot.unexplored) el.classList.add('marker--unexplored')
  if (selected) el.classList.add('marker--selected')
  el.style.setProperty('--marker-color', CATEGORY_COLORS[spot.category] ?? '#555')
  // textContent のみ。innerHTML は使わない。
  el.textContent = spot.unexplored ? `×${spot.pointMultiplier}` : ''
  el.setAttribute('aria-label', spot.name)
  el.title = spot.name
  return el
}

export function MapView({
  token,
  area,
  spots,
  exploredTiles,
  revealRadiusM,
  position,
  selectedSpotId,
  onSelectSpot,
}: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fogRef = useRef<HTMLCanvasElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null)
  // 地図のイベントから毎フレーム読むので、再購読が要らない ref に持つ
  const tilesRef = useRef<ExploredTile[]>(exploredTiles)

  /** 地図の中心を現在地に合わせ続けるか。利用者が地図を動かすと解除する */
  const [following, setFollowing] = useState(true)
  /** 一度でも現在地へ寄せたか。初回だけアニメーションなしで合わせる */
  const centeredRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      // 測位できるまではエリア中心。位置が届いたら下の追従で現在地へ移す
      center: [area.center.lng, area.center.lat],
      zoom: area.zoom,
      // 霧の半径計算がメルカトル前提。既定の globe のままだと低ズームで半径がずれる
      projection: 'mercator',
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    // 利用者が自分で地図を動かしたら追従をやめる。
    // ドラッグ・ピンチ・ダブルタップのいずれも movestart を伴い、
    // easeTo など画面側からの移動には originalEvent が付かないので、それで見分けられる。
    map.on('movestart', (event) => {
      if (event.originalEvent) setFollowing(false)
    })

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
      centeredRef.current = false
    }
  }, [token, area.center.lat, area.center.lng, area.zoom])

  /**
   * 霧を描く（フォグ・オブ・ウォー）。
   *
   * 画面全体を霧で塗ったあと、探索済みタイルの位置を destination-out で削る。
   * 重なりの合成はブラウザの合成処理に任せられるので、円の和集合を自前で計算しなくてよい。
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
    ctx.fillStyle = FOG_COLOR
    ctx.fillRect(0, 0, width, height)

    ctx.globalCompositeOperation = 'destination-out'
    const zoom = map.getZoom()
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
  }, [revealRadiusM])

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

  useEffect(() => {
    tilesRef.current = exploredTiles
    drawFog()
  }, [exploredTiles, drawFog])

  // スポットのマーカーを差分更新する
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const alive = new Set<string>()

    for (const spot of spots) {
      alive.add(spot.spotId)
      markersRef.current.get(spot.spotId)?.remove()

      const marker = new mapboxgl.Marker({ element: createMarkerElement(spot, spot.spotId === selectedSpotId) })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map)

      marker.getElement().addEventListener('click', (event) => {
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

  // 現在地マーカー
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!position) {
      meMarkerRef.current?.remove()
      meMarkerRef.current = null
      return
    }

    if (!meMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'marker-me'
      meMarkerRef.current = new mapboxgl.Marker({ element: el })
    }

    meMarkerRef.current.setLngLat([position.lng, position.lat]).addTo(map)
  }, [position])

  /**
   * 現在地へ追従する。
   *
   * 位置が届くたびに中心を合わせ直す。初回だけアニメーションを挟まないのは、
   * 起動直後にエリア中心から現在地まで地図が流れて見えるのを避けるため。
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !position || !following) return

    if (centeredRef.current) {
      map.easeTo({ center: [position.lng, position.lat], duration: FOLLOW_DURATION_MS })
    } else {
      map.jumpTo({ center: [position.lng, position.lat] })
      centeredRef.current = true
    }
  }, [position, following])

  // スポットを選んだら追従をやめる。続けていると次の測位で現在地へ引き戻されてしまう
  useEffect(() => {
    if (!selectedSpotId) return
    setFollowing(false)
  }, [selectedSpotId])

  // 選択したスポットへ寄せる
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedSpotId) return
    const spot = spots.find((candidate) => candidate.spotId === selectedSpotId)
    if (!spot) return
    map.easeTo({ center: [spot.lng, spot.lat], duration: 400 })
  }, [selectedSpotId, spots])

  // すでに追従中なら following は変わらず上の効果が走らないので、ここでも寄せておく
  const handleRecenter = useCallback(() => {
    if (!position) return
    setFollowing(true)
    centeredRef.current = true
    mapRef.current?.easeTo({
      center: [position.lng, position.lat],
      duration: FOLLOW_DURATION_MS,
    })
  }, [position])

  return (
    <div className="map" role="application" aria-label="スポット地図">
      <div className="map__gl" ref={containerRef} />
      {/* 霧は装飾。読み上げ対象から外し、地図の操作も邪魔しない（pointer-events: none） */}
      <canvas className="map__fog" ref={fogRef} aria-hidden="true" />

      {position && (
        <button
          type="button"
          className={following ? 'map__locate is-active' : 'map__locate'}
          onClick={handleRecenter}
          aria-pressed={following}
          aria-label="現在地を地図の中心に合わせる"
          title="現在地を地図の中心に合わせる"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3.5" fill="currentColor" />
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 1.5v3.5M12 19v3.5M1.5 12h3.5M19 12h3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
