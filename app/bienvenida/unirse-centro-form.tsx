'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type CentroPublico = {
  id: string
  nombre: string
  municipio: string
  estado_geo: string
  telefono: string | null
  solicitud_estado: 'pendiente' | 'aprobada' | 'rechazada' | null
  ya_es_miembro: boolean
}

export function UnirseCentroForm() {
  const [centros, setCentros] = useState<CentroPublico[]>([])
  const [cargando, setCargando] = useState(true)
  const [pendiente, setPendiente] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('sp_listar_centros_publicos').then(({ data }) => {
      setCentros((data as CentroPublico[] | null) ?? [])
      setCargando(false)
    })
  }, [])

  async function solicitar(centroId: string) {
    setPendiente(centroId)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_solicitar_union_centro', {
      p_centro_id: centroId,
    })
    if (rpcError) {
      setError(rpcError.message)
      setPendiente(null)
      return
    }
    setCentros((prev) =>
      prev.map((c) =>
        c.id === centroId ? { ...c, solicitud_estado: 'pendiente' } : c,
      ),
    )
    setPendiente(null)
    router.refresh()
  }

  if (cargando) {
    return <p className="text-sm text-muted-foreground">Cargando centros…</p>
  }

  if (centros.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay centros públicos disponibles todavía.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {centros.map((c) => {
          const esPendiente = c.solicitud_estado === 'pendiente'
          const esAprobada = c.solicitud_estado === 'aprobada'
          const esRechazada = c.solicitud_estado === 'rechazada'

          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {c.municipio}, {c.estado_geo}
                </p>
              </div>

              {c.ya_es_miembro ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Miembro
                </span>
              ) : esAprobada ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Aprobada
                </span>
              ) : esPendiente ? (
                <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  Pendiente
                </span>
              ) : (
                <button
                  onClick={() => solicitar(c.id)}
                  disabled={pendiente === c.id}
                  className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {pendiente === c.id ? 'Solicitando…' : esRechazada ? 'Volver a solicitar' : 'Solicitar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        El coordinador del centro debe aprobar tu solicitud antes de que puedas acceder.
      </p>
    </div>
  )
}
