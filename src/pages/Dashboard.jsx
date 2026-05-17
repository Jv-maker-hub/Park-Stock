import { useEffect, useState } from 'react'
import { MapPin, Package, ShoppingCart, Truck, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function StatCard({ icon: Icon, label, value, color, sub }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
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

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const [lugaresRes, productosRes, pedidosRes] = await Promise.all([
        supabase.from('lugares').select('id, estado', { count: 'exact' }),
        supabase.from('productos').select('id', { count: 'exact' }).eq('activo', true),
        supabase.from('pedidos').select('id, estado').in('estado', ['borrador','en_preparacion','listo']),
      ])

      const activos = lugaresRes.data?.filter(l => l.estado === 'activo').length ?? 0
      setStats({
        lugares: activos,
        productos: productosRes.count ?? 0,
        pedidosPendientes: pedidosRes.data?.length ?? 0,
      })
      setLoading(false)
    }
    loadStats()
  }, [])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">{saludo}, {profile?.nombre?.split(' ')[0]} 👋</h1>
        <p className="text-slate-500 text-sm mt-0.5">Resumen general del sistema</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100" />
                <div className="space-y-2">
                  <div className="h-6 w-10 bg-slate-100 rounded" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={MapPin} label="Lugares activos" value={stats.lugares} color="emerald" />
          <StatCard icon={Package} label="Productos activos" value={stats.productos} color="blue" />
          <StatCard icon={ShoppingCart} label="Pedidos pendientes" value={stats.pedidosPendientes} color="amber" />
          <StatCard icon={Truck} label="Entregas hoy" value="—" color="slate" sub="Próximamente" />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Estado del sistema</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              <span className="text-slate-600">Base de datos conectada</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock size={16} className="text-amber-500 shrink-0" />
              <span className="text-slate-600">Módulo de pedidos — en desarrollo</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock size={16} className="text-amber-500 shrink-0" />
              <span className="text-slate-600">Rutas y seguimiento GPS — en desarrollo</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock size={16} className="text-amber-500 shrink-0" />
              <span className="text-slate-600">Integración Xubio — en desarrollo</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Acceso rápido</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ver lugares', icon: MapPin, path: '/lugares' },
              { label: 'Ver productos', icon: Package, path: '/productos' },
              { label: 'Nuevo pedido', icon: ShoppingCart, path: '/pedidos' },
              { label: 'Control stock', icon: AlertTriangle, path: '/stock' },
            ].map(({ label, icon: Icon, path }) => (
              <a
                key={path}
                href={path}
                className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-sm text-slate-600 hover:text-emerald-700"
              >
                <Icon size={15} />
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
