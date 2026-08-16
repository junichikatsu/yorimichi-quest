import type { AreaSummary, SpotWithDistance } from '@yorimichi-sample/shared'
import mapboxgl from 'mapbox-gl'
import { useEffect, useRef } from 'react'
import type { Position } from '../hooks/useGeolocation.js'

interface MapViewProps {
  token: string
  area: AreaSummary
  spots: SpotWithDistance[]
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
  position,
  selectedSpotId,
  onSelectSpot,
}: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [area.center.lng, area.center.lat],
      zoom: area.zoom,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [token, area.center.lat, area.center.lng, area.zoom])

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

  // 選択したスポットへ寄せる
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedSpotId) return
    const spot = spots.find((candidate) => candidate.spotId === selectedSpotId)
    if (!spot) return
    map.easeTo({ center: [spot.lng, spot.lat], duration: 400 })
  }, [selectedSpotId, spots])

  return <div className="map" ref={containerRef} role="application" aria-label="スポット地図" />
}
