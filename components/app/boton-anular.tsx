'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  movimientoId: string
}

export function BotonAnular({ movimientoId }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function anular() {
    if (!motivo.trim()) {
      setError('Debes indicar el motivo de anulación.')
      return
    }
    setCargando(true)
    setError(null)
    const supabase = createClient()
    const { error: spError } = await supabase.rpc('sp_anular_movimiento', {
      p_movimiento_id: movimientoId,
      p_motivo: motivo.trim(),
    })
    setCargando(false)
    if (spError) {
      setError(spError.message)
      return
    }
    setAbierto(false)
    setMotivo('')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="text-xs text-destructive hover:underline"
      >
        Anular
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold">Anular movimiento</h2>
            <p className="text-sm text-muted-foreground">
              Esta acción revierte el efecto sobre el inventario. Indica el motivo.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Motivo de anulación…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setAbierto(false); setMotivo(''); setError(null) }}
                className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={anular}
                disabled={cargando}
                className="rounded-md bg-destructive text-destructive-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {cargando ? 'Anulando…' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
