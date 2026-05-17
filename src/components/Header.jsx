import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, LogOut, Bell, User, ChevronDown, UserCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROL_LABELS = {
  admin:      'Administrador',
  compras:    'Compras',
  preparador: 'Preparador',
  repartidor: 'Repartidor',
  recepcion:  'Recepción',
}

export default function Header({ onMenuClick }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

        {/* User menu */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.nombre} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <User size={15} className="text-emerald-700" />
              </div>
            )}
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-medium text-slate-700 leading-tight">
                {profile?.nombre || 'Usuario'}
              </span>
              <span className="text-xs text-slate-400">
                {ROL_LABELS[profile?.rol] || '...'}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>

          {menuOpen && (
            <div className="fixed right-4 top-14 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-[9999]">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-800">{profile?.nombre}</p>
                <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 capitalize">
                  {ROL_LABELS[profile?.rol] || profile?.rol}
                </span>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/perfil') }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <UserCircle size={15} />
                Mi perfil
              </button>
              <button
                onClick={() => { setMenuOpen(false); signOut() }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
