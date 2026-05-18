import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Plus, Search, MapPin, ExternalLink, Check,
  MessageCircle, Loader2, ChevronDown, ChevronUp, Building2, Download
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const ESTADO_COLORS = {
  activo:   'bg-emerald-100 text-emerald-700',
  inactivo: 'bg-slate-100 text-slate-500',
  revisar:  'bg-amber-100 text-amber-700',
}

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']



const empty = {
  nombre: '', nombre_oficial: '', nombre_anterior: '',
  direccion: '', lat: null, lng: null,
  supervisor_id: '', cliente_id: '', responsable_id: '',
  estado: 'activo', dias_atencion: [],
  horario_apertura: '', horario_cierre: '',
  observaciones: '',
  dia_reparto: '',
  // Características
  metros_cuadrados: '', cantidad_empleados: '', cantidad_banos: '',
  cantidad_pisos: '', acceso_publico: false,
  tiene_cocina: false, frecuencia_limpieza: '', personal_limpieza: '',
}

function waLink(tel) {
  if (!tel) return null
  const num = tel.replace(/[\s\-()]/g, '')
  const clean = num.startsWith('+54') ? num.slice(1)
    : num.startsWith('0') ? '54' + num.slice(1)
    : '54' + num
  return `https://wa.me/${clean}`
}

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const h = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(h)
  }, [value, delay])
  return dv
}


// ── Buscador de personal ──────────────────────────────────────────────────
function PersonalPicker({ personal, value, search, onSearch, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = value ? personal.find(p => p.id === value) : null

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = search.trim()
    ? personal.filter(p =>
        `${p.apellido} ${p.nombre} ${p.dni}`.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : []

  return (
    <div className="relative" ref={ref}>
      {selected && !open ? (
        <div className="flex items-center justify-between px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
          <span className="text-slate-800 font-medium">{selected.apellido}, {selected.nombre}
            <span className="ml-2 text-xs text-slate-400 font-normal">DNI {selected.dni}</span>
          </span>
          <button type="button" onClick={() => { onChange(null); onSearch('') }}
            className="text-slate-400 hover:text-red-500 text-xs ml-2">✕</button>
        </div>
      ) : (
        <input
          type="text"
          value={search}
          placeholder="Buscar por apellido, nombre o DNI..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          onChange={e => { onSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map(p => (
            <button key={p.id} type="button"
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors text-left"
              onMouseDown={e => { e.preventDefault(); onChange(p.id); setOpen(false) }}>
              <span className="font-medium text-slate-800">{p.apellido}, {p.nombre}</span>
              <span className="text-xs text-slate-400 font-mono">{p.dni}</span>
            </button>
          ))}
        </div>
      )}
      {open && search.trim() && filtered.length === 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400">
          Sin resultados para "{search}"
        </div>
      )}
    </div>
  )
}

