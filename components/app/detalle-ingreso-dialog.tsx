'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
  donante: string
  donante_anonimo: boolean
  observaciones: string | null
  items: ItemLote[]
}

export type FilaIngreso = {
  id: string
  lote_id: string | null
  es_lote: boolean
  num_insumos: number
  fecha_movimiento: string
  insumo: string | null
  cantidad: number
  donante: string
  registrado_por: string
  anulado: boolean
  observaciones: string | null
}

type Props = { fila: FilaIngreso; onClose: () => void }

export function DetalleIngresoDialog({ fila, onClose }: Props) {
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!fila.es_lote) return
    setCargando(true)
    const supabase = createClient()
    supabase.rpc('sp_detalle_lote_ingresos', { p_lote_id: fila.id })
      .then(({ data }) => { setDetalle(data as LoteDetalle); setCargando(false) })
  }, [fila.id, fila.es_lote])

  const datos: LoteDetalle = fila.es_lote
    ? (detalle ?? { lote_id: fila.id, fecha: fila.fecha_movimiento, registrado_por: fila.registrado_por, donante: fila.donante, donante_anonimo: false, observaciones: fila.observaciones, items: [] })
    : {
        lote_id: fila.id,
        fecha: fila.fecha_movimiento,
        registrado_por: fila.registrado_por,
        donante: fila.donante,
        donante_anonimo: false,
        observaciones: fila.observaciones,
        items: [{ id: fila.id, insumo: fila.insumo ?? '', cantidad: fila.cantidad, anulado: fila.anulado, anulado_motivo: null }],
      }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del ingreso</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd>{new Date(datos.fecha).toLocaleDateString('es-VE')}</dd>
              <dt className="text-muted-foreground">Donante</dt>
              <dd>{datos.donante}</dd>
              <dt className="text-muted-foreground">Registrado por</dt>
              <dd>{datos.registrado_por}</dd>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
