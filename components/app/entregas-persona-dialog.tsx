'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type Entrega = {
  id: string
  fecha_movimiento: string
  cantidad: number
  afecta_inventario: boolean
  insumo: string
  destino: string | null
  grupo_familiar: string | null
}

type Props = { personaId: string; nombre: string; centroId: string }

export function EntregasPersonaDialog({ personaId, nombre, centroId }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [entregas, setEntregas] = useState<Entrega[] | null>(null)

  async function abrir() {
    setAbierto(true)
    if (entregas) return
    const supabase = createClient()
    const { data } = await supabase.rpc('sp_historial_entregas_persona', {
      p_persona_id: personaId, p_centro_id: centroId,
    })
    setEntregas((data as unknown as Entrega[]) ?? [])
  }

  return (
    <>
      <button onClick={abrir} className="text-sm text-primary hover:underline">
        Ver entregas
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entregas a {nombre}</DialogTitle>
          </DialogHeader>

          {entregas === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {entregas && entregas.length === 0 && (
            <p className="text-sm text-muted-foreground">Esta persona aún no ha recibido entregas.</p>
          )}
          {entregas && entregas.length > 0 && (
            <ul className="divide-y rounded-md border text-sm">
              {entregas.map(e => (
                <li key={e.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="font-medium">{e.insumo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.fecha_movimiento).toLocaleDateString('es-VE')}
                      {e.destino && ` · ${e.destino}`}
                      {e.grupo_familiar && ` · ${e.grupo_familiar}`}
                      {!e.afecta_inventario && ' · no afectó inventario'}
                    </p>
                  </div>
                  <span className="font-medium">{e.cantidad.toLocaleString('es-VE')}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
