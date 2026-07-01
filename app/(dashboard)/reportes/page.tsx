import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { ExportarReporte } from '@/components/app/exportar-reporte'

type FilaInsumo = {
  insumo: string
  categoria: string
  total_ingreso: number
  total_egreso: number
  total_egreso_no_inventario: number
  stock_actual: number
}

type FilaMovimiento = {
  id: string
  tipo: 'ingreso' | 'egreso'
  cantidad: number
  fecha_movimiento: string
  insumo: string
  categoria: string
  registrado_por: string
  destino: string | null
  donante: string | null
  observaciones: string | null
  afecta_inventario: boolean
}

type Totales = {
  num_ingresos: number
  num_egresos: number
  num_egresos_no_inventario: number
  total_ingresos: number
  total_egresos: number
  total_egresos_no_inventario: number
}

type Reporte = {
  centro: string
  fecha_desde: string | null
  fecha_hasta: string | null
  totales: Totales
  resumen_insumos: FilaInsumo[]
  movimientos: FilaMovimiento[]
}

type FilaSolicitudPorDia = {
  fecha: string
  total: number
  pendientes: number
  parcialmente_atendidas: number
  completadas: number
  canceladas: number
  atendidas_sin_inventario: number
}

type FilaEgresoCategoria = {
  categoria: string
  num_egresos: number
  unidades: number
}

