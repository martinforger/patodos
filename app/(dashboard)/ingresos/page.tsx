import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormularioIngreso } from '@/components/app/formulario-ingreso'

type Perfil = {
  usuario_id: string
  centro_id: string
  centro: string
  rol: string
}

type Ingreso = {
  id: string
  fecha_movimiento: string
  cantidad: number
  insumo: string
  donante: string
  registrado_por: string
  observaciones: string | null
  anulado: boolean
}

type ListadoIngresos = {
  total: number
  pagina: number
  datos: Ingreso[]
}

export default async function IngresosPage() {
  const supabase = await createClient()

  const { data: perfilRaw, error: perfilError } = await supabase.rpc('sp_mi_perfil')
  if (perfilError || !perfilRaw) redirect('/dashboard')

  const perfil = perfilRaw as Perfil

  const { data: listadoRaw } = await supabase.rpc('sp_listar_ingresos', {
    p_centro_id: perfil.centro_id,
    p_pagina: 1,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoIngresos) ?? { total: 0, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos')
  const { data: insumos } = await supabase.rpc('sp_listar_insumos', { p_categoria_id: undefined })

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ingresos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {perfil.centro} · {listado.total} registro{listado.total !== 1 ? 's' : ''}
          </p>
        </div>
        <FormularioIngreso
          centroId={perfil.centro_id}
          categorias={(categorias as { id: string; nombre: string }[]) ?? []}
          insumos={(insumos as { id: string; nombre: string; categoria: string }[]) ?? []}
        />
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Insumo</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 text-left font-medium">Donante</th>
              <th className="px-4 py-3 text-left font-medium">Registrado por</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listado.datos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No hay ingresos registrados aún.
                </td>
              </tr>
            ) : (
              listado.datos.map((ing) => (
                <tr
                  key={ing.id}
                  className={`hover:bg-muted/30 transition-colors ${ing.anulado ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(ing.fecha_movimiento).toLocaleDateString('es-VE')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {ing.insumo}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {ing.cantidad.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ing.donante}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ing.registrado_por}</td>
                  <td className="px-4 py-3">
                    {ing.anulado ? (
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
    </div>
  )
}
