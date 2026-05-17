import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Warehouse } from 'lucide-react'

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setError('')
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError('Error al iniciar sesión con Google')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
            <Warehouse size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Park Stock</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de insumos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7 space-y-5">
          <p className="text-center text-slate-500 text-sm">
            Iniciá sesión con tu cuenta de Google para continuar
          </p>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Redirigiendo a Google...' : 'Continuar con Google'}
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Solo pueden acceder cuentas autorizadas por el administrador
        </p>
      </div>
    </div>
  )
}
