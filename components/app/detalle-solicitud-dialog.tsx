'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CambiarEstadoEntrega } from '@/components/app/cambiar-estado-entrega'
import { CerrarLoteSolicitud } from '@/components/app/cerrar-lote-solicitud'
import { formatFecha } from '@/lib/utils'

type EstadoSolicitud = 'pendiente' | 'parcialmente_atendida' | 'completada' | 'cancelada'
type EstadoEntrega = 'pendiente' | 'embalado' | 'enviado' | 'entregado'

type ItemLote = {
  id: string
  insumo: string
  cantidad_solicitada: number
  cantidad_despachada: number
  estado: EstadoSolicitud
  estado_entrega: EstadoEntrega
}

type LoteDetalle = {
  lote_id: string
  fecha: string
  registrado_por: string
  solicitante: string
  solicitante_telefono: string
  destino: string | null
  observaciones: string | null
  items: ItemLote[]
}

export type FilaSolicitud = {
  id: string
  lote_id: string | null
  es_lote: boolean
  num_insumos: number
  fecha_solicitud: string
  insumo: string | null
  cantidad_solicitada: number
  cantidad_despachada: number
  estado: EstadoSolicitud
  estado_entrega: EstadoEntrega
  solicitante: string
  solicitante_telefono: string
  registrado_por: string
  observaciones: string | null
}

const estadoBadge: Record<EstadoSolicitud, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  parcialmente_atendida: 'bg-blue-100 text-blue-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-destructive/10 text-destructive',
}

const estadoLabel: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  parcialmente_atendida: 'Parcial',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

const entregaBadge: Record<EstadoEntrega, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  embalado: 'bg-amber-100 text-amber-700',
  enviado: 'bg-blue-100 text-blue-700',
  entregado: 'bg-green-100 text-green-700',
}

const entregaLabel: Record<EstadoEntrega, string> = {
  pendiente: 'Pendiente',
  embalado: 'Embalado',
  enviado: 'Enviado',
  entregado: 'Entregado',
}

type Props = { fila: FilaSolicitud; onClose: () => void }

export function DetalleSolicitudDialog({ fila, onClose }: Props) {
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null)
  const [cargando, setCargando] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const router = useRouter()

  const cargarDetalle = useCallback(async () => {
    if (!fila.es_lote) return
    setCargando(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('sp_detalle_lote_solicitudes', { p_lote_id: fila.id })
    setDetalle(data as LoteDetalle)
    setCargando(false)
  }, [fila.id, fila.es_lote])

  useEffect(() => { cargarDetalle() }, [cargarDetalle, refreshKey])

  function onItemUpdated() {
    setRefreshKey(k => k + 1)
    router.refresh()
  }

  // Para filas individuales, construir el detalle desde la fila misma
  const datos: LoteDetalle = fila.es_lote
    ? (detalle ?? { lote_id: fila.id, fecha: fila.fecha_solicitud, registrado_por: fila.registrado_por, solicitante: fila.solicitante, solicitante_telefono: fila.solicitante_telefono, destino: null, observaciones: fila.observaciones, items: [] })
    : {
        lote_id: fila.id,
        fecha: fila.fecha_solicitud,
        registrado_por: fila.registrado_por,
        solicitante: fila.solicitante,
        solicitante_telefono: fila.solicitante_telefono,
        destino: null,
        observaciones: fila.observaciones,
        items: [{
          id: fila.id,
          insumo: fila.insumo ?? '',
          cantidad_solicitada: fila.cantidad_solicitada,
          cantidad_despachada: fila.cantidad_despachada,
          estado: fila.estado,
          estado_entrega: fila.estado_entrega,
        }],
      }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6">
            <DialogTitle>Detalle de solicitud</DialogTitle>
            {fila.es_lote && fila.lote_id && datos.items.some((i) => i.estado !== 'completada' && i.estado !== 'cancelada') && (
              <CerrarLoteSolicitud loteId={fila.lote_id} onSuccess={onItemUpdated} />
            )}
          </div>
        </DialogHeader>

        {cargando ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd>{formatFecha(datos.fecha)}</dd>
              <dt className="text-muted-foreground">Solicitante</dt>
              <dd>
                <p>{datos.solicitante}</p>
                <p className="text-xs text-muted-foreground">{datos.solicitante_telefono}</p>
              </dd>
              {datos.destino && (
                <>
                  <dt className="text-muted-foreground">Destino</dt>
                  <dd>{datos.destino}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Registrado por</dt>
              <dd>{datos.registrado_por}</dd>
              {datos.observaciones && (
                <>
                  <dt className="text-muted-foreground">Observaciones</dt>
                  <dd>{datos.observaciones}</dd>
                </>
              )}
            </dl>

            <div className="rounded-lg border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Insumo</th>
                    <th className="px-3 py-2 text-right font-medium">Solicitado</th>
                    <th className="px-3 py-2 text-right font-medium">Despachado</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">Entrega</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {datos.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium">{item.insumo}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {item.cantidad_solicitada.toLocaleString('es-VE')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {item.cantidad_despachada.toLocaleString('es-VE')}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoBadge[item.estado]}`}>
                          {estadoLabel[item.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entregaBadge[item.estado_entrega]}`}>
                            {entregaLabel[item.estado_entrega]}
                          </span>
                          {item.estado !== 'cancelada' && (
                            <CambiarEstadoEntrega
                              solicitudId={item.id}
                              estadoActual={item.estado_entrega}
                              observacionesActuales={null}
                              onSuccess={onItemUpdated}
                            />
                          )}
                        </div>
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
