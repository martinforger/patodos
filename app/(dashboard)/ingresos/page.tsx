import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { FormularioIngreso } from '@/components/app/formulario-ingreso'
import { TablaIngresos } from '@/components/app/tabla-ingresos'
import type { FilaIngreso } from '@/components/app/detalle-ingreso-dialog'

type ListadoIngresos = {
  total: number
  pagina: number
  datos: FilaIngreso[]
}

export default async function IngresosPage() {
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  const { data: listadoRaw } = await supabase.rpc('sp_listar_ingresos', {
    p_centro_id: perfil.centro_id,
    p_pagina: 1,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoIngresos) ?? { total: 0, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos')

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold">Ingresos</h1>
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

      <TablaIngresos filas={listado.datos} />
    </div>
  )
}
