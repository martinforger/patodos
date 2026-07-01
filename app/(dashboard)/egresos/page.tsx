import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { FormularioEgreso } from '@/components/app/formulario-egreso'
import { TablaEgresos } from '@/components/app/tabla-egresos'
import type { FilaEgreso } from '@/components/app/detalle-egreso-dialog'
import type { SolicitudPendienteGrupo } from '@/components/app/formulario-egreso'
import { FiltrosEgresos } from '@/components/app/filtros-egresos'
import { Button } from '@/components/ui/button'

type ListadoEgresos = {
  total: number
  pagina: number
  datos: FilaEgreso[]
}

export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<{
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

  const { data: listadoRaw } = await supabase.rpc('sp_listar_egresos', {
    p_centro_id: perfil.centro_id,
    p_fecha_desde: params.desde || undefined,
    p_fecha_hasta: params.hasta || undefined,
    p_pagina: pagina,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoEgresos) ?? { total: 0, pagina: 1, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos', { p_centro_id: perfil.centro_id })
  const { data: insumos } = await supabase.rpc('sp_listar_insumos', { p_centro_id: perfil.centro_id })
  const { data: categoriasDestino } = await supabase.rpc('sp_listar_categorias_destino', { p_centro_id: perfil.centro_id })
  const { data: solicitudesPendientes } = await supabase.rpc('sp_listar_solicitudes_pendientes', {
    p_centro_id: perfil.centro_id,
    p_insumo_id: undefined,
  })

  const { data: inventarioRaw } = await supabase.rpc('sp_inventario_centro', {
    p_centro_id: perfil.centro_id,
  })

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Egresos</h1>
            <SelectorCentroHeader />
          </div>
          <p className="text-sm text-muted-foreground">
            {listado.total} registro{listado.total !== 1 ? 's' : ''}
          </p>
        </div>
        <FormularioEgreso
          centroId={perfil.centro_id}
          categorias={(categorias as { id: string; nombre: string }[]) ?? []}
          insumos={(insumos as { id: string; font_size?: string; nombre: string; categoria: string }[]) ?? []}
          categoriasDestino={(categoriasDestino as { id: string; nombre: string }[]) ?? []}
          solicitudesPendientes={(solicitudesPendientes as SolicitudPendienteGrupo[]) ?? []}
          inventario={(inventarioRaw as { insumo_id: string; insumo: string; stock: number }[]) ?? []}
        />
      </div>

      <FiltrosEgresos defaultDesde={params.desde} defaultHasta={params.hasta} />

      <TablaEgresos
        filas={listado.datos}
        rolUsuario={perfil.rol}
        centroId={perfil.centro_id}
        categorias={(categorias as { id: string; nombre: string }[]) ?? []}
        insumos={(insumos as { id: string; font_size?: string; nombre: string; categoria: string }[]) ?? []}
        inventario={(inventarioRaw as { insumo_id: string; insumo: string; stock: number }[]) ?? []}
      />

      {/* Paginación simple */}
      {listado.total > 50 && (
        <div className="flex justify-between items-center mt-6 text-sm text-muted-foreground">
          <span>
            Página {pagina} de {Math.ceil(listado.total / 50)}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <a href={`?desde=${params.desde ?? ''}&hasta=${params.hasta ?? ''}&pagina=${pagina - 1}`}>
                  Anterior
                </a>
              </Button>
            )}
            {pagina < Math.ceil(listado.total / 50) && (
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <a href={`?desde=${params.desde ?? ''}&hasta=${params.hasta ?? ''}&pagina=${pagina + 1}`}>
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
