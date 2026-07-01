import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { FormularioVoluntario } from './formulario-voluntario'
import { TablaVoluntarios } from './tabla-voluntarios'
import { QrAsistencia } from './qr-asistencia'

type ComidaEstado = {
  numero: number
  elegible_desde: string
  elegible: boolean
  comio: boolean
  marcado: boolean
}

type AsistenciaHoy = {
  id: string
  hora_checkin: string
  comidas: ComidaEstado[]
} | null

export type Voluntario = {
  id: string
  nombres: string
  apellidos: string
  nacionalidad: string
  cedula_numero: string
  telefono: string
  activo: boolean
  turno: string | null
  tiene_laptop: boolean
  tiene_vehiculo: boolean
  vinculo_ucab: string | null
  carrera: string | null
  asistencia_hoy: AsistenciaHoy
}

export default async function VoluntariosPage() {
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  const { data: voluntariosRaw } = await supabase.rpc('sp_listar_voluntarios', {
    p_centro_id: perfil.centro_id,
  })

  const voluntarios = (voluntariosRaw as Voluntario[]) ?? []
  const total = voluntarios.length
  const hoyCount = voluntarios.filter((v) => v.asistencia_hoy !== null).length
  const elegiblesCount = voluntarios.filter((v) =>
    v.asistencia_hoy?.comidas?.some((c) => c.elegible && !c.comio)
  ).length

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold">Voluntarios</h1>
            <SelectorCentroHeader />
          </div>
          <p className="text-sm text-muted-foreground">
            {total} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QrAsistencia centroId={perfil.centro_id} />
          <FormularioVoluntario centroId={perfil.centro_id} />
        </div>
      </div>

      {/* Métricas del día */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Hoy presentes</p>
          <p className="text-2xl font-bold mt-1">{hoyCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total registrados</p>
          <p className="text-2xl font-bold mt-1">{total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Elegibles ahora</p>
          <p className={`text-2xl font-bold mt-1 ${elegiblesCount > 0 ? 'text-amber-600' : ''}`}>
            {elegiblesCount}
          </p>
        </div>
      </div>

      <TablaVoluntarios voluntarios={voluntarios} />
    </div>
  )
}
