import { Menu, LogOut, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROL_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  preparador: 'Preparador',
  repartidor: 'Repartidor',
}

export default function Header({ onMenuClick }) {
  const { profile, signOut } = useAuth()

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100">
          <Bell size={18} />
        </button>
        <div className="hidden sm:flex flex-col items-end mr-2">
          <span className="text-sm font-medium text-slate-700 leading-tight">{profile?.nombre}</span>
          <span className="text-xs text-slate-400">{ROL_LABELS[profile?.rol]}</span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
