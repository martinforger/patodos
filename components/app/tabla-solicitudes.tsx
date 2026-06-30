'use client'

import { useState } from 'react'
import { CambiarEstadoEntrega } from '@/components/app/cambiar-estado-entrega'
import { DetalleSolicitudDialog, type FilaSolicitud } from '@/components/app/detalle-solicitud-dialog'

type EstadoSolicitud = 'pendiente' | 'parcialmente_atendida' | 'completada' | 'cancelada'
type EstadoEntrega = 'pendiente' | 'embalado' | 'enviado' | 'entregado'

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

type Props = { filas: FilaSolicitud[] }

export function TablaSolicitudes({ filas }: Props) {
  const [filaSeleccionada, setFilaSeleccionada] = useState<FilaSolicitud | null>(null)

  return (
    <>
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Insumo(s)</th>
              <th className="px-4 py-3 text-right font-medium">Solicitado</th>
              <th className="px-4 py-3 text-right font-medium">Despachado</th>
              <th className="px-4 py-3 text-left font-medium">Solicitante</th>
              <th className="px-4 py-3 text-left font-medium">Registrado por</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No hay solicitudes registradas aún.
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr
                  key={fila.id}
                  onClick={() => setFilaSeleccionada(fila)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(fila.fecha_solicitud).toLocaleDateString('es-VE')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {fila.es_lote ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                        {fila.num_insumos} insumos
                      </span>
                    ) : (
                      fila.insumo
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fila.es_lote ? '—' : fila.cantidad_solicitada.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {fila.es_lote ? '—' : fila.cantidad_despachada.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{fila.solicitante}</p>
                    <p className="text-xs text-muted-foreground">{fila.solicitante_telefono}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fila.registrado_por}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoBadge[fila.estado]}`}>
                      {estadoLabel[fila.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entregaBadge[fila.estado_entrega]}`}>
                        {entregaLabel[fila.estado_entrega]}
                      </span>
                      {!fila.es_lote && fila.estado !== 'cancelada' && (
                        <CambiarEstadoEntrega
                          solicitudId={fila.id}
                          estadoActual={fila.estado_entrega}
                          observacionesActuales={fila.observaciones}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filaSeleccionada && (
        <DetalleSolicitudDialog
          fila={filaSeleccionada}
          onClose={() => setFilaSeleccionada(null)}
        />
      )}
    </>
  )
}
