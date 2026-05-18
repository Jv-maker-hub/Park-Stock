import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Package, ShoppingCart, Truck, AlertTriangle,
  CheckCircle, Clock, ClipboardCheck, ArrowRight,
  PackageCheck, Sun, Sunset, Moon, Coffee
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Momento del día ──────────────────────────────────────────────────────────
function getMomento() {
  const h = new Date().getHours()
  if (h >= 5  && h < 10) return 'mañana'      // 5–10: mañana (conteo inicial)
  if (h >= 10 && h < 14) return 'preparacion' // 10–14: preparación de pedidos
  if (h >= 14 && h < 19) return 'tarde'       // 14–19: post-preparación / repartos
  return 'noche'                               // 19+: cierre del día
}

const MOMENTO_LABEL = {
  mañana:      { icon: Coffee,  label: 'Mañana',      color: 'text-amber-500' },
  preparacion: { icon: Package, label: 'Preparación', color: 'text-blue-500' },
  tarde:       { icon: Truck,   label: 'Tarde',       color: 'text-violet-500' },
  noche:       { icon: Moon,    label: 'Noche',       color: 'text-slate-400' },
}

// ─── Stat card genérica ───────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
    violet:  'bg-violet-50 text-violet-600',
    slate:   'bg-slate-100 text-slate-600',
  }
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{value ?? '—'}</div>
          <div className="text-sm text-slate-500">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta control diario para REPARTIDOR ──────────────────────────────────
