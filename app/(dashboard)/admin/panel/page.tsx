import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type KPIs = {
  centros_activos: number
  ingresos_hoy: number
  egresos_hoy: number
  solicitudes_pendientes: number
  ingresos_semana: number
  egresos_semana: number
}

type Centro = {
  id: string
  nombre: string
  municipio: string
  estado_geo: string
  ingresos_semana: number
  egresos_semana: number
  solicitudes_pendientes: number
  insumos_con_stock: number
}

type ResumenPanel = {
  kpis: KPIs
  centros: Centro[]
}

export default async function PanelGeneralPage() {
  const supabase = await createClient()

  const { data: panelRaw, error } = await supabase.rpc('sp_resumen_panel')

  if (error) {
    if (error.message.includes('administrador')) redirect('/dashboard')
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Panel general</h1>
        <p className="text-sm text-destructive">Error al cargar el panel: {error.message}</p>
      </div>
    )
  }

  const panel = panelRaw as ResumenPanel

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Panel general</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Vista multi-centro · {panel.centros.length} centro{panel.centros.length !== 1 ? 's' : ''} activo{panel.centros.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPIs globales */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">Actividad global</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Centros activos',        value: panel.kpis.centros_activos,       color: '' },
            { label: 'Ingresos hoy',           value: panel.kpis.ingresos_hoy,          color: 'text-green-700' },
            { label: 'Egresos hoy',            value: panel.kpis.egresos_hoy,           color: 'text-orange-700' },
            { label: 'Ingresos esta semana',   value: panel.kpis.ingresos_semana,       color: 'text-green-700' },
            { label: 'Egresos esta semana',    value: panel.kpis.egresos_semana,        color: 'text-orange-700' },
            { label: 'Solicitudes pendientes', value: panel.kpis.solicitudes_pendientes, color: 'text-yellow-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Actividad por centro */}
      <section>
        <h2 className="text-base font-semibold mb-3">Actividad por centro (últimos 7 días)</h2>
        {panel.centros.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay centros activos registrados.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Centro</th>
                  <th className="px-4 py-3 text-left font-medium">Ubicación</th>
                  <th className="px-4 py-3 text-right font-medium">Ingresos</th>
                  <th className="px-4 py-3 text-right font-medium">Egresos</th>
                  <th className="px-4 py-3 text-right font-medium">Pendientes</th>
                  <th className="px-4 py-3 text-right font-medium">Insumos c/stock</th>
                  <th className="px-4 py-3 text-left font-medium">Reporte</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {panel.centros.map((centro) => (
                  <tr key={centro.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{centro.nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {centro.municipio}, {centro.estado_geo}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">
                      {centro.ingresos_semana}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-700 font-semibold">
                      {centro.egresos_semana}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {centro.solicitudes_pendientes > 0 ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                          {centro.solicitudes_pendientes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {centro.insumos_con_stock}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reportes?centro=${centro.id}`}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Ver reporte
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
