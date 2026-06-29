import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormularioSolicitud } from '@/components/app/formulario-solicitud'

type Perfil = {
  usuario_id: string
  centro_id: string
  centro: string
  rol: string
}

type Solicitud = {
  id: string
  fecha_solicitud: string
  cantidad_solicitada: number
  cantidad_despachada: number
  insumo: string
  solicitante: string
  solicitante_telefono: string
  estado: 'pendiente' | 'parcialmente_atendida' | 'completada' | 'cancelada'
  registrado_por: string
  observaciones: string | null
}

type ListadoSolicitudes = {
  total: number
  pagina: number
  datos: Solicitud[]
}

const estadoBadge: Record<Solicitud['estado'], string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  parcialmente_atendida: 'bg-blue-100 text-blue-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-destructive/10 text-destructive',
}

const estadoLabel: Record<Solicitud['estado'], string> = {
  pendiente: 'Pendiente',
  parcialmente_atendida: 'Parcial',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export default async function SolicitudesPage() {
  const supabase = await createClient()

  const { data: perfilRaw, error: perfilError } = await supabase.rpc('sp_mi_perfil')
  if (perfilError || !perfilRaw) redirect('/dashboard')

  const perfil = perfilRaw as Perfil

  const { data: listadoRaw } = await supabase.rpc('sp_listar_solicitudes', {
    p_centro_id: perfil.centro_id,
    p_estado: undefined,
    p_pagina: 1,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoSolicitudes) ?? { total: 0, pagina: 1, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos')
  const { data: insumos } = await supabase.rpc('sp_listar_insumos', { p_categoria_id: undefined })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de ayuda</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {perfil.centro} · {listado.total} registro{listado.total !== 1 ? 's' : ''}
          </p>
        </div>
        <FormularioSolicitud
          centroId={perfil.centro_id}
          categorias={(categorias as { id: string; nombre: string }[]) ?? []}
          insumos={(insumos as { id: string; nombre: string; categoria: string }[]) ?? []}
        />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Insumo</th>
              <th className="px-4 py-3 text-right font-medium">Solicitado</th>
              <th className="px-4 py-3 text-right font-medium">Despachado</th>
              <th className="px-4 py-3 text-left font-medium">Solicitante</th>
              <th className="px-4 py-3 text-left font-medium">Registrado por</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listado.datos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No hay solicitudes registradas aún.
                </td>
              </tr>
            ) : (
              listado.datos.map((sol) => (
                <tr key={sol.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(sol.fecha_solicitud).toLocaleDateString('es-VE')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {sol.insumo}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {sol.cantidad_solicitada.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {sol.cantidad_despachada.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{sol.solicitante}</p>
                    <p className="text-xs text-muted-foreground">{sol.solicitante_telefono}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sol.registrado_por}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoBadge[sol.estado]}`}>
                      {estadoLabel[sol.estado]}
                    </span>
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
