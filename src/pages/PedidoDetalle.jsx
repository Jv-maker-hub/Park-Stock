import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ArrowLeft, Plus, Trash2, Check, ChevronDown, ChevronUp,
  Package, MapPin, Truck, CheckCircle, Save, AlertCircle
} from 'lucide-react'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function mesLabel(d) {
  const dt = new Date(d + 'T12:00:00')
  return `${MESES[dt.getMonth()]} ${dt.getFullYear()}`
}

const ESTADO_NEXT = { borrador: 'confirmado', confirmado: 'en_reparto', en_reparto: 'completado' }
const ESTADO_BTN  = { borrador: 'Confirmar pedido', confirmado: 'Iniciar reparto', en_reparto: 'Marcar completado' }
const ESTADO_COLOR = {
  borrador:   'bg-slate-100 text-slate-600',
  confirmado: 'bg-blue-100 text-blue-700',
  en_reparto: 'bg-amber-100 text-amber-700',
  completado: 'bg-emerald-100 text-emerald-700',
}

export default function PedidoDetalle() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { profile } = useAuth()

  const [pedido,    setPedido]    = useState(null)
  const [detalle,   setDetalle]   = useState([])
  const [lugares,   setLugares]   = useState([])
  const [productos, setProductos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  // Para agregar línea
  const [addOpen,    setAddOpen]   = useState(false)
  const [addLugar,   setAddLugar]  = useState('')
  const [addProd,    setAddProd]   = useState('')
  const [addCant,    setAddCant]   = useState('')
  const [addSearch,  setAddSearch] = useState('')

  // Para expandir lugar en modo reparto
  const [expandido,  setExpandido] = useState({})

  const isAdmin   = ['admin','compras'].includes(profile?.rol)
  const isRep     = profile?.rol === 'repartidor'
  const canEdit   = isAdmin && pedido?.estado === 'borrador'
  const canReparto = (isAdmin || isRep) && pedido?.estado === 'en_reparto'

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [pedRes, detRes, lugRes, prodRes] = await Promise.all([
      supabase.from('pedidos').select('*, clientes(nombre)').eq('id', id).single(),
      supabase.from('pedido_detalle').select('*, lugares(nombre, id_numerico), productos(nombre, unidad)').eq('pedido_id', id).order('lugares(nombre)'),
      supabase.from('lugares').select('id, nombre, id_numerico').eq('estado', 'activo').order('nombre'),
      supabase.from('productos').select('id, nombre, unidad').eq('activo', true).order('nombre'),
    ])
    setPedido(pedRes.data)
    setDetalle(detRes.data || [])
    setLugares(lugRes.data || [])
    setProductos(prodRes.data || [])
    setLoading(false)
  }

  async function avanzarEstado() {
    const next = ESTADO_NEXT[pedido.estado]
    if (!next) return
    setSaving(true)
    await supabase.from('pedidos').update({ estado: next, updated_at: new Date().toISOString() }).eq('id', id)
    setPedido(p => ({ ...p, estado: next }))
    setSaving(false)
  }

  async function agregarLinea() {
    if (!addLugar || !addProd || !addCant) return
    const { data } = await supabase.from('pedido_detalle')
      .insert({ pedido_id: parseInt(id), lugar_id: parseInt(addLugar), producto_id: parseInt(addProd), cantidad_planificada: parseFloat(addCant) })
      .select('*, lugares(nombre, id_numerico), productos(nombre, unidad)')
      .single()
    if (data) setDetalle(d => [...d, data])
    setAddLugar(''); setAddProd(''); setAddCant(''); setAddOpen(false)
  }

  async function eliminarLinea(lineaId) {
    if (!confirm('¿Eliminar esta línea?')) return
    await supabase.from('pedido_detalle').delete().eq('id', lineaId)
    setDetalle(d => d.filter(x => x.id !== lineaId))
  }

  async function confirmarEntrega(linea, cantEntregada) {
    const cant = parseFloat(cantEntregada)
    await supabase.from('pedido_detalle').update({
      cantidad_entregada: cant,
      entregado: true,
      repartidor_id: profile.id,
      fecha_entrega: new Date().toISOString(),
    }).eq('id', linea.id)
    setDetalle(d => d.map(x => x.id === linea.id
      ? { ...x, entregado: true, cantidad_entregada: cant, repartidor_id: profile.id }
      : x
    ))
  }

  // Agrupado por lugar
  const porLugar = useMemo(() => {
    const map = {}
    detalle.forEach(d => {
      const lid = d.lugar_id
      if (!map[lid]) map[lid] = { lugar: d.lugares, lineas: [] }
      map[lid].lineas.push(d)
    })
    return Object.values(map).sort((a, b) => (a.lugar?.nombre || '').localeCompare(b.lugar?.nombre || '', 'es'))
  }, [detalle])

  const lugaresFiltrados = lugares.filter(l =>
    !addSearch || l.nombre.toLowerCase().includes(addSearch.toLowerCase())
  )

  const totalLineas    = detalle.length
  const entregadas     = detalle.filter(d => d.entregado).length
  const pctEntregado   = totalLineas > 0 ? Math.round((entregadas / totalLineas) * 100) : 0

  if (loading) return <div className="p-6 text-slate-400 text-sm">Cargando...</div>
  if (!pedido) return <div className="p-6 text-red-500 text-sm">Pedido no encontrado</div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/pedidos')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-0.5">
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">{mesLabel(pedido.mes)}</h1>
            {pedido.clientes?.nombre && (
              <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded font-medium">{pedido.clientes.nombre}</span>
            )}
            <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${ESTADO_COLOR[pedido.estado]}`}>
              {pedido.estado.replace('_', ' ')}
            </span>
          </div>
          {totalLineas > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              {entregadas}/{totalLineas} líneas entregadas · {pctEntregado}%
            </p>
          )}
        </div>
        {isAdmin && ESTADO_NEXT[pedido.estado] && (
          <button onClick={avanzarEstado} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0">
            <CheckCircle size={14} /> {ESTADO_BTN[pedido.estado]}
          </button>
        )}
      </div>

      {/* Barra de progreso (en reparto o completado) */}
      {['en_reparto','completado'].includes(pedido.estado) && totalLineas > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Progreso de entregas</span>
            <span>{entregadas} de {totalLineas}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${pctEntregado}%` }} />
          </div>
        </div>
      )}

      {/* Agregar línea (solo en borrador) */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-slate-200">
          <button onClick={() => setAddOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
            <span className="flex items-center gap-2"><Plus size={15} className="text-emerald-600" /> Agregar línea</span>
            {addOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </button>
          {addOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Buscar lugar</label>
                <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  placeholder="Escribí para filtrar..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2" />
                <select value={addLugar} onChange={e => setAddLugar(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">— Seleccionar lugar —</option>
                  {lugaresFiltrados.map(l => <option key={l.id} value={l.id}>{l.id_numerico ? `#${l.id_numerico} ` : ''}{l.nombre}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <select value={addProd} onChange={e => setAddProd(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">— Producto —</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <input type="number" min="0" step="1" value={addCant} onChange={e => setAddCant(e.target.value)}
                  placeholder="Cant."
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center" />
                <button onClick={agregarLinea}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors">
                  <Check size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista agrupada por lugar */}
      {porLugar.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Package size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">No hay líneas cargadas</p>
          {canEdit && <p className="text-slate-300 text-xs mt-1">Usá "Agregar línea" para cargar productos por lugar</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {porLugar.map(({ lugar, lineas }) => {
            const lid = lugar?.id || 'sin-lugar'
            const open = expandido[lid] !== false  // expandido por defecto
            const todasEntregadas = lineas.every(l => l.entregado)
            return (
              <div key={lid} className={`bg-white rounded-xl border transition-colors ${todasEntregadas ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                <button
                  onClick={() => setExpandido(e => ({ ...e, [lid]: !open }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <MapPin size={15} className={todasEntregadas ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800 text-sm">
                      {lugar?.id_numerico ? <span className="text-slate-400 text-xs mr-1">#{lugar.id_numerico}</span> : null}
                      {lugar?.nombre || 'Lugar sin nombre'}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{lineas.length} producto{lineas.length !== 1 ? 's' : ''}</span>
                  </div>
                  {todasEntregadas && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle size={12} /> Entregado</span>}
                  {open ? <ChevronUp size={14} className="text-slate-300 shrink-0" /> : <ChevronDown size={14} className="text-slate-300 shrink-0" />}
                </button>

                {open && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {lineas.map(linea => (
                      <LineaRow
                        key={linea.id}
                        linea={linea}
                        canEdit={canEdit}
                        canReparto={canReparto}
                        onEliminar={() => eliminarLinea(linea.id)}
                        onConfirmar={(cant) => confirmarEntrega(linea, cant)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LineaRow({ linea, canEdit, canReparto, onEliminar, onConfirmar }) {
  const [cantInput, setCantInput] = useState(String(linea.cantidad_planificada ?? ''))
  const [guardando, setGuardando] = useState(false)

  async function handleConfirmar() {
    setGuardando(true)
    await onConfirmar(cantInput || linea.cantidad_planificada)
    setGuardando(false)
  }

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${linea.entregado ? 'opacity-70' : ''}`}>
      <Package size={14} className="text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-700">{linea.productos?.nombre}</span>
        <span className="text-xs text-slate-400 ml-1">({linea.productos?.unidad})</span>
      </div>

      {/* Vista borrador: cantidad planificada */}
      {canEdit && !linea.entregado && (
        <span className="text-sm font-mono text-slate-600 w-12 text-right">{linea.cantidad_planificada}</span>
      )}

      {/* Vista reparto: input de cantidad entregada */}
      {canReparto && !linea.entregado && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Plan: {linea.cantidad_planificada}</span>
          <input
            type="number" min="0" step="1"
            value={cantInput}
            onChange={e => setCantInput(e.target.value)}
            className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
          />
          <button onClick={handleConfirmar} disabled={guardando}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
            <Truck size={12} /> {guardando ? '...' : 'Entregué'}
          </button>
        </div>
      )}

      {/* Entregado */}
      {linea.entregado && (
        <div className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle size={14} />
          <span className="text-sm font-medium">{linea.cantidad_entregada}</span>
          {linea.cantidad_entregada < linea.cantidad_planificada && (
            <span className="text-xs text-amber-500 flex items-center gap-0.5">
              <AlertCircle size={11} /> (plan: {linea.cantidad_planificada})
            </span>
          )}
        </div>
      )}

      {/* Vista lectura (confirmado, no reparto) */}
      {!canEdit && !canReparto && !linea.entregado && (
        <span className="text-sm font-mono text-slate-600">{linea.cantidad_planificada}</span>
      )}

      {canEdit && (
        <button onClick={onEliminar}
          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
