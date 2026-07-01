'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatFecha } from '@/lib/utils'

type ItemLote = {
  id: string
  insumo: string
  cantidad: number
  anulado: boolean
  anulado_motivo: string | null
}

type LoteDetalle = {
  lote_id: string
  fecha: string
  registrado_por: string
  destino: string
  destino_municipio: string | null
  persona_contacto: string
  responsables: string[]
  observaciones: string | null
  afecta_inventario: boolean
  items: ItemLote[]
}

export type FilaEgreso = {
  id: string
  lote_id: string | null
  es_lote: boolean
  num_insumos: number
  fecha_movimiento: string
  insumo: string | null
  cantidad: number
  destino: string
  persona_contacto: string
  responsables: string[]
  registrado_por: string
  anulado: boolean
  observaciones: string | null
}

type Props = { fila: FilaEgreso; rolUsuario?: string; onClose: () => void }

export function DetalleEgresoDialog({ fila, rolUsuario, onClose }: Props) {
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mostrandoConfirmarAnular, setMostrandoConfirmarAnular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cargandoAnulacion, setCargandoAnulacion] = useState(false)
  const [errorAnulacion, setErrorAnulacion] = useState<string | null>(null)
  const router = useRouter()

  const puedeAnular = rolUsuario === 'coordinador_centro' || rolUsuario === 'administrador_sistema'

  async function handleAnular() {
    if (!motivo.trim()) {
      setErrorAnulacion('Debes indicar el motivo de la anulación.')
      return
    }
    setCargandoAnulacion(true)
    setErrorAnulacion(null)
    const supabase = createClient()
    const { error: spError } = await supabase.rpc('sp_anular_egreso', {
      p_id: fila.id,
      p_es_lote: fila.es_lote,
      p_motivo: motivo.trim()
    })
    setCargandoAnulacion(false)
    if (spError) {
      setErrorAnulacion(spError.message)
      return
    }
    setMostrandoConfirmarAnular(false)
    setMotivo('')
    onClose()
    router.refresh()
  }

  useEffect(() => {
    if (!fila.es_lote) return
    setCargando(true)
    const supabase = createClient()
    supabase.rpc('sp_detalle_lote_egresos', { p_lote_id: fila.id })
      .then(({ data }) => { setDetalle(data as LoteDetalle); setCargando(false) })
  }, [fila.id, fila.es_lote])

  const datos: LoteDetalle = fila.es_lote
    ? (detalle ?? { lote_id: fila.id, fecha: fila.fecha_movimiento, registrado_por: fila.registrado_por, destino: fila.destino, destino_municipio: null, persona_contacto: fila.persona_contacto, responsables: fila.responsables, observaciones: fila.observaciones, afecta_inventario: true, items: [] })
    : {
        lote_id: fila.id,
        fecha: fila.fecha_movimiento,
        registrado_por: fila.registrado_por,
        destino: fila.destino,
        destino_municipio: null,
        persona_contacto: fila.persona_contacto,
        responsables: fila.responsables,
        observaciones: fila.observaciones,
        afecta_inventario: true,
        items: [{ id: fila.id, insumo: fila.insumo ?? '', cantidad: fila.cantidad, anulado: fila.anulado, anulado_motivo: null }],
      }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del egreso</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd>{formatFecha(datos.fecha)}</dd>
              <dt className="text-muted-foreground">Destino</dt>
              <dd>{datos.destino}{datos.destino_municipio ? ` · ${datos.destino_municipio}` : ''}</dd>
              <dt className="text-muted-foreground">Recibe</dt>
              <dd>{datos.persona_contacto}</dd>
              {datos.responsables.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Responsables</dt>
                  <dd>{datos.responsables.join(', ')}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Registrado por</dt>
              <dd>{datos.registrado_por}</dd>
              {!datos.afecta_inventario && (
                <>
                  <dt className="text-muted-foreground">Inventario</dt>
                  <dd className="text-amber-600">No afecta inventario</dd>
                </>
              )}
              {datos.observaciones && (
                <>
                  <dt className="text-muted-foreground">Observaciones</dt>
                  <dd>{datos.observaciones}</dd>
                </>
              )}
            </dl>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Insumo</th>
                    <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {datos.items.map((item) => (
                    <tr key={item.id} className={item.anulado ? 'opacity-50' : ''}>
                      <td className="px-3 py-2 font-medium">{item.insumo}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {item.cantidad.toLocaleString('es-VE')}
                      </td>
                      <td className="px-3 py-2">
                        {item.anulado ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                            Anulado
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                            Activo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sección de anulación / botones */}
            {mostrandoConfirmarAnular ? (
              <div className="border-t pt-4 mt-4 space-y-3">
                <h3 className="text-sm font-semibold text-destructive">Anular este egreso</h3>
                <p className="text-xs text-muted-foreground">
                  Esta acción es irreversible y revertirá el stock en el inventario de este centro. Por favor, indica el motivo de la anulación:
                </p>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Motivo de la anulación (obligatorio)..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  disabled={cargandoAnulacion}
                />
                {errorAnulacion && <p className="text-xs text-destructive">{errorAnulacion}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setMostrandoConfirmarAnular(false)
                      setMotivo('')
                      setErrorAnulacion(null)
                    }}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                    disabled={cargandoAnulacion}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAnular}
                    disabled={cargandoAnulacion}
                    className="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {cargandoAnulacion ? 'Anulando...' : 'Confirmar anulación'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center border-t pt-4 mt-4">
                {puedeAnular && !fila.anulado && (
                  <button
                    onClick={() => setMostrandoConfirmarAnular(true)}
                    className="rounded-md border border-destructive text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 transition-colors"
                  >
                    Anular egreso
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-md bg-muted px-4 py-1.5 text-xs font-medium hover:bg-muted/80 transition-colors ml-auto"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
