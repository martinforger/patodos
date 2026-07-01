'use client'

import { useState } from 'react'
import { DetalleIngresoDialog, type FilaIngreso } from '@/components/app/detalle-ingreso-dialog'
import { formatFecha } from '@/lib/utils'

type Props = { filas: FilaIngreso[] }

export function TablaIngresos({ filas }: Props) {
  const [filaSeleccionada, setFilaSeleccionada] = useState<FilaIngreso | null>(null)

  return (
    <>
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Insumo(s)</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 text-left font-medium">Donante</th>
              <th className="px-4 py-3 text-left font-medium">Registrado por</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No hay ingresos registrados aún.
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr
                  key={fila.id}
                  onClick={() => setFilaSeleccionada(fila)}
                  className={`hover:bg-muted/30 transition-colors cursor-pointer ${fila.anulado ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatFecha(fila.fecha_movimiento)}
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
                    {fila.cantidad.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fila.donante}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fila.registrado_por}</td>
                  <td className="px-4 py-3">
                    {fila.anulado ? (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {filaSeleccionada && (
        <DetalleIngresoDialog
          fila={filaSeleccionada}
          onClose={() => setFilaSeleccionada(null)}
        />
      )}
    </>
  )
}
