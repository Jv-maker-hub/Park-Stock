import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileSpreadsheet, MapPin, Package, ClipboardList,
  ShoppingCart, Truck, Warehouse, Users, X,
  UserCheck, Building2, Upload, BarChart2, Map, UserCog, ClipboardCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard',    roles: ['admin','compras','preparador','repartidor','recepcion'] },
  { path: '/lugares',   icon: MapPin,          label: 'Lugares',      roles: ['admin','supervisor'] },
  { path: '/productos', icon: Package,         label: 'Productos',    roles: ['admin'] },
  { path: '/importar-modelo', icon: FileSpreadsheet, label: 'Pedido Modelo', roles: ['admin','compras'] },
  { path: '/importar',  icon: Upload,          label: 'Importar',     roles: ['admin'] },
  { path: '/analisis',  icon: BarChart2,       label: 'Análisis',     roles: ['admin','compras'] },
  { path: '/mapa',      icon: Map,             label: 'Mapa',         roles: ['admin','repartidor'] },
  { path: '/pedidos',   icon: ShoppingCart,    label: 'Pedidos',      roles: ['admin','preparador'] },
  { path: '/rutas',     icon: Truck,           label: 'Rutas',        roles: ['admin','repartidor'] },
  { path: '/stock',     icon: Warehouse,       label: 'Stock',        roles: ['admin','compras'] },
  { path: '/auditor',   icon: ClipboardCheck,  label: 'Auditor',      roles: ['admin','auditor','compras'] },
  { path: '/control-diario', icon: ClipboardList,  label: 'Control diario', roles: ['admin','auditor','compras','repartidor'] },
]

const NAV_CONFIG = [
  { path: '/personal',    icon: UserCog,  label: 'Personal',     roles: ['admin'] },
  { path: '/usuarios',    icon: Users,    label: 'Usuarios',     roles: ['admin'] },
  { path: '/supervisores',icon: UserCheck,label: 'Supervisores', roles: ['admin'] },
  { path: '/clientes',    icon: Building2,label: 'Clientes',     roles: ['admin'] },
]

export default function Sidebar({ open, onClose }) {
  const { profile } = useAuth()
  const rol = profile?.rol

  const items       = NAV.filter(n => n.roles.includes(rol))
  const configItems = NAV_CONFIG.filter(n => n.roles.includes(rol))

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-emerald-600 text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 bg-slate-800 flex flex-col transition-transform duration-200
        lg:static lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center">
              <Warehouse size={15} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Park Stock</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {items.length === 0 && (
            <p className="text-xs text-slate-500 px-3 py-2">Cargando menú...</p>
          )}
          {items.map(({ path, icon: Icon, label }) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={onClose} className={linkClass}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}

          {configItems.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Configuración</span>
              </div>
              {configItems.map(({ path, icon: Icon, label }) => (
                <NavLink key={path} to={path} onClick={onClose} className={linkClass}>
                  <Icon size={17} />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 font-medium truncate">{profile?.nombre || '...'}</div>
          <div className="text-xs text-slate-600 capitalize">{rol || 'cargando...'}</div>
        </div>
      </aside>
    </>
  )
}
