import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { FormularioIngreso } from '@/components/app/formulario-ingreso'
import { TablaIngresos } from '@/components/app/tabla-ingresos'
import type { FilaIngreso } from '@/components/app/detalle-ingreso-dialog'
import { FiltrosIngresos } from '@/components/app/filtros-ingresos'
import { Button } from '@/components/ui/button'

type ListadoIngresos = {
  total: number
  pagina: number
  datos: FilaIngreso[]
}

export default async function IngresosPage({
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

  const { data: listadoRaw } = await supabase.rpc('sp_listar_ingresos', {
    p_centro_id: perfil.centro_id,
    p_fecha_desde: params.desde || undefined,
    p_fecha_hasta: params.hasta || undefined,
    p_pagina: pagina,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoIngresos) ?? { total: 0, pagina: 1, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos', { p_centro_id: perfil.centro_id })

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Ingresos</h1>
            <SelectorCentroHeader />
          </div>
          <p className="text-sm text-muted-foreground">
            {listado.total} registro{listado.total !== 1 ? 's' : ''}
          </p>
        </div>
        <FormularioIngreso
          centroId={perfil.centro_id}
          categorias={(categorias as { id: string; nombre: string }[]) ?? []}
        />
      </div>

      <FiltrosIngresos defaultDesde={params.desde} defaultHasta={params.hasta} />

      <TablaIngresos filas={listado.datos} />

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