const puedeReporte = (rol: string) =>
  rol === 'coordinador_centro' || rol === 'administrador_sistema'

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const params  = await searchParams
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  if (!puedeReporte(perfil.rol)) redirect('/dashboard')

  const { data: reporteRaw, error: reporteError } = await supabase.rpc('sp_reporte_centro', {
    p_centro_id:   perfil.centro_id,
    p_fecha_desde: params.desde || undefined,
    p_fecha_hasta: params.hasta || undefined,
  })

  const reporte = reporteRaw as Reporte | null

  const { data: solicitudesPorDiaRaw } = await supabase.rpc('sp_reporte_solicitudes_por_dia', {
    p_centro_id:   perfil.centro_id,
    p_fecha_desde: params.desde || undefined,
    p_fecha_hasta: params.hasta || undefined,
  })
  const solicitudesPorDia = (solicitudesPorDiaRaw as FilaSolicitudPorDia[]) ?? []

  const { data: egresosPorCategoriaRaw } = await supabase.rpc('sp_reporte_egresos_por_categoria_destino', {
    p_centro_id:   perfil.centro_id,
    p_fecha_desde: params.desde || undefined,
    p_fecha_hasta: params.hasta || undefined,
  })
  const egresosPorCategoria = (egresosPorCategoriaRaw as FilaEgresoCategoria[]) ?? []

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #reporte-print, #reporte-print * { visibility: visible; }
          #reporte-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div id="reporte-print">
        {/* Encabezado */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold">Reporte de movimientos</h1>
              <SelectorCentroHeader />
            </div>
            <p className="text-sm text-muted-foreground">
              {params.desde && params.hasta
                ? `${new Date(params.desde).toLocaleDateString('es-VE')} – ${new Date(params.hasta).toLocaleDateString('es-VE')}`
                : 'Todos los períodos'}
            </p>
          </div>
          {reporte && (
            <ExportarReporte
              movimientos={reporte.movimientos}
              centro={reporte.centro}
              fechaDesde={params.desde ?? null}
              fechaHasta={params.hasta ?? null}
            />
          )}
        </div>

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3 mb-6 print:hidden">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={params.desde ?? ''}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={params.hasta ?? ''}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-foreground text-background px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Generar
            </button>
            <a
              href="/reportes"
              className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              Limpiar
            </a>
          </div>
        </form>

        {reporteError && (
          <p className="text-sm text-destructive">Error al generar el reporte. Intente nuevamente.</p>
        )}

        {reporte && (
          <>
            {/* Resumen ejecutivo */}
            <section className="mb-6">
              <h2 className="text-base font-semibold mb-3">Resumen ejecutivo</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Registros de ingreso', value: reporte.totales.num_ingresos, sub: null as string | null },
                  {
                    label: 'Registros de egreso', value: reporte.totales.num_egresos,
                    sub: reporte.totales.num_egresos_no_inventario > 0
                      ? `+${reporte.totales.num_egresos_no_inventario} sin afectar inventario`
                      : null,
                  },
                  { label: 'Unidades recibidas', value: reporte.totales.total_ingresos.toLocaleString('es-VE'), sub: null },
                  {
                    label: 'Unidades despachadas', value: reporte.totales.total_egresos.toLocaleString('es-VE'),
                    sub: reporte.totales.total_egresos_no_inventario > 0
                      ? `+${reporte.totales.total_egresos_no_inventario.toLocaleString('es-VE')} sin afectar inventario`
                      : null,
                  },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold mt-1">{value}</p>
                    {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            </section>

            {/* Resumen por insumo */}
            {reporte.resumen_insumos.length > 0 && (
              <section className="mb-6">
                <h2 className="text-base font-semibold mb-3">Movimientos por insumo</h2>
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Categoría</th>
                        <th className="px-4 py-3 text-left font-medium">Insumo</th>
                        <th className="px-4 py-3 text-right font-medium">Ingresado</th>
                        <th className="px-4 py-3 text-right font-medium">Egresado (inventario)</th>
                        <th className="px-4 py-3 text-right font-medium">Egresado (sin inventario)</th>
                        <th className="px-4 py-3 text-right font-medium">Stock actual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reporte.resumen_insumos.map((fila, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground">{fila.categoria}</td>
                          <td className="px-4 py-2.5 font-medium">{fila.insumo}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-green-700">
                            {fila.total_ingreso.toLocaleString('es-VE')}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-orange-700">
                            {fila.total_egreso.toLocaleString('es-VE')}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {fila.total_egreso_no_inventario.toLocaleString('es-VE')}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                            {fila.stock_actual.toLocaleString('es-VE')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Detalle de movimientos */}
            <section className="mb-6">
              <h2 className="text-base font-semibold mb-3">
                Detalle de movimientos ({reporte.movimientos.length})
              </h2>
              {reporte.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No hay movimientos en el período seleccionado.
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Fecha</th>
                        <th className="px-4 py-3 text-left font-medium">Tipo</th>
                        <th className="px-4 py-3 text-left font-medium">Insumo</th>
                        <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                        <th className="px-4 py-3 text-left font-medium">Destino / Donante</th>
                        <th className="px-4 py-3 text-left font-medium">Registrado por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reporte.movimientos.map((mov) => (
                        <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(mov.fecha_movimiento).toLocaleDateString('es-VE')}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                mov.tipo === 'ingreso'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                            </span>
                            {mov.tipo === 'egreso' && !mov.afecta_inventario && (
                              <span className="ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                                Sin inventario
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-medium">
                            {mov.insumo}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {mov.cantidad.toLocaleString('es-VE')}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {mov.tipo === 'egreso' ? mov.destino : (mov.donante ?? 'Anónimo')}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{mov.registrado_por}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Solicitudes por día */}
            <section className="mb-6">
              <h2 className="text-base font-semibold mb-3">Solicitudes por día</h2>
              {solicitudesPorDia.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No hay solicitudes en el período seleccionado.
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Fecha</th>
                        <th className="px-4 py-3 text-right font-medium">Total</th>
                        <th className="px-4 py-3 text-right font-medium">Pendientes</th>
                        <th className="px-4 py-3 text-right font-medium">Parciales</th>
                        <th className="px-4 py-3 text-right font-medium">Completadas</th>
                        <th className="px-4 py-3 text-right font-medium">Canceladas</th>
                        <th className="px-4 py-3 text-right font-medium">Atendidas sin inventario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {solicitudesPorDia.map((fila) => (
                        <tr key={fila.fecha} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(fila.fecha).toLocaleDateString('es-VE')}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fila.total}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fila.pendientes}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fila.parcialmente_atendidas}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-green-700">{fila.completadas}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-destructive">{fila.canceladas}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {fila.atendidas_sin_inventario > 0 ? fila.atendidas_sin_inventario : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* A dónde van los egresos, por categoría de destino */}
            <section>
              <h2 className="text-base font-semibold mb-3">A dónde van los egresos</h2>
              {egresosPorCategoria.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No hay egresos en el período seleccionado.
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Categoría de destino</th>
                        <th className="px-4 py-3 text-right font-medium">Egresos</th>
                        <th className="px-4 py-3 text-right font-medium">Unidades despachadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {egresosPorCategoria.map((fila) => (
                        <tr key={fila.categoria} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{fila.categoria}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{fila.num_egresos}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-orange-700">
                            {fila.unidades.toLocaleString('es-VE')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
