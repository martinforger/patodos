'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type EstadoEntrega = 'pendiente' | 'embalado' | 'enviado' | 'entregado'

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const ETAPAS: { value: EstadoEntrega; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'embalado', label: 'Embalado' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
]

type Props = {
  solicitudId: string
  estadoActual: EstadoEntrega
  observacionesActuales: string | null
  onSuccess?: () => void
}

export function CambiarEstadoEntrega({ solicitudId, estadoActual, observacionesActuales, onSuccess }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<EstadoEntrega>(estadoActual)
  const [observaciones, setObservaciones] = useState(observacionesActuales ?? '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const router = useRouter()

  function cerrar() {
    setAbierto(false)
    setEstado(estadoActual)
    setObservaciones(observacionesActuales ?? '')
    setError(null)
  }

  async function guardar() {
    setError(null)
    setGuardando(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_actualizar_estado_entrega', {
      p_solicitud_id: solicitudId,
      p_estado_entrega: estado,
      p_observaciones: observaciones || undefined,
    })
    setGuardando(false)
    if (rpcError) { setError(rpcError.message); return }
    cerrar()
    if (onSuccess) {
      onSuccess()
    } else {
      router.refresh()
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-xs font-medium text-primary hover:underline"
      >
        Cambiar
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-xl bg-card border shadow-lg p-6 my-4">
        <h2 className="text-lg font-semibold mb-4">Estado de entrega</h2>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Etapa</label>
            <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value as EstadoEntrega)}>
              {ETAPAS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Observaciones (opcional)</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder="Ej. faltan medicamentos, solo se enviaron agua y comida…"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrar} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
