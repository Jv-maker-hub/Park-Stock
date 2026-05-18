import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ArrowLeft, Plus, Trash2, Check, ChevronDown, ChevronUp,
  Package, MapPin, Truck, CheckCircle, AlertCircle,
  ClipboardCheck, MessageSquare, Loader2, Box
} from 'lucide-react'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function mesLabel(d) {
  const dt = new Date(d + 'T12:00:00')
  return `${MESES[dt.getMonth()]} ${dt.getFullYear()}`
}

const ESTADO_NEXT  = { borrador:'confirmado', confirmado:'en_reparto', en_reparto:'completado' }
const ESTADO_COLOR = {
  borrador:   'bg-slate-100 text-slate-600',
  confirmado: 'bg-blue-100 text-blue-700',
  en_reparto: 'bg-amber-100 text-amber-700',
  completado: 'bg-emerald-100 text-emerald-700',
}

export default function PedidoDetalle() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [pedido,    setPedido]    = useState(null)
  const [detalle,   setDetalle]   = useState([])
  const [lugares,   setLugares]   = useState([])
  const [productos, setProductos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [expandido, setExpandido] = useState({})

  // agregar línea
  const [addOpen,   setAddOpen]   = useState(false)
  const [addLugar,  setAddLugar]  = useState('')
  const [addProd,   setAddProd]   = useState('')
  const [addCant,   setAddCant]   = useState('')
  const [addSearch, setAddSearch] = useState('')

  const isAdmin      = ['admin','compras'].includes(profile?.rol)
  const isPreparador = profile?.rol === 'preparador'
  const isRepartidor = profile?.rol === 'repartidor'

  const canEdit     = isAdmin && pedido?.estado === 'borrador'
  const canPreparar = (isAdmin || isPreparador) && pedido?.estado === 'confirmado'
  const canReparto  = (isAdmin || isRepartidor) && pedido?.estado === 'en_reparto'

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [pedRes, detRes, lugRes, prodRes] = await Promise.all([
      supabase.from('pedidos').select('*, clientes(nombre)').eq('id', id).single(),
      supabase.from('pedido_detalle')
        .select('*, lugares(nombre, id_numerico), productos(nombre, unidad)')
        .eq('pedido_id', id).order('lugares(nombre)'),
      supabase.from('lugares').select('id, nombre, id_numerico').eq('estado','activo').order('nombre'),
      supabase.from('productos').select('id, nombre, unidad').eq('activo',true).order('nombre'),
    ])
    setPedido(pedRes.data)
    setDetalle(detRes.data || [])
    setLugares(lugRes.data || [])
    setProductos(prodRes.data || [])
    setLoading(false)
  }

  // ── Avanzar estado ────────────────────────────────────────────
  const todoPreparado = detalle.length > 0 && detalle.every(d => d.preparado)

  async function avanzarEstado() {
    const next = ESTADO_NEXT[pedido.estado]
    if (!next) return
    if (pedido.estado === 'confirmado' && !todoPreparado) return
    setSaving(true)
    await supabase.from('pedidos').update({ estado: next, updated_at: new Date().toISOString() }).eq('id', id)
    setPedido(p => ({ ...p, estado: next }))
    setSaving(false)
  }

  // ── Preparador ────────────────────────────────────────────────
  async function prepararLinea(lineaId) {
    await supabase.from('pedido_detalle').update({
      preparado:     true,
      preparado_por: profile.id,
      preparado_at:  new Date().toISOString(),
    }).eq('id', lineaId)
    setDetalle(d => d.map(x => x.id === lineaId ? { ...x, preparado: true } : x))
  }

  async function prepararTodoLugar(lineas) {
    const ids = lineas.filter(l => !l.preparado).map(l => l.id)
    if (!ids.length) return
    await supabase.from('pedido_detalle').update({
      preparado:     true,
      preparado_por: profile.id,
      preparado_at:  new Date().toISOString(),
    }).in('id', ids)
    setDetalle(d => d.map(x => ids.includes(x.id) ? { ...x, preparado: true } : x))
  }

  // ── Repartidor ────────────────────────────────────────────────
  async function confirmarEntrega(linea, cantEntregada, comentario) {
    const cant = parseFloat(cantEntregada) || linea.cantidad_planificada
    await supabase.from('pedido_detalle').update({
      cantidad_entregada:    cant,
      entregado:             true,
      repartidor_id:         profile.id,
      fecha_entrega:         new Date().toISOString(),
      comentario_repartidor: comentario || null,
    }).eq('id', linea.id)
    setDetalle(d => d.map(x => x.id === linea.id
      ? { ...x, entregado: true, cantidad_entregada: cant, comentario_repartidor: comentario }
      : x
    ))
  }

  async function guardarComentarioLugar(lineas, comentario) {
    const ids = lineas.map(l => l.id)
    await supabase.from('pedido_detalle')
      .update({ comentario_repartidor: comentario })
      .in('id', ids)
    setDetalle(d => d.map(x => ids.includes(x.id) ? { ...x, comentario_repartidor: comentario } : x))
  }

  // ── Borrador ──────────────────────────────────────────────────
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

  // ── Agrupado por lugar ────────────────────────────────────────
  const porLugar = useMemo(() => {
    const map = {}
    detalle.forEach(d => {
      const lid = d.lugar_id
      if (!map[lid]) map[lid] = { lugar: d.lugares, lineas: [] }
      map[lid].lineas.push(d)
    })
    return Object.values(map).sort((a, b) => (a.lugar?.nombre||'').localeCompare(b.lugar?.nombre||'', 'es'))
  }, [detalle])

  const totalLineas  = detalle.length
  const preparados   = detalle.filter(d => d.preparado).length
  const entregadas   = detalle.filter(d => d.entregado).length
  const pct = n => totalLineas > 0 ? Math.round((n / totalLineas) * 100) : 0

  const lugaresFiltrados = lugares.filter(l =>
    !addSearch || l.nombre.toLowerCase().includes(addSearch.toLowerCase())
  )

  if (loading) return <div className="p-6 text-slate-400 text-sm">Cargando...</div>
  if (!pedido) return <div className="p-6 text-red-500 text-sm">Pedido no encontrado</div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Header ── */}
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
          <p className="text-sm text-slate-500 mt-1">
            {totalLineas === 0 ? 'Sin líneas' :
              pedido.estado === 'confirmado' ? `${preparados}/${totalLineas} preparados` :
              pedido.estado === 'en_reparto' ? `${entregadas}/${totalLineas} entregados` :
              pedido.estado === 'completado' ? `${entregadas}/${totalLineas} entregados` :
              `${totalLineas} líneas`}
          </p>
        </div>
        {isAdmin && ESTADO_NEXT[pedido.estado] && (
          <button
            onClick={avanzarEstado}
            disabled={saving || (pedido.estado === 'confirmado' && !todoPreparado)}
            title={pedido.estado === 'confirmado' && !todoPreparado ? 'Faltan items por preparar' : ''}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shrink-0">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
            {{ borrador:'Confirmar', confirmado:'Iniciar reparto', en_reparto:'Completar' }[pedido.estado]}
          </button>
        )}
      </div>

      {/* ── Barra de progreso ── */}
      {totalLineas > 0 && pedido.estado !== 'borrador' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          {pedido.estado === 'confirmado' && (
            <>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1.5"><Box size={12}/> Preparación</span>
                <span>{preparados} / {totalLineas}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct(preparados)}%` }} />
              </div>
              {todoPreparado && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle size={12}/> Todo preparado — el admin puede iniciar el reparto
                </p>
              )}
            </>
          )}
          {['en_reparto','completado'].includes(pedido.estado) && (
            <>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span className="flex items-center gap-1.5"><Truck size={12}/> Entregas</span>
                <span>{entregadas} / {totalLineas}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct(entregadas)}%` }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Agregar línea (borrador) ── */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-slate-200">
          <button onClick={() => setAddOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
            <span className="flex items-center gap-2"><Plus size={15} className="text-emerald-600"/> Agregar línea</span>
            {addOpen ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
          </button>
          {addOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              <div>
                <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  placeholder="Buscar lugar..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"/>
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
                <input type="number" min="0" value={addCant} onChange={e => setAddCant(e.target.value)}
                  placeholder="Cant."
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"/>
                <button onClick={agregarLinea}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors">
                  <Check size={15}/>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lista por lugar ── */}
      {porLugar.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Package size={36} className="mx-auto text-slate-300 mb-3"/>
          <p className="text-slate-400 text-sm">No hay líneas cargadas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {porLugar.map(({ lugar, lineas }) => {
            const lid          = lugar?.id || 'x'
            const open         = expandido[lid] !== false
            const todoPrepLug  = lineas.every(l => l.preparado)
            const todoEntrgLug = lineas.every(l => l.entregado)

            let borderCls = 'border-slate-200'
            if (pedido.estado === 'confirmado' && todoPrepLug)  borderCls = 'border-emerald-200 bg-emerald-50/30'
            if (pedido.estado === 'en_reparto'  && todoEntrgLug) borderCls = 'border-emerald-200 bg-emerald-50/30'

            return (
              <div key={lid} className={`bg-white rounded-xl border transition-colors ${borderCls}`}>
                {/* Cabecera lugar */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button className="flex-1 flex items-center gap-2 text-left"
                    onClick={() => setExpandido(e => ({ ...e, [lid]: !open }))}>
                    <MapPin size={14} className={todoPrepLug || todoEntrgLug ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'}/>
                    <span className="font-medium text-slate-800 text-sm">
                      {lugar?.id_numerico && <span className="text-slate-400 text-xs mr-1">#{lugar.id_numerico}</span>}
                      {lugar?.nombre || 'Lugar sin nombre'}
                    </span>
                    <span className="text-xs text-slate-400">{lineas.length} prod.</span>
                    {(todoPrepLug && pedido.estado === 'confirmado') && (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium ml-1">
                        <CheckCircle size={11}/> Preparado
                      </span>
                    )}
                    {(todoEntrgLug && pedido.estado !== 'borrador') && (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium ml-1">
                        <CheckCircle size={11}/> Entregado
                      </span>
                    )}
                  </button>
                  {/* Botón "Preparar todo" para preparador */}
                  {canPreparar && !todoPrepLug && (
                    <button
                      onClick={() => prepararTodoLugar(lineas)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors font-medium shrink-0">
                      <ClipboardCheck size={12}/> Preparar todo
                    </button>
                  )}
                  <button onClick={() => setExpandido(e => ({ ...e, [lid]: !open }))}
                    className="text-slate-300 hover:text-slate-500 shrink-0">
                    {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </button>
                </div>

                {open && (
                  <div className="border-t border-slate-100">
                    <div className="divide-y divide-slate-50">
                      {lineas.map(linea => (
                        <LineaRow
                          key={linea.id}
                          linea={linea}
                          canEdit={canEdit}
                          canPreparar={canPreparar}
                          canReparto={canReparto}
                          onEliminar={() => eliminarLinea(linea.id)}
                          onPreparar={() => prepararLinea(linea.id)}
                          onConfirmar={(cant, com) => confirmarEntrega(linea, cant, com)}
                        />
                      ))}
                    </div>
                    {/* Comentario de stock por lugar (repartidor, cuando todo entregado) */}
                    {canReparto && todoEntrgLug && (
                      <ComentarioLugar
                        lugarNombre={lugar?.nombre}
                        comentarioActual={lineas[0]?.comentario_repartidor}
                        onGuardar={com => guardarComentarioLugar(lineas, com)}
                      />
                    )}
                    {/* Mostrar comentario guardado en modo lectura */}
                    {!canReparto && lineas[0]?.comentario_repartidor && (
                      <div className="px-4 py-2.5 border-t border-slate-100 flex items-start gap-2 bg-slate-50/50">
                        <MessageSquare size={13} className="text-slate-400 mt-0.5 shrink-0"/>
                        <p className="text-xs text-slate-600 italic">{lineas[0].comentario_repartidor}</p>
                      </div>
                    )}
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

// ── Fila de línea ──────────────────────────────────────────────
function LineaRow({ linea, canEdit, canPreparar, canReparto, onEliminar, onPreparar, onConfirmar }) {
  const [cantInput, setCantInput] = useState(String(linea.cantidad_planificada ?? ''))
  const [guardando, setGuardando] = useState(false)

  async function handleConfirmar() {
    setGuardando(true)
    await onConfirmar(cantInput || linea.cantidad_planificada, null)
    setGuardando(false)
  }

  return (
    <div className={`px-4 py-2.5 flex items-center gap-3 ${(linea.preparado && !linea.entregado) ? 'bg-blue-50/30' : ''} ${linea.entregado ? 'opacity-70' : ''}`}>
      <Package size={13} className="text-slate-400 shrink-0"/>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-700">{linea.productos?.nombre}</span>
        <span className="text-xs text-slate-400 ml-1">({linea.productos?.unidad})</span>
      </div>

      {/* BORRADOR: cantidad + eliminar */}
      {canEdit && (
        <>
          <span className="text-sm font-mono text-slate-600 w-12 text-right">{linea.cantidad_planificada}</span>
          <button onClick={onEliminar}
            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={13}/>
          </button>
        </>
      )}

      {/* PREPARADOR: checkbox de preparado */}
      {canPreparar && (
        linea.preparado ? (
          <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
            <CheckCircle size={13}/> Preparado
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-slate-500">{linea.cantidad_planificada}</span>
            <button onClick={onPreparar}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
              <Check size={11}/> Preparar
            </button>
          </div>
        )
      )}

      {/* REPARTIDOR: confirmar entrega */}
      {canReparto && !linea.entregado && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Plan: <strong>{linea.cantidad_planificada}</strong></span>
          <input type="number" min="0" step="1" value={cantInput}
            onChange={e => setCantInput(e.target.value)}
            className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-center"/>
          <button onClick={handleConfirmar} disabled={guardando}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
            <Truck size={12}/> {guardando ? '...' : 'Entregué'}
          </button>
        </div>
      )}

      {/* ENTREGADO */}
      {linea.entregado && (
        <div className="flex items-center gap-1.5 text-emerald-600 shrink-0">
          <CheckCircle size={13}/>
          <span className="text-sm font-medium">{linea.cantidad_entregada}</span>
          {linea.cantidad_entregada < linea.cantidad_planificada && (
            <span className="text-xs text-amber-500 flex items-center gap-0.5">
              <AlertCircle size={11}/> (plan: {linea.cantidad_planificada})
            </span>
          )}
        </div>
      )}

      {/* LECTURA (confirmado o completado, sin permisos de edición) */}
      {!canEdit && !canPreparar && !canReparto && !linea.entregado && (
        <span className="text-sm font-mono text-slate-500">{linea.cantidad_planificada}</span>
      )}
    </div>
  )
}

// ── Comentario de stock por lugar ──────────────────────────────
function ComentarioLugar({ lugarNombre, comentarioActual, onGuardar }) {
  const [texto, setTexto]     = useState(comentarioActual || '')
  const [guardado, setGuardado] = useState(!!comentarioActual)
  const [saving, setSaving]   = useState(false)

  async function handleGuardar() {
    if (!texto.trim()) return
    setSaving(true)
    await onGuardar(texto.trim())
    setSaving(false)
    setGuardado(true)
  }

  return (
    <div className="px-4 py-3 border-t border-slate-100 bg-amber-50/40 space-y-2">
      <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
        <MessageSquare size={12}/> ¿Cómo quedó el stock en {lugarNombre}?
      </p>
      {guardado ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-slate-600 italic flex-1">"{texto}"</p>
          <button onClick={() => setGuardado(false)} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">Editar</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ej: Quedan 2 rollos de papel, bajo en jabón..."
            rows={2}
            className="flex-1 px-3 py-2 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white"
          />
          <button onClick={handleGuardar} disabled={saving || !texto.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors self-start">
            {saving ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}
