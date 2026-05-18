import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Warehouse, Clock } from 'lucide-react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Lugares from './pages/Lugares'
import Productos from './pages/Productos'
import Supervisores from './pages/Supervisores'
import Clientes from './pages/Clientes'
import Importar from './pages/Importar'
import Analisis from './pages/Analisis'
import Mapa from './pages/Mapa'
import Personal from './pages/Personal'
import Usuarios from './pages/Usuarios'
import Perfil from './pages/Perfil'
import Pedidos from './pages/Pedidos'
import PedidoDetalle from './pages/PedidoDetalle'
import Proximamente from './pages/Proximamente'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Cargando...</span>
      </div>
    </div>
  )
}

function PendingScreen() {
  const { signOut, profile } = useAuth()
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4">
            <Warehouse size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Park Stock</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Acceso pendiente</h2>
          <p className="text-slate-500 text-sm mb-1">Hola {profile?.nombre},</p>
          <p className="text-slate-500 text-sm mb-6">
            Tu cuenta está registrada y esperando aprobación.
            Un administrador te va a dar acceso en breve.
          </p>
          <button onClick={signOut} className="text-sm text-slate-400 hover:text-slate-600 underline transition-colors">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

function Guard({ children, roles }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (profile && !profile.activo) return <PendingScreen />
  if (roles && profile && !roles.includes(profile.rol)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/" element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="lugares"     element={<Guard roles={['admin','supervisor']}><Lugares /></Guard>} />
        <Route path="productos"   element={<Guard roles={['admin']}><Productos /></Guard>} />
        <Route path="supervisores" element={<Guard roles={['admin']}><Supervisores /></Guard>} />
        <Route path="clientes"    element={<Guard roles={['admin']}><Clientes /></Guard>} />
        <Route path="importar"    element={<Guard roles={['admin']}><Importar /></Guard>} />
        <Route path="analisis"    element={<Guard roles={['admin','supervisor','compras']}><Analisis /></Guard>} />
        <Route path="mapa"        element={<Guard roles={['admin','supervisor','repartidor']}><Mapa /></Guard>} />
        <Route path="personal"    element={<Guard roles={['admin']}><Personal /></Guard>} />
        <Route path="usuarios"    element={<Guard roles={['admin']}><Usuarios /></Guard>} />
        <Route path="modelo"      element={<Guard roles={['admin','supervisor']}><Proximamente titulo="Planilla Modelo" /></Guard>} />
        <Route path="pedidos"     element={<Guard roles={['admin','compras','preparador','repartidor']}><Pedidos /></Guard>} />
        <Route path="pedidos/:id" element={<Guard roles={['admin','compras','preparador','repartidor']}><PedidoDetalle /></Guard>} />
        <Route path="rutas"       element={<Guard roles={['admin','repartidor']}><Proximamente titulo="Rutas" /></Guard>} />
        <Route path="stock"       element={<Guard roles={['admin','compras']}><Proximamente titulo="Stock" /></Guard>} />
        <Route path="perfil"     element={<Guard><Perfil /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
