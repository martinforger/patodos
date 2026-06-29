'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Solicitud = {
  id: string
  estado: string
  created_at: string
  usuario_id: string
  nombre: string
  apellido: string
  correo: string
  telefono: string | null
}

type Props = {
  centroId: string
  solicitudes: Solicitud[]
}

export function SolicitudesUnion({ centroId, solicitudes: inicial }: Props) {
  const [solicitudes, setSolicitudes] = useState(inicial)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  if (solicitudes.length === 0) return null

  async function resolver(solicitudId: string, accion: 'aprobar' | 'rechazar') {
    setProcesando(solicitudId)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_resolver_solicitud_union', {
      p_solicitud_id: solicitudId,
      p_accion: accion,
    })
    if (rpcError) {
      setError(rpcError.message)
      setProcesando(null)
      return
    }
    setSolicitudes((prev) => prev.filter((s) => s.id !== solicitudId))
    setProcesando(null)
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">
          {solicitudes.length}
        </span>
        <h3 className="text-sm font-semibold">
          {solicitudes.length === 1 ? 'Solicitud de unión pendiente' : 'Solicitudes de unión pendientes'}
        </h3>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {solicitudes.map((s) => (
          <div
            key={s.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.nombre} {s.apellido}</p>
              <p className="text-xs text-muted-foreground">{s.correo}{s.telefono ? ` · ${s.telefono}` : ''}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => resolver(s.id, 'rechazar')}
                disabled={procesando === s.id}
                className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-destructive/10 hover:border-destructive/40 disabled:opacity-50"
              >
                Rechazar
              </button>
              <button
                onClick={() => resolver(s.id, 'aprobar')}
                disabled={procesando === s.id}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {procesando === s.id ? 'Procesando…' : 'Aprobar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
