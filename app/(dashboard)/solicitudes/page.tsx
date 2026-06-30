import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { FormularioSolicitud } from '@/components/app/formulario-solicitud'
import { TablaSolicitudes } from '@/components/app/tabla-solicitudes'
import type { FilaSolicitud } from '@/components/app/detalle-solicitud-dialog'

type ListadoSolicitudes = {
  total: number
  pagina: number
  datos: FilaSolicitud[]
}

export default async function SolicitudesPage() {
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  const { data: listadoRaw } = await supabase.rpc('sp_listar_solicitudes', {
    p_centro_id: perfil.centro_id,
    p_estado: undefined,
    p_pagina: 1,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoSolicitudes) ?? { total: 0, pagina: 1, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos')

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold">Solicitudes de ayuda</h1>
            <SelectorCentroHeader />
          </div>
          <p className="text-sm text-muted-foreground">
            {listado.total} registro{listado.total !== 1 ? 's' : ''}
          </p>
        </div>
        <FormularioSolicitud
          centroId={perfil.centro_id}
          categorias={(categorias as { id: string; nombre: string }[]) ?? []}
        />
      </div>

      <TablaSolicitudes filas={listado.datos} />
    </div>
  )
}
