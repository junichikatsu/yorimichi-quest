import {
  SPOT_CATEGORY_COLORS,
  SPOT_CATEGORY_GLYPHS,
  type AreaSummary,
  type SpotId,
  type SpotWithDistance,
} from '@imanouchi/shared'
import mapboxgl from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import type { Position } from '../hooks/useGeolocation.js'

interface MapViewProps {
  token: string
  area: AreaSummary
  spots: SpotWithDistance[]
  position: Position | undefined
  selectedSpotId: SpotId | undefined
  onSelectSpot: (spotId: SpotId) => void
}

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

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
}: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<SpotId, mapboxgl.Marker>>(new Map())
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null)

  /** 地図の中心を現在地に合わせ続けるか。利用者が自分で動かしたら解除する */
  const [following, setFollowing] = useState(true)
  const centeredRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      // 測位できるまではエリア中心。位置が届いたら下の追従で現在地へ移す
      center: [area.center.lng, area.center.lat],
      zoom: area.zoom,
      attributionControl: true,
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
      const el = document.createElement('div')
      el.className = 'me'
      el.setAttribute('aria-label', '現在地')
      meMarkerRef.current = new mapboxgl.Marker({ element: el })
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
  }, [position, following])

  return (
    <div className="map">
      <div ref={containerRef} className="map__canvas" />
      {!following && (
        <button type="button" className="map__recenter" onClick={() => setFollowing(true)}>
          現在地へ戻る
        </button>
      )}
    </div>
  )
}