function CardControlRepartidor({ userId, momento }) {
  const navigate = useNavigate()
  const [tarea, setTarea] = useState(undefined)
  const [lineas, setLineas] = useState([])

  useEffect(() => {
    async function load() {
      const hoy = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('stock_arqueo').select('*')
        .eq('tipo', 'diario').eq('fecha_conteo', hoy).eq('assigned_to', userId)
        .maybeSingle()
      setTarea(data ?? null)
      if (data) {
        const { data: ls } = await supabase
          .from('stock_arqueo_linea').select('id, cantidad_inicial, cantidad_post_prep').eq('arqueo_id', data.id)
        setLineas(ls ?? [])
      }
    }
    load()
  }, [userId])

  if (tarea === undefined) return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 animate-pulse h-28" />
  )

  // Sin tarea
  if (!tarea) {
    if (momento === 'noche') return null
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Sin tarea de control para hoy</p>
          <p className="text-xs text-amber-600 mt-0.5">Avisale al admin para que la genere.</p>
        </div>
      </div>
    )
  }

  const inicialDone = lineas.length > 0 && lineas.every(l => l.cantidad_inicial != null)
  const postDone    = lineas.length > 0 && lineas.every(l => l.cantidad_post_prep != null)
  const completado  = tarea.estado === 'cerrado'

  // Completado
  if (completado) {
    const diffs = tarea.diferencias_count ?? 0
    return (
      <div className={`rounded-xl border p-4 ${diffs > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${diffs > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {diffs > 0 ? <AlertTriangle size={17} /> : <CheckCircle size={17} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {diffs > 0 ? `Control del día: ${diffs} diferencias` : 'Control del día completado ✅'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {diffs > 0 ? 'El admin ya fue notificado.' : 'Todos los conteos coinciden.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Estado según momento del día
  let titulo, subtitulo, btnLabel, bgClass, btnClass
  if (!inicialDone) {
    // Conteo inicial pendiente
    titulo = momento === 'mañana' ? '⏰ Hacé el conteo inicial ahora' : '⚠️ Conteo inicial pendiente'
    subtitulo = `${lineas.filter(l => l.cantidad_inicial != null).length}/${lineas.length} productos contados`
    btnLabel = 'Ir al conteo →'
    bgClass = momento === 'mañana' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'
    btnClass = momento === 'mañana' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
  } else if (momento === 'preparacion') {
    // Esperando que el preparador termine
    titulo = '⏳ Esperando que terminen de preparar'
    subtitulo = 'Conteo inicial ✅ — después de la preparación, volvé a contar'
    btnLabel = 'Ver conteo inicial →'
    bgClass = 'bg-slate-50 border-slate-200'
    btnClass = 'bg-slate-500 hover:bg-slate-600'
  } else if (!postDone) {
    // Post-preparación pendiente
    titulo = '🔍 Hacé el conteo post-preparación'
    subtitulo = `${lineas.filter(l => l.cantidad_post_prep != null).length}/${lineas.length} productos contados`
    btnLabel = 'Ir al conteo →'
    bgClass = 'bg-violet-50 border-violet-200'
    btnClass = 'bg-violet-600 hover:bg-violet-700'
  } else {
    titulo = '✅ Conteos completos — cerrá el control'
    subtitulo = 'Podés cerrar el control del día'
    btnLabel = 'Cerrar control →'
    bgClass = 'bg-emerald-50 border-emerald-200'
    btnClass = 'bg-emerald-600 hover:bg-emerald-700'
  }

  // Mini barra de progreso
  const progLineas = momento === 'preparacion' || (!inicialDone)
    ? lineas.map(l => l.cantidad_inicial != null)
    : lineas.map(l => l.cantidad_post_prep != null)

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${bgClass}`}>
      <p className="text-sm font-semibold text-slate-800 mb-0.5">{titulo}</p>
      <p className="text-xs text-slate-500 mb-3">{subtitulo}</p>
      {lineas.length > 0 && (
        <div className="flex gap-1 mb-3">
          {progLineas.map((done, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${done ? 'bg-current opacity-50' : 'bg-white/60'}`} />
          ))}
        </div>
      )}
      <button onClick={() => navigate('/control-diario')}
        className={`w-full py-2 text-white text-sm font-medium rounded-lg transition-colors ${btnClass}`}>
        {btnLabel}
      </button>
    </div>
  )
}

// ─── Tarjeta pedidos para PREPARADOR ─────────────────────────────────────────
function CardPreparador({ momento }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: pedidos } = await supabase
        .from('pedidos').select('id, estado').eq('estado', 'confirmado')
      const { data: detalle } = await supabase
        .from('pedido_detalle').select('id, preparado').in(
          'pedido_id', (pedidos ?? []).map(p => p.id)
        )
      const total = detalle?.length ?? 0
      const listos = detalle?.filter(d => d.preparado).length ?? 0
      setData({ pedidosActivos: pedidos?.length ?? 0, total, listos })
    }
    load()
  }, [])

  if (!data) return <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 animate-pulse h-24" />

  const pct = data.total > 0 ? Math.round((data.listos / data.total) * 100) : 0
  const todoDone = data.total > 0 && data.listos === data.total

  if (data.pedidosActivos === 0) return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <CheckCircle size={18} className="text-emerald-500" />
      <div>
        <p className="text-sm font-medium text-slate-700">No hay pedidos a preparar</p>
        <p className="text-xs text-slate-400 mt-0.5">Todo al día</p>
      </div>
    </div>
  )

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${todoDone ? 'bg-emerald-50 border-emerald-200' : momento === 'preparacion' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {todoDone ? '✅ Todo preparado' : momento === 'preparacion' ? '📦 Pedidos a preparar' : 'Pedidos pendientes'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.listos}/{data.total} ítems · {data.pedidosActivos} pedido{data.pedidosActivos !== 1 ? 's' : ''}
          </p>
        </div>
        <span className={`text-2xl font-bold ${todoDone ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-3">
        <div className={`h-full transition-all ${todoDone ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <button onClick={() => navigate('/pedidos')}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
        Ver pedidos →
      </button>
    </div>
  )
}

// ─── Tarjeta control para ADMIN ───────────────────────────────────────────────
function CardControlAdmin() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const hoy = new Date().toISOString().split('T')[0]
      const { data: controles } = await supabase
        .from('stock_arqueo').select('estado, diferencias_count, post_prep_completado, productos_total, productos_contados')
        .eq('tipo', 'diario').eq('fecha_conteo', hoy)
      setData(controles ?? [])
    }
    load()
  }, [])

  if (!data) return null
  if (data.length === 0) return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ClipboardCheck size={16} className="text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-600">Control diario</p>
          <p className="text-xs text-slate-400">Sin tarea generada hoy</p>
        </div>
      </div>
      <button onClick={() => navigate('/control-diario')}
        className="text-xs text-violet-600 hover:text-violet-800 font-medium">Generar →</button>
    </div>
  )

  const totalDiffs = data.reduce((s, c) => s + (c.diferencias_count ?? 0), 0)
  const completados = data.filter(c => c.estado === 'cerrado').length

  return (
    <div onClick={() => navigate('/control-diario')}
      className={`rounded-xl border p-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${
        totalDiffs > 0 ? 'bg-red-50 border-red-200' : completados === data.length ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
      }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalDiffs > 0 ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-600'}`}>
            <ClipboardCheck size={15} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Control diario</p>
            <p className="text-xs text-slate-400">
              {completados}/{data.length} completos
              {totalDiffs > 0 && <span className="text-red-600 font-medium"> · ⚠️ {totalDiffs} diferencias</span>}
              {totalDiffs === 0 && completados === data.length && <span className="text-emerald-600 font-medium"> · Sin diferencias</span>}
            </p>
          </div>
        </div>
        <ArrowRight size={14} className="text-slate-300" />
      </div>
    </div>
  )
}

// ─── DASHBOARD PRINCIPAL ──────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [momento] = useState(getMomento())

  const isRepartidor  = profile?.rol === 'repartidor'
  const isPreparador  = profile?.rol === 'preparador'
  const isAdmin       = ['admin','compras'].includes(profile?.rol)
  const isAuditor     = profile?.rol === 'auditor'

  useEffect(() => {
    async function loadStats() {
      const [lugaresRes, productosRes, pedidosRes] = await Promise.all([
        supabase.from('lugares').select('id, estado'),
        supabase.from('productos').select('id', { count: 'exact' }).eq('activo', true),
        supabase.from('pedidos').select('id, estado').in('estado', ['borrador','confirmado','en_reparto']),
      ])
      setStats({
        lugares:  lugaresRes.data?.filter(l => l.estado === 'activo').length ?? 0,
        productos: productosRes.count ?? 0,
        pedidosPendientes: pedidosRes.data?.length ?? 0,
      })
      setLoading(false)
    }
    loadStats()
  }, [])

  // Saludo según hora
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const MomentoIcon = MOMENTO_LABEL[momento].icon

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{saludo}, {profile?.nombre?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 ${MOMENTO_LABEL[momento].color}`}>
          <MomentoIcon size={13} />
          {MOMENTO_LABEL[momento].label}
        </div>
      </div>

      {/* ── VISTA REPARTIDOR ── */}
      {isRepartidor && user?.id && (
        <div className="mb-6">
          <CardControlRepartidor userId={user.id} momento={momento} />
        </div>
      )}

      {/* ── VISTA PREPARADOR ── */}
      {isPreparador && (
        <div className="mb-6">
          {momento === 'mañana' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3 text-sm text-slate-500">
              🌅 Todavía es temprano. Los pedidos a preparar aparecen después de las 10.
            </div>
          )}
          <CardPreparador momento={momento} />
        </div>
      )}

      {/* Stats generales — todos los roles */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={MapPin}      label="Lugares activos"   value={stats.lugares}           color="emerald" />
          <StatCard icon={Package}     label="Productos"         value={stats.productos}          color="blue" />
          <StatCard icon={ShoppingCart} label="Pedidos activos"  value={stats.pedidosPendientes} color="amber" />
          <StatCard icon={Truck}       label="Entregas hoy"      value="—"                        color="slate" sub="Próximamente" />
        </div>
      )}

      {/* Paneles secundarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Estado del sistema</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              <span className="text-slate-600">Base de datos conectada</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              <span className="text-slate-600">Módulo de pedidos activo</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              <span className="text-slate-600">Auditor de stock activo</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock size={16} className="text-amber-500 shrink-0" />
              <span className="text-slate-600">Rutas y GPS — en desarrollo</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Card control diario admin */}
          {(isAdmin || isAuditor) && <CardControlAdmin />}

          {/* Card pedidos para admin */}
          {isAdmin && <CardPreparador momento={momento} />}

          {/* Acceso rápido */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h2 className="font-semibold text-slate-700 text-sm mb-3">Acceso rápido</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Lugares',       icon: MapPin,         path: '/lugares',        roles: ['admin','supervisor'] },
                { label: 'Productos',     icon: Package,        path: '/productos',       roles: ['admin'] },
                { label: 'Pedidos',       icon: ShoppingCart,   path: '/pedidos',         roles: ['admin','compras','preparador','repartidor'] },
                { label: 'Auditor stock', icon: ClipboardCheck, path: '/auditor',         roles: ['admin','auditor','compras'] },
                { label: 'Control diario',icon: PackageCheck,   path: '/control-diario',  roles: ['admin','auditor','repartidor'] },
              ]
              .filter(it => it.roles.includes(profile?.rol))
              .slice(0, 4)
              .map(({ label, icon: Icon, path }) => (
                <a key={path} href={path}
                  className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-sm text-slate-600 hover:text-emerald-700">
                  <Icon size={14} />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
