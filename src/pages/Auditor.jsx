import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardList, Plus, ChevronRight, CheckCircle2, Circle,
  AlertTriangle, TrendingDown, TrendingUp, Minus, Search,
  Lock, RefreshCw, Shuffle, PackageCheck, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const fmt = (n) => n == null ? '—' : parseFloat(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

function DiffBadge({ sistema, contada }) {
  if (contada == null) return <span className="text-slate-300 text-xs">Pendiente</span>
  const diff = parseFloat(contada) - parseFloat(sistema)
  if (diff === 0) return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
      <Minus size={11} /> Sin diferencia
    </span>
  )
  if (diff > 0) return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
      <TrendingUp size={11} /> +{fmt(diff)}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
      <TrendingDown size={11} /> {fmt(diff)}
    </span>
  )
}

function ProgBar({ value, total, color = 'bg-emerald-500' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-10 text-right">{value}/{total}</span>
    </div>
  )
}

// ─── Modal nuevo arqueo ───────────────────────────────────────────────────────
function NuevoArqueoModal({ open, onClose, onCrear, productos }) {
  const [tipo, setTipo] = useState('completo')
  const [cantParcial, setCantParcial] = useState(10)
  const [obs, setObs] = useState('')
  const [creating, setCreating] = useState(false)

  const productosActivos = productos.filter(p => p.activo)

  async function handleCrear() {
    setCreating(true)
    let seleccion = productosActivos
    if (tipo === 'parcial') {
      const n = Math.min(parseInt(cantParcial) || 10, productosActivos.length)
      seleccion = [...productosActivos].sort(() => Math.random() - 0.5).slice(0, n)
    }
    await onCrear({ tipo, obs, seleccion })
    setCreating(false)
    onClose()
    setObs(''); setTipo('completo'); setCantParcial(10)
  }

  const inp = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500'

  return (
    <Modal open={open} onClose={onClose} title="Nuevo arqueo" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Tipo de arqueo</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTipo('completo')}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${tipo === 'completo' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                <PackageCheck size={15} className={tipo === 'completo' ? 'text-violet-600' : 'text-slate-400'} />
                <span className="text-sm font-medium text-slate-800">Completo</span>
              </div>
              <p className="text-xs text-slate-500">Todos los {productosActivos.length} productos activos</p>
            </button>
            <button
              onClick={() => setTipo('parcial')}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${tipo === 'parcial' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Shuffle size={15} className={tipo === 'parcial' ? 'text-violet-600' : 'text-slate-400'} />
                <span className="text-sm font-medium text-slate-800">Parcial</span>
              </div>
              <p className="text-xs text-slate-500">Selección aleatoria de N productos</p>
            </button>
          </div>
        </div>

        {tipo === 'parcial' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cantidad de productos a auditar
            </label>
            <input
              type="number" min="1" max={productosActivos.length} value={cantParcial}
              onChange={e => setCantParcial(e.target.value)}
              className={inp} />
            <p className="text-xs text-slate-400 mt-1">
              Se elegirán {Math.min(parseInt(cantParcial)||0, productosActivos.length)} productos al azar
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones (opcional)</label>
          <input value={obs} onChange={e => setObs(e.target.value)}
            placeholder="ej: arqueo semanal, post-entrega..." className={inp} />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleCrear} disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={15} />
            {creating ? 'Iniciando...' : 'Iniciar arqueo'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Vista de un arqueo activo ────────────────────────────────────────────────
function ArqueoActivo({ arqueo, lineas, onActualizar, onCerrar, profile }) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [editObs, setEditObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('todos') // todos | pendientes | contados | diferencias

  const contadas = lineas.filter(l => l.cantidad_contada != null)
  const pendientes = lineas.filter(l => l.cantidad_contada == null)
  const conDiferencia = contadas.filter(l => parseFloat(l.cantidad_contada) !== parseFloat(l.cantidad_sistema))
  const sinDiferencia = contadas.filter(l => parseFloat(l.cantidad_contada) === parseFloat(l.cantidad_sistema))

  const lineasFiltradas = lineas.filter(l => {
    const matchSearch = !search.trim() ||
      l.producto_nombre.toLowerCase().includes(search.toLowerCase())
    const matchFiltro =
      filtro === 'todos' ? true :
      filtro === 'pendientes' ? l.cantidad_contada == null :
      filtro === 'contados' ? l.cantidad_contada != null :
      filtro === 'diferencias' ? (l.cantidad_contada != null && parseFloat(l.cantidad_contada) !== parseFloat(l.cantidad_sistema)) :
      true
    return matchSearch && matchFiltro
  })

  function startEdit(l) {
    setEditingId(l.id)
    setEditVal(l.cantidad_contada != null ? String(l.cantidad_contada) : '')
    setEditObs(l.observaciones || '')
  }

  async function saveEdit(l) {
    if (editVal.trim() === '') { setEditingId(null); return }
    setSaving(true)
    const cantidad = parseFloat(editVal)
    if (isNaN(cantidad)) { setSaving(false); return }
    await supabase.from('stock_arqueo_linea').update({
      cantidad_contada: cantidad,
      observaciones: editObs.trim() || null,
      contado_en: new Date().toISOString(),
      contado_por: profile?.id || null,
    }).eq('id', l.id)
    setEditingId(null)
    onActualizar()
    setSaving(false)
  }

  async function clearLinea(l) {
    await supabase.from('stock_arqueo_linea').update({
      cantidad_contada: null,
      observaciones: null,
      contado_en: null,
      contado_por: null,
    }).eq('id', l.id)
    onActualizar()
  }

  const pct = lineas.length > 0 ? Math.round((contadas.length / lineas.length) * 100) : 0
  const tabs = [
    { k: 'todos',       label: 'Todos',         n: lineas.length },
    { k: 'pendientes',  label: 'Pendientes',     n: pendientes.length },
    { k: 'contados',    label: 'Contados',       n: contadas.length },
    { k: 'diferencias', label: 'Con diferencia', n: conDiferencia.length },
  ]

  return (
    <div>
      {/* Progreso */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold text-slate-800">
              Arqueo {arqueo.tipo} — en progreso
            </span>
            <span className="ml-2 text-xs text-slate-400">{fmtDate(arqueo.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${pct === 100 ? 'text-emerald-600' : 'text-violet-600'}`}>
              {pct}%
            </span>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> {contadas.length} contados</span>
            <span className="flex items-center gap-1"><Circle size={12} className="text-slate-300" /> {pendientes.length} pendientes</span>
            {conDiferencia.length > 0 && (
              <span className="flex items-center gap-1"><AlertTriangle size={12} className="text-amber-500" /> {conDiferencia.length} diferencias</span>
            )}
          </div>
          {pct === 100 && (
            <button onClick={onCerrar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors">
              <Lock size={12} /> Cerrar arqueo
            </button>
          )}
        </div>
        {arqueo.observaciones && (
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-50 pt-2">📝 {arqueo.observaciones}</p>
        )}
      </div>

      {/* Filtros + búsqueda */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {tabs.map(t => (
              <button key={t.k} onClick={() => setFiltro(t.k)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filtro === t.k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
                {t.n > 0 && <span className="ml-1 text-slate-400">({t.n})</span>}
              </button>
            ))}
          </div>
        </div>

        {lineasFiltradas.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Sin resultados</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {lineasFiltradas.map(l => {
              const editing = editingId === l.id
              const contada = l.cantidad_contada != null
              const diff = contada ? parseFloat(l.cantidad_contada) - parseFloat(l.cantidad_sistema) : null

              return (
                <div key={l.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    editing ? 'bg-violet-50' : contada ? (diff !== 0 ? 'bg-amber-50/40' : 'bg-emerald-50/20') : 'hover:bg-slate-50'
                  }`}>

                  {/* Status icon */}
                  <div className="shrink-0">
                    {!contada
                      ? <Circle size={18} className="text-slate-200" />
                      : diff === 0
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : <AlertTriangle size={18} className="text-amber-500" />
                    }
                  </div>

                  {/* Producto info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{l.producto_nombre}</div>
                    <div className="text-xs text-slate-400">
                      Sistema: <span className="font-medium text-slate-600">{fmt(l.cantidad_sistema)}</span>
                      {l.producto_unidad && ` ${l.producto_unidad}`}
                      {contada && (
                        <>
                          {' · '}Contado: <span className="font-medium text-slate-600">{fmt(l.cantidad_contada)}</span>
                          {' · '}<DiffBadge sistema={l.cantidad_sistema} contada={l.cantidad_contada} />
                        </>
                      )}
                    </div>
                    {l.observaciones && !editing && (
                      <div className="text-xs text-slate-400 mt-0.5 italic">"{l.observaciones}"</div>
                    )}
                  </div>

                  {/* Edición inline */}
                  {editing ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number" step="0.01" min="0"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(l); if (e.key === 'Escape') setEditingId(null) }}
                        placeholder="Cantidad"
                        autoFocus
                        className="w-24 px-2 py-1 text-sm border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      <input
                        value={editObs}
                        onChange={e => setEditObs(e.target.value)}
                        placeholder="Obs. (opcional)"
                        className="w-32 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 hidden sm:block" />
                      <button onClick={() => saveEdit(l)} disabled={saving}
                        className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                        OK
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(l)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          contada
                            ? 'text-slate-500 hover:bg-slate-100'
                            : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                        }`}>
                        {contada ? 'Editar' : 'Contar'}
                      </button>
                      {contada && (
                        <button onClick={() => clearLinea(l)}
                          className="p-1.5 text-slate-300 hover:text-red-400 transition-colors" title="Borrar conteo">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detalle de arqueo cerrado ────────────────────────────────────────────────
function ArqueoDetalle({ arqueo, lineas, onBack, onAjustar }) {
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [ajustando, setAjustando] = useState(false)

  const conDif = lineas.filter(l => l.cantidad_contada != null && parseFloat(l.cantidad_contada) !== parseFloat(l.cantidad_sistema))
  const sinDif = lineas.filter(l => l.cantidad_contada != null && parseFloat(l.cantidad_contada) === parseFloat(l.cantidad_sistema))

  const filtradas = lineas.filter(l => {
    const ms = !search.trim() || l.producto_nombre.toLowerCase().includes(search.toLowerCase())
    const mf =
      filtro === 'todos' ? true :
      filtro === 'diferencias' ? (l.cantidad_contada != null && parseFloat(l.cantidad_contada) !== parseFloat(l.cantidad_sistema)) :
      filtro === 'ok' ? (l.cantidad_contada != null && parseFloat(l.cantidad_contada) === parseFloat(l.cantidad_sistema)) :
      true
    return ms && mf
  })

  async function handleAjustar() {
    if (!window.confirm(`¿Ajustar el stock con los valores contados?\nEsto actualiza ${conDif.length} productos en la tabla de stock.\nEsta acción no se puede deshacer.`)) return
    setAjustando(true)
    await onAjustar(arqueo, lineas)
    setAjustando(false)
  }

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        ← Volver a arqueos
      </button>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Productos', val: lineas.length, color: 'text-slate-800' },
          { label: 'Sin diferencia', val: sinDif.length, color: 'text-emerald-600' },
          { label: 'Con diferencia', val: conDif.length, color: 'text-amber-600' },
          { label: 'Ajuste aplicado', val: arqueo.ajuste_aplicado ? 'Sí' : 'No', color: arqueo.ajuste_aplicado ? 'text-emerald-600' : 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Ajustar stock */}
      {conDif.length > 0 && !arqueo.ajuste_aplicado && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {conDif.length} diferencias encontradas
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Podés ajustar el stock del depósito con los valores reales contados.
            </p>
          </div>
          <button onClick={handleAjustar} disabled={ajustando}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
            <RefreshCw size={14} /> {ajustando ? 'Ajustando...' : 'Ajustar stock'}
          </button>
        </div>
      )}
      {arqueo.ajuste_aplicado && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> Ajuste de stock aplicado · {fmtDate(arqueo.cerrado_at)}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {[
              { k: 'todos', label: `Todos (${lineas.length})` },
              { k: 'diferencias', label: `Diferencias (${conDif.length})` },
              { k: 'ok', label: `OK (${sinDif.length})` },
            ].map(t => (
              <button key={t.k} onClick={() => setFiltro(t.k)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filtro === t.k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Producto</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Sistema</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Contado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Diferencia</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtradas.map(l => {
                const diff = l.cantidad_contada != null
                  ? parseFloat(l.cantidad_contada) - parseFloat(l.cantidad_sistema)
                  : null
                return (
                  <tr key={l.id} className={`transition-colors ${diff !== null && diff !== 0 ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{l.producto_nombre}</div>
                      <div className="text-xs text-slate-400">{l.producto_unidad}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(l.cantidad_sistema)}</td>
                    <td className="px-4 py-3 text-right text-slate-800 font-medium">
                      {l.cantidad_contada != null ? fmt(l.cantidad_contada) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DiffBadge sistema={l.cantidad_sistema} contada={l.cantidad_contada} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">
                      {l.observaciones || ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Auditor() {
  const { profile } = useAuth()
  const [arqueos, setArqueos] = useState([])
  const [lineas, setLineas] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [vistaArqueo, setVistaArqueo] = useState(null) // arqueo seleccionado para ver detalle

  const arqueoActivo = arqueos.find(a => a.estado === 'en_progreso')
  const arqueosCerrados = arqueos.filter(a => a.estado === 'cerrado')
  const lineasActivas = lineas.filter(l => l.arqueo_id === arqueoActivo?.id)
  const lineasVista = lineas.filter(l => l.arqueo_id === vistaArqueo?.id)

  const fetchArqueos = useCallback(async () => {
    const { data } = await supabase
      .from('stock_arqueo')
      .select('*')
      .order('created_at', { ascending: false })
    setArqueos(data ?? [])
  }, [])

  const fetchLineas = useCallback(async (arqueoId) => {
    const { data } = await supabase
      .from('stock_arqueo_linea')
      .select('*')
      .eq('arqueo_id', arqueoId)
      .order('producto_nombre')
    setLineas(prev => {
      const otras = prev.filter(l => l.arqueo_id !== arqueoId)
      return [...otras, ...(data ?? [])]
    })
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const [arqRes, prodRes] = await Promise.all([
        supabase.from('stock_arqueo').select('*').order('created_at', { ascending: false }),
        supabase.from('productos').select('id, nombre, unidad, unidad_entrega, activo, stock_minimo').order('nombre'),
      ])
      const arqs = arqRes.data ?? []
      setArqueos(arqs)
      setProductos(prodRes.data ?? [])
      // Cargar líneas del arqueo activo si hay uno
      const activo = arqs.find(a => a.estado === 'en_progreso')
      if (activo) {
        const { data } = await supabase
          .from('stock_arqueo_linea').select('*').eq('arqueo_id', activo.id).order('producto_nombre')
        setLineas(data ?? [])
      }
      setLoading(false)
    }
    init()
  }, [])

  async function handleCrearArqueo({ tipo, obs, seleccion }) {
    // Traer stock actual
    const { data: stockData } = await supabase.from('stock').select('producto_id, cantidad')
    const stockMap = {}
    stockData?.forEach(s => { stockMap[s.producto_id] = s.cantidad })

    // Crear arqueo
    const { data: arq } = await supabase.from('stock_arqueo').insert({
      tipo,
      estado: 'en_progreso',
      auditor_id: profile?.id || null,
      observaciones: obs || null,
      productos_total: seleccion.length,
    }).select().single()
    if (!arq) return

    // Insertar líneas
    const lineasPayload = seleccion.map(p => ({
      arqueo_id: arq.id,
      producto_id: p.id,
      producto_nombre: p.nombre,
      producto_unidad: p.unidad_entrega || p.unidad,
      cantidad_sistema: stockMap[p.id] ?? 0,
    }))
    await supabase.from('stock_arqueo_linea').insert(lineasPayload)
    const { data: nuevasLineas } = await supabase
      .from('stock_arqueo_linea').select('*').eq('arqueo_id', arq.id).order('producto_nombre')
    setLineas(nuevasLineas ?? [])
    await fetchArqueos()
  }

  async function handleActualizarLineas() {
    if (arqueoActivo) await fetchLineas(arqueoActivo.id)
    await fetchArqueos()
  }

  async function handleCerrar() {
    if (!arqueoActivo) return
    const lineasArqueo = lineas.filter(l => l.arqueo_id === arqueoActivo.id)
    const conDif = lineasArqueo.filter(l =>
      l.cantidad_contada != null &&
      parseFloat(l.cantidad_contada) !== parseFloat(l.cantidad_sistema)
    ).length
    await supabase.from('stock_arqueo').update({
      estado: 'cerrado',
      cerrado_at: new Date().toISOString(),
      productos_contados: lineasArqueo.filter(l => l.cantidad_contada != null).length,
      diferencias_count: conDif,
    }).eq('id', arqueoActivo.id)
    await fetchArqueos()
  }

  async function handleAjustar(arqueo, lineasArqueo) {
    const conDif = lineasArqueo.filter(l =>
      l.cantidad_contada != null &&
      parseFloat(l.cantidad_contada) !== parseFloat(l.cantidad_sistema)
    )
    for (const l of conDif) {
      await supabase.from('stock')
        .upsert({ producto_id: l.producto_id, cantidad: l.cantidad_contada }, { onConflict: 'producto_id' })
    }
    await supabase.from('stock_arqueo').update({ ajuste_aplicado: true }).eq('id', arqueo.id)
    await fetchArqueos()
    if (vistaArqueo?.id === arqueo.id) {
      setVistaArqueo(prev => ({ ...prev, ajuste_aplicado: true }))
    }
  }

  async function openDetalle(arq) {
    setVistaArqueo(arq)
    const lineasYa = lineas.filter(l => l.arqueo_id === arq.id)
    if (lineasYa.length === 0) {
      const { data } = await supabase
        .from('stock_arqueo_linea').select('*').eq('arqueo_id', arq.id).order('producto_nombre')
      setLineas(prev => [...prev, ...(data ?? [])])
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Vista detalle de un arqueo cerrado
  if (vistaArqueo) return (
    <ArqueoDetalle
      arqueo={vistaArqueo}
      lineas={lineasVista}
      onBack={() => setVistaArqueo(null)}
      onAjustar={handleAjustar} />
  )

  // Vista arqueo activo
  if (arqueoActivo) return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Auditor de stock</h1>
          <p className="text-sm text-slate-500 mt-0.5">Arqueo en curso</p>
        </div>
      </div>
      <ArqueoActivo
        arqueo={arqueoActivo}
        lineas={lineasActivas}
        onActualizar={handleActualizarLineas}
        onCerrar={handleCerrar}
        profile={profile} />
    </div>
  )

  // Vista lista de arqueos
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Auditor de stock</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {arqueosCerrados.length} arqueo{arqueosCerrados.length !== 1 ? 's' : ''} realizados
          </p>
        </div>
        <button onClick={() => setModalNuevo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} /> Nuevo arqueo
        </button>
      </div>

      {arqueosCerrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="py-16 text-center">
            <ClipboardList size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Todavía no hay arqueos realizados</p>
            <p className="text-slate-300 text-xs mt-1">Iniciá el primer arqueo para establecer la línea base</p>
            <button onClick={() => setModalNuevo(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors mx-auto">
              <Plus size={15} /> Iniciar primer arqueo
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {arqueosCerrados.map(a => (
            <button key={a.id} onClick={() => openDetalle(a)}
              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 transition-colors text-left">
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <ClipboardList size={17} className="text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 capitalize">{a.tipo}</span>
                  {a.ajuste_aplicado && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Ajuste aplicado
                    </span>
                  )}
                  {a.diferencias_count > 0 && !a.ajuste_aplicado && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> {a.diferencias_count} dif.
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{fmtDate(a.created_at)}</div>
                <ProgBar value={a.productos_contados} total={a.productos_total} color="bg-violet-400" />
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <NuevoArqueoModal
        open={modalNuevo}
        onClose={() => setModalNuevo(false)}
        onCrear={handleCrearArqueo}
        productos={productos} />
    </div>
  )
}