export default function Lugares() {
  const [rows, setRows]             = useState([])
  const [filtered, setFiltered]     = useState([])
  const [search, setSearch]         = useState('')
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [clienteFilter, setClienteFilter] = useState('todos')
  const [loading, setLoading]       = useState(true)
  const [supervisores, setSupervisores] = useState([])
  const [clientes, setClientes]     = useState([])
  const [personal, setPersonal]     = useState([])
  const [persSearch, setPersSearch] = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(empty)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [caract, setCaract]         = useState(false)   // collapsible open
  const [sortField, setSortField]   = useState('nombre')
  const [sortDir, setSortDir]       = useState('asc')

  function buildSuggestionLabel(s) {
    // s is a Google Places prediction — has .structured_formatting
    const main = s.structured_formatting?.main_text || s.description
    const sub  = s.structured_formatting?.secondary_text || ''
    return { main, sub }
  }


  // Google Places Autocomplete
  const [dirQuery, setDirQuery]        = useState('')
  const [suggestions, setSuggestions]  = useState([])
  const [geoLoading, setGeoLoading]    = useState(false)
  const [showSuggestions, setShowSugg] = useState(false)
  const debouncedQuery = useDebounce(dirQuery, 300)
  const sugRef   = useRef(null)

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    function h(e) { if (sugRef.current && !sugRef.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Google Places via JS SDK
  const GKEY = import.meta.env.VITE_GOOGLE_PLACES_KEY
  const autoSvcRef  = useRef(null)
  const placeSvcRef = useRef(null)
  const mapDivRef   = useRef(null)

  useEffect(() => {
    function init() {
      if (!window.google?.maps?.places) return
      autoSvcRef.current = new window.google.maps.places.AutocompleteService()
      if (mapDivRef.current)
        placeSvcRef.current = new window.google.maps.places.PlacesService(mapDivRef.current)
    }
    if (window.google?.maps?.places) { init(); return }
    if (document.getElementById('gmaps-ps')) { return }
    const s = document.createElement('script')
    s.id  = 'gmaps-ps'
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GKEY}&libraries=places&language=es&callback=__gmapsReady`
    s.async = true
    window.__gmapsReady = init
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) { setSuggestions([]); return }
    const svc = autoSvcRef.current
    if (!svc) return
    setGeoLoading(true)
    svc.getPlacePredictions(
      { input: debouncedQuery, componentRestrictions: { country: 'ar' },
        locationBias: { center: new window.google.maps.LatLng(-34.4265, -58.5795), radius: 30000 } },
      (predictions, status) => {
        setGeoLoading(false)
        const OK = window.google.maps.places.PlacesServiceStatus.OK
        if (status === OK && predictions?.length) { setSuggestions(predictions); setShowSugg(true) }
        else { setSuggestions([]); setShowSugg(false) }
      }
    )
  }, [debouncedQuery])

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    function h(e) { if (sugRef.current && !sugRef.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 4) { setSuggestions([]); return }
    setGeoLoading(true)
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedQuery + ', Buenos Aires, Argentina')}&format=json&addressdetails=1&limit=6&bounded=1&viewbox=-59.2,-34.1,-58.1,-34.8`,
      { headers: { 'Accept-Language': 'es' } }
    )
      .then(r => r.json())
      .then(data => { setSuggestions(data); setShowSugg(data.length > 0) })
      .catch(() => setSuggestions([]))
      .finally(() => setGeoLoading(false))
  }, [debouncedQuery])

  function selectSuggestion(s) {
    if (!placeSvcRef.current && window.google?.maps?.places && mapDivRef.current)
      placeSvcRef.current = new window.google.maps.places.PlacesService(mapDivRef.current)
    const svc = placeSvcRef.current
    if (!svc) { setDirQuery(s.description); setShowSugg(false); setSuggestions([]); return }
    svc.getDetails(
      { placeId: s.place_id, fields: ['geometry','formatted_address'] },
      (place, status) => {
        const OK = window.google.maps.places.PlacesServiceStatus.OK
        const addr = status === OK ? place.formatted_address : s.description
        const lat  = status === OK ? place.geometry.location.lat() : null
        const lng  = status === OK ? place.geometry.location.lng() : null
        setForm(f => ({ ...f, direccion: addr, lat, lng }))
        setDirQuery(addr)
        setShowSugg(false); setSuggestions([])
      }
    )
  }

  useEffect(() => {
    let data = rows
    if (estadoFilter !== 'todos') data = data.filter(r => r.estado === estadoFilter)
    if (clienteFilter !== 'todos') data = data.filter(r => String(r.cliente_id ?? '') === String(clienteFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(r =>
        r.nombre.toLowerCase().includes(q) ||
        r.nombre_anterior?.toLowerCase().includes(q) ||
        r.direccion?.toLowerCase().includes(q) ||
        r.contacto_nombre?.toLowerCase().includes(q) ||
        String(r.id_numerico ?? '').includes(q)
      )
    }
    data = [...data].sort((a, b) => {
      const va = sortField === 'id_numerico' ? (a.id_numerico ?? 9999) : (a.nombre ?? '')
      const vb = sortField === 'id_numerico' ? (b.id_numerico ?? 9999) : (b.nombre ?? '')
      const cmp = typeof va === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
    setFiltered(data)
  }, [rows, search, estadoFilter, clienteFilter, sortField, sortDir])

  async function fetchAll() {
    setLoading(true)
    const [lugaresRes, supRes, cliRes, persRes] = await Promise.all([
      supabase.from('lugares').select('*').order('nombre'),
      supabase.from('supervisores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('personal').select('id, nombre, apellido, dni').eq('estado', 'activo').order('apellido'),
    ])
    setRows(lugaresRes.data ?? [])
    setSupervisores(supRes.data ?? [])
    setClientes(cliRes.data ?? [])
    setPersonal(persRes.data ?? [])
    setLoading(false)
  }

  function openNew() {
    setForm(empty); setDirQuery(''); setSuggestions([]); setError(''); setCaract(false); setModalOpen(true)
  }

  function openEdit(row) {
    setForm({
      ...empty, ...row,
      nombre_anterior:   row.nombre_anterior   ?? '',
      supervisor_id:     row.supervisor_id      ?? '',
      cliente_id:        row.cliente_id         ?? '',
      responsable_id:    row.responsable_id     ?? '',
      lat:               row.lat               ?? null,
      lng:               row.lng               ?? null,
      horario_apertura:  row.horario_apertura   ?? '',
      horario_cierre:    row.horario_cierre     ?? '',
      dias_atencion:     row.dias_atencion      ?? [],
      dia_reparto:       row.dia_reparto        ?? '',
      metros_cuadrados:  row.metros_cuadrados   ?? '',
      cantidad_empleados:row.cantidad_empleados ?? '',
      cantidad_banos:    row.cantidad_banos     ?? '',
      cantidad_pisos:    row.cantidad_pisos     ?? '',
      acceso_publico:    row.acceso_publico     ?? false,
      tiene_cocina:      row.tiene_cocina       ?? false,
      frecuencia_limpieza: row.frecuencia_limpieza ?? '',
      personal_limpieza: row.personal_limpieza  ?? '',
    })
    setDirQuery(row.direccion ?? '')
    setSuggestions([]); setError(''); setCaract(false); setModalOpen(true)
  }

  function toggleDia(dia) {
    setForm(f => ({
      ...f,
      dias_atencion: f.dias_atencion.includes(dia)
        ? f.dias_atencion.filter(d => d !== dia)
        : [...f.dias_atencion, dia]
    }))
  }

  const num = (v) => v === '' || v === null || v === undefined ? null : parseFloat(v)


  function exportarLugares() {
    const COLS = ['id_numerico','nombre','nombre_anterior','direccion','estado',
      'metros_cuadrados','cantidad_empleados','cantidad_banos','cantidad_pisos',
      'acceso_publico','tiene_cocina','frecuencia_limpieza','personal_limpieza',
      'dia_reparto','observaciones']
    const FRIENDLY = ['ID (no cambiar)','Nombre Park Service ⭐','Nombre Entrega (Patri)','Dirección',
      'Estado',
      'm²','Empleados','Baños','Pisos',
      'Acceso Público (SI/NO)','Tiene Cocina (SI/NO)',
      'Frec. Limpieza (días)','Personal Limpieza','Día de Reparto','Observaciones']

    // Una sola fila de encabezado con nombres amigables
    const wsData = [
      FRIENDLY,
      ...rows.map(r => COLS.map(c => {
        const v = r[c]
        if (v === null || v === undefined) return ''
        if (typeof v === 'boolean') return v ? 'SI' : 'NO'
        return v
      }))
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    ws['!cols'] = [8,30,28,30,10,18,18,14,16,8,10,8,8,14,12,12,12,12,30].map(w => ({ wch: w }))

    XLSX.utils.book_append_sheet(wb, ws, 'Lugares')
    XLSX.writeFile(wb, `lugares_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    const payload = {
      nombre:            form.nombre.trim(),
      nombre_oficial:    form.nombre_oficial?.trim()    || null,
      nombre_anterior:   form.nombre_anterior?.trim()   || null,
      direccion:         dirQuery?.trim()               || null,
      lat:               form.lat  ?? null,
      lng:               form.lng  ?? null,
      supervisor_id:     form.supervisor_id  ? parseInt(form.supervisor_id)  : null,
      cliente_id:        form.cliente_id     ? parseInt(form.cliente_id)     : null,
      responsable_id:    form.responsable_id ? parseInt(form.responsable_id) : null,
      estado:            form.estado,
      dias_atencion:     form.dias_atencion,
      horario_apertura:  form.horario_apertura || null,
      horario_cierre:    form.horario_cierre   || null,
      observaciones:     form.observaciones?.trim()     || null,
      dia_reparto:       form.dia_reparto               || null,
      metros_cuadrados:  num(form.metros_cuadrados),
      cantidad_empleados:num(form.cantidad_empleados),
      cantidad_banos:    num(form.cantidad_banos),
      cantidad_pisos:    num(form.cantidad_pisos),
      acceso_publico:    form.acceso_publico,
      tiene_cocina:      form.tiene_cocina,
      frecuencia_limpieza: num(form.frecuencia_limpieza),
      personal_limpieza:   num(form.personal_limpieza),
      updated_at: new Date().toISOString(),
    }
    const { error: err } = form.id
      ? await supabase.from('lugares').update(payload).eq('id', form.id)
      : await supabase.from('lugares').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setModalOpen(false); fetchAll(); setSaving(false)
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="ml-1 text-slate-300">↕</span>
    return <span className="ml-1 text-emerald-600">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const mapsUrl = (row) => {
    if (row.lat && row.lng) return `https://www.google.com/maps?q=${row.lat},${row.lng}`
    if (row.direccion) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.direccion)}`
    return null
  }

  const activos   = rows.filter(r => r.estado === 'activo').length
  const inactivos = rows.filter(r => r.estado === 'inactivo').length
  const clienteName = (id) => clientes.find(c => String(c.id) === String(id))?.nombre || '—'

  const inp  = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500'
  const chk  = 'w-4 h-4 accent-emerald-600 cursor-pointer'

  return (
    <div>
      {/* Hidden div required by Google Places API */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lugares</h1>
          <p className="text-sm text-slate-500 mt-0.5">{activos} activos · {inactivos} inactivos · {rows.length} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarLugares}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors">
            <Download size={16} /> Exportar
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> Nuevo lugar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, dirección, contacto..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="revisar">Revisar</option>
          </select>
          {clientes.length > 0 && (
            <select value={clienteFilter} onChange={e => setClienteFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="todos">Todos los clientes</option>
              <option value="">Sin cliente</option>
              {clientes.map(cl => (
                <option key={cl.id} value={cl.id}>{cl.nombre}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {search || estadoFilter !== 'todos' ? 'No hay resultados' : 'No hay lugares cargados aún'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide w-12 cursor-pointer select-none hover:text-emerald-600 text-slate-500 transition-colors"
                    onClick={() => toggleSort('id_numerico')}>
                    #<SortIcon field="id_numerico"/>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide cursor-pointer select-none hover:text-emerald-600 text-slate-500 transition-colors"
                    onClick={() => toggleSort('nombre')}>
                    Nombre<SortIcon field="nombre"/>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Responsable</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(row => {
                  const url = mapsUrl(row)
                  return (
                    <tr key={row.id} onClick={() => openEdit(row)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono w-12 text-center">
                        {row.id_numerico ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800">{row.nombre}</span>
                          {row.cliente_id && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-medium shrink-0">
                              {clienteName(row.cliente_id)}
                            </span>
                          )}
                        </div>
                        {row.nombre_anterior && (
                          <div className="text-xs text-slate-400 mt-0.5">ant. <span className="text-slate-500">{row.nombre_anterior}</span></div>
                        )}
                        {row.direccion && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <MapPin size={10} />
                            <span className="truncate max-w-xs">{row.direccion}</span>
                            {url && (
                              <a href={url} target="_blank" rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-emerald-500 hover:text-emerald-700 shrink-0">
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {(() => { const p = personal.find(x => x.id === row.responsable_id); return p ? <span className="text-sm text-slate-700">{p.apellido}, {p.nombre}</span> : <span className="text-slate-300 text-xs">—</span> })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[row.estado]}`}>
                          {row.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-6"></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={form.id ? 'Editar lugar' : 'Nuevo lugar'} size="lg">
        <div className="space-y-4">

          {/* Identificación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {form.id_numerico && (
              <div className="sm:col-span-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">ID de lugar:</span>
                <span className="font-mono text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">#{form.id_numerico}</span>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre interno *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre oficial</label>
              <input value={form.nombre_oficial ?? ''} onChange={e => setForm(f => ({ ...f, nombre_oficial: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre anterior</label>
              <input value={form.nombre_anterior ?? ''} onChange={e => setForm(f => ({ ...f, nombre_anterior: e.target.value }))}
                placeholder="Nombre previo si cambió" className={inp} />
            </div>

            {/* Dirección con Google Places */}
            <div className="sm:col-span-2 relative" ref={sugRef}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Dirección
                {form.lat && form.lng && (
                  <span className="ml-2 text-emerald-600 text-xs font-normal">· coordenadas guardadas ✓</span>
                )}
              </label>
              <div className="relative">
                <input
                  value={dirQuery}
                  onChange={e => { setDirQuery(e.target.value); setForm(f => ({ ...f, lat: null, lng: null })); setShowSugg(true) }}
                  placeholder="Escribí para buscar dirección..."
                  className={inp} autoComplete="off"
                />
                {geoLoading && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 overflow-hidden">
                  {suggestions.map((s, i) => {
                    const lbl = buildSuggestionLabel(s)
                    return (
                      <button key={i} type="button" onMouseDown={() => selectSuggestion(s)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 border-b border-slate-100 last:border-0">
                        <div className="font-medium text-slate-800 truncate">{lbl.main}</div>
                        {lbl.sub && <div className="text-xs text-slate-400 truncate">{lbl.sub}</div>}
                      </button>
                    )
                  })}
                </div>
              )}
              {form.lat && form.lng && (
                <a href={`https://www.google.com/maps?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600 hover:text-emerald-800">
                  <MapPin size={11} /> Ver en Maps
                </a>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Supervisor</label>
              <select value={form.supervisor_id ?? ''} onChange={e => setForm(f => ({ ...f, supervisor_id: e.target.value }))}
                className={inp + ' bg-white'}>
                <option value="">Sin supervisor</option>
                {supervisores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
              <select value={form.cliente_id ?? ''} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                className={inp + ' bg-white'}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsable operativo</label>
              <PersonalPicker
                personal={personal}
                value={form.responsable_id ? parseInt(form.responsable_id) : null}
                search={persSearch}
                onSearch={setPersSearch}
                onChange={id => { setForm(f => ({ ...f, responsable_id: id ?? '' })); setPersSearch('') }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className={inp + ' bg-white'}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="revisar">Revisar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Día de reparto</label>
              <select value={form.dia_reparto ?? ''} onChange={e => setForm(f => ({ ...f, dia_reparto: e.target.value }))}
                className={inp + ' bg-white'}>
                <option value="">Sin asignar</option>
                {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Horario apertura</label>
              <input type="time" value={form.horario_apertura} onChange={e => setForm(f => ({ ...f, horario_apertura: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Horario cierre</label>
              <input type="time" value={form.horario_cierre} onChange={e => setForm(f => ({ ...f, horario_cierre: e.target.value }))} className={inp} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Días de atención</label>
            <div className="flex flex-wrap gap-2">
              {DIAS.map(dia => (
                <button key={dia} type="button" onClick={() => toggleDia(dia)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    form.dias_atencion.includes(dia)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {dia.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones ?? ''} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              rows={2} className={inp + ' resize-none'} />
          </div>

          {/* ── Características del lugar (colapsable) ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button type="button"
              onClick={() => setCaract(c => !c)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Building2 size={15} className="text-slate-400" />
                Características del lugar
              </div>
              {caract ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
            </button>

            {caract && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">M²</label>
                  <input type="number" min="0" value={form.metros_cuadrados ?? ''}
                    onChange={e => setForm(f => ({ ...f, metros_cuadrados: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Empleados</label>
                  <input type="number" min="0" value={form.cantidad_empleados ?? ''}
                    onChange={e => setForm(f => ({ ...f, cantidad_empleados: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Baños</label>
                  <input type="number" min="0" value={form.cantidad_banos ?? ''}
                    onChange={e => setForm(f => ({ ...f, cantidad_banos: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Pisos</label>
                  <input type="number" min="0" value={form.cantidad_pisos ?? ''}
                    onChange={e => setForm(f => ({ ...f, cantidad_pisos: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Limpieza (días/sem)</label>
                  <input type="number" min="0" max="7" value={form.frecuencia_limpieza ?? ''}
                    onChange={e => setForm(f => ({ ...f, frecuencia_limpieza: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Personal limpieza</label>
                  <input type="number" min="0" value={form.personal_limpieza ?? ''}
                    onChange={e => setForm(f => ({ ...f, personal_limpieza: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>

                <div className="col-span-2 flex gap-6 items-center mt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                    <input type="checkbox" className={chk} checked={form.acceso_publico}
                      onChange={e => setForm(f => ({ ...f, acceso_publico: e.target.checked }))} />
                    Acceso al público
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                    <input type="checkbox" className={chk} checked={form.tiene_cocina}
                      onChange={e => setForm(f => ({ ...f, tiene_cocina: e.target.checked }))} />
                    Tiene cocina
                  </label>
                </div>
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors">
              <Check size={15} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
