import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { FormularioSolicitud } from '@/components/app/formulario-solicitud'
import { TablaSolicitudes } from '@/components/app/tabla-solicitudes'
import type { FilaSolicitud } from '@/components/app/detalle-solicitud-dialog'
import { FiltrosSolicitudes } from '@/components/app/filtros-solicitudes'
import { Button } from '@/components/ui/button'

type ListadoSolicitudes = {
  total: number
  pagina: number
  datos: FilaSolicitud[]
}

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string
    desde?: string
    hasta?: string
    pagina?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  const pagina = parseInt(params.pagina ?? '1', 10)

  const { data: listadoRaw } = await supabase.rpc('sp_listar_solicitudes', {
    p_centro_id: perfil.centro_id,
    p_estado: params.estado || undefined,
    p_fecha_desde: params.desde || undefined,
    p_fecha_hasta: params.hasta || undefined,
    p_pagina: pagina,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoSolicitudes) ?? { total: 0, pagina: 1, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos', { p_centro_id: perfil.centro_id })

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Solicitudes de ayuda</h1>
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

      <FiltrosSolicitudes
        defaultEstado={params.estado}
        defaultDesde={params.desde}
        defaultHasta={params.hasta}
      />

      <TablaSolicitudes filas={listado.datos} />

      {/* Paginación simple */}
      {listado.total > 50 && (
        <div className="flex justify-between items-center mt-6 text-sm text-muted-foreground">
          <span>
            Página {pagina} de {Math.ceil(listado.total / 50)}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <a href={`?estado=${params.estado ?? ''}&desde=${params.desde ?? ''}&hasta=${params.hasta ?? ''}&pagina=${pagina - 1}`}>
                  Anterior
                </a>
              </Button>
            )}
            {pagina < Math.ceil(listado.total / 50) && (
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <a href={`?estado=${params.estado ?? ''}&desde=${params.desde ?? ''}&hasta=${params.hasta ?? ''}&pagina=${pagina + 1}`}>
                  Siguiente
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
