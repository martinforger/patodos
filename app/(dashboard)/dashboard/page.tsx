import Link from 'next/link'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'

type KPIs = {
  centros_activos: number
  ingresos_hoy: number
  egresos_hoy: number
  egresos_hoy_no_inventario: number
  solicitudes_pendientes: number
  ingresos_semana: number
  egresos_semana: number
  egresos_semana_no_inventario: number
}

export default async function DashboardPage() {
  const perfil = await getPerfil()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: panelRaw } = await supabase.rpc('sp_resumen_panel')
  const panel = panelRaw as { kpis: KPIs } | null

  const kpis = panel?.kpis ?? null

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold">Panel principal</h1>
        <SelectorCentroHeader />
      </div>
      <p className="text-muted-foreground text-sm mb-6">{user?.email}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Ingresos hoy',            value: kpis ? kpis.ingresos_hoy            : '—', color: kpis ? 'text-green-700'  : '', sub: null as string | null },
          {
            label: 'Egresos hoy', value: kpis ? kpis.egresos_hoy : '—', color: kpis ? 'text-orange-700' : '',
            sub: kpis && kpis.egresos_hoy_no_inventario > 0
              ? `+${kpis.egresos_hoy_no_inventario} sin afectar inventario`
              : null,
          },
          { label: 'Solicitudes pendientes',  value: kpis ? kpis.solicitudes_pendientes  : '—', color: kpis ? 'text-yellow-700' : '', sub: null },
          { label: 'Centros activos',         value: kpis ? kpis.centros_activos         : '—', color: '', sub: null },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Ingresos esta semana</p>
            <p className="text-3xl font-bold mt-1 text-green-700">{kpis.ingresos_semana}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Egresos esta semana</p>
            <p className="text-3xl font-bold mt-1 text-orange-700">{kpis.egresos_semana}</p>
            {kpis.egresos_semana_no_inventario > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                +{kpis.egresos_semana_no_inventario} sin afectar inventario
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/ingresos"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          Registrar ingreso
        </Link>
        <Link
          href="/egresos"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          Registrar egreso
        </Link>
        <Link
          href="/solicitudes"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          Nueva solicitud
        </Link>
        <Link
          href="/reportes"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          Ver reporte
        </Link>
      </div>
    </div>
  )
}
