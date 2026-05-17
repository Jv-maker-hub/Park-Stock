import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_LAT = -34.4265
const DEFAULT_LNG = -58.5795

export default function Mapa() {
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const [lugares, setLugares]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [estadoFil, setEstadoFil] = useState('activo')
  const [sinGeo, setSinGeo]       = useState(0)
  const markersRef = useRef([])

  useEffect(() => {
    supabase.from('lugares').select('*').order('nombre')
      .then(({ data }) => { setLugares(data ?? []); setLoading(false) })
  }, [])

  useEffect(() => {
    if (document.getElementById('leaflet-css')) return
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => { leafletRef.current = window.L; initMap() }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (leafletRef.current && !loading) updateMarkers()
  }, [lugares, estadoFil, loading])

  function initMap() {
    if (!mapRef.current || leafletRef.current._mapInit) return
    const L = leafletRef.current
    const map = L.map('park-map', { center: [DEFAULT_LAT, DEFAULT_LNG], zoom: 12 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map)
    leafletRef.current._map = map
    leafletRef.current._mapInit = true
    updateMarkers()
  }

  function updateMarkers() {
    const L = leafletRef.current
    if (!L || !L._map) return
    const map = L._map
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const filtered = estadoFil === 'todos'
      ? lugares
      : lugares.filter(l => l.estado === estadoFil)

    const withGeo = filtered.filter(l => l.lat && l.lng)
    setSinGeo(filtered.length - withGeo.length)

    withGeo.forEach(l => {
      const color = l.estado === 'activo' ? '#16a34a'
                  : l.estado === 'revisar' ? '#d97706'
                  : '#94a3b8'
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50% 50% 50% 0;
          background:${color};border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;">
          <span style="transform:rotate(45deg);color:white;font-size:9px;font-weight:bold;">${l.id_numerico ?? ''}</span>
        </div>`,
        iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-30],
      })

      const mapsUrl = `https://www.google.com/maps?q=${l.lat},${l.lng}`
      const popup = `
        <div style="min-width:200px;font-family:sans-serif;">
          <div style="font-weight:bold;font-size:13px;margin-bottom:4px;">#${l.id_numerico ?? ''} ${l.nombre}</div>
          ${l.nombre_anterior ? `<div style="color:#888;font-size:11px;margin-bottom:4px;">ant. ${l.nombre_anterior}</div>` : ''}
          <div style="font-size:11px;color:#555;margin-bottom:6px;">${l.direccion || ''}</div>
          ${l.contacto_nombre ? `<div style="font-size:11px;"><b>Contacto:</b> ${l.contacto_nombre}${l.contacto_apellido ? ' ' + l.contacto_apellido : ''}${l.contacto_tel ? ' · ' + l.contacto_tel : ''}</div>` : ''}
          <a href="${mapsUrl}" target="_blank" style="display:inline-block;margin-top:6px;font-size:11px;color:#16a34a;">Ver en Maps →</a>
        </div>`

      const marker = L.marker([l.lat, l.lng], { icon }).addTo(map)
      marker.bindPopup(popup)
      markersRef.current.push(marker)
    })

    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current)
      map.fitBounds(group.getBounds().pad(0.1))
    }
  }

  const conGeo = lugares.filter(l => l.lat && l.lng).length

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Mapa de Lugares</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {conGeo} de {lugares.length} lugares geocodificados
            {sinGeo > 0 && <span className="text-amber-500 ml-2">· {sinGeo} sin coordenadas en el filtro</span>}
          </p>
        </div>
        <select value={estadoFil} onChange={e => setEstadoFil(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="revisar">Revisar</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      <div id="park-map" ref={mapRef} className="flex-1 rounded-xl overflow-hidden shadow-sm border border-slate-200" />
    </div>
  )
}
