import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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

function Guard({ children, roles }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
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
        <Route path="analisis"    element={<Guard roles={['admin','supervisor']}><Analisis /></Guard>} />
        <Route path="mapa"        element={<Guard roles={['admin','supervisor','operario']}><Mapa /></Guard>} />
        <Route path="modelo"      element={<Guard roles={['admin','supervisor']}><Proximamente titulo="Planilla Modelo" /></Guard>} />
        <Route path="pedidos"     element={<Guard roles={['admin','supervisor','preparador']}><Proximamente titulo="Pedidos" /></Guard>} />
        <Route path="rutas"       element={<Guard roles={['admin','repartidor']}><Proximamente titulo="Rutas" /></Guard>} />
        <Route path="stock"       element={<Guard roles={['admin']}><Proximamente titulo="Stock" /></Guard>} />
        <Route path="usuarios"    element={<Guard roles={['admin']}><Proximamente titulo="Usuarios" /></Guard>} />
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
