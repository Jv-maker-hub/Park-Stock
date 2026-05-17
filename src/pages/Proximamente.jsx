import { Clock } from 'lucide-react'

export default function Proximamente({ titulo }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Clock size={24} className="text-slate-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-700">{titulo}</h2>
      <p className="text-sm text-slate-400 mt-1">Este módulo está en desarrollo</p>
    </div>
  )
}
