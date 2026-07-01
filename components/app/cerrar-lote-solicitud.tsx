'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

type Props = {
  loteId: string
  onSuccess?: () => void
}

export function CerrarLoteSolicitud({ loteId, onSuccess }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cerrar() {
    setAbierto(false)
    setMotivo('')
    setError(null)
  }

  async function confirmar() {
    setError(null)
    setGuardando(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_cerrar_lote_solicitud', {
      p_lote_id: loteId,
      p_motivo: motivo || undefined,
    })
    setGuardando(false)
    if (rpcError) { setError(rpcError.message); return }
    cerrar()
    onSuccess?.()
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-xs font-medium text-primary hover:underline"
      >
        Cerrar solicitud
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-xl bg-card border shadow-lg p-6 my-4">
        <h2 className="text-lg font-semibold mb-2">Cerrar solicitud</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Hay ítems sin despachar por completo. Esto marcará todos los ítems pendientes
          de esta solicitud como completados sin esperar el resto de la entrega.
        </p>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder="Ej. el solicitante ya no requiere el resto"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
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
              onClick={confirmar}
              disabled={guardando}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {guardando ? 'Cerrando…' : 'Cerrar solicitud'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
