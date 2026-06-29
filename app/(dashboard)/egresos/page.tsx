import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormularioEgreso } from '@/components/app/formulario-egreso'

type Perfil = {
  usuario_id: string
  centro_id: string
  centro: string
  rol: string
}

type Egreso = {
  id: string
  fecha_movimiento: string
  cantidad: number
  unidad_medida: string
  insumo: string
  destino: string
  persona_contacto: string
  responsables: string[]
  registrado_por: string
  observaciones: string | null
  anulado: boolean
}

type ListadoEgresos = {
  total: number
  pagina: number
  datos: Egreso[]
}

export default async function EgresosPage() {
  const supabase = await createClient()

  const { data: perfilRaw, error: perfilError } = await supabase.rpc('sp_mi_perfil')
  if (perfilError || !perfilRaw) redirect('/dashboard')

  const perfil = perfilRaw as Perfil

  const { data: listadoRaw } = await supabase.rpc('sp_listar_egresos', {
    p_centro_id: perfil.centro_id,
    p_pagina: 1,
    p_por_pagina: 50,
  })

  const listado = (listadoRaw as ListadoEgresos) ?? { total: 0, pagina: 1, datos: [] }

  const { data: categorias } = await supabase.rpc('sp_listar_categorias_insumos')
  const { data: insumos } = await supabase.rpc('sp_listar_insumos', { p_categoria_id: undefined })
  const { data: destinos } = await supabase.rpc('sp_listar_destinos')
  const { data: solicitudesPendientes } = await supabase.rpc('sp_listar_solicitudes_pendientes', {
    p_centro_id: perfil.centro_id,
    p_insumo_id: undefined,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Egresos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {perfil.centro} · {listado.total} registro{listado.total !== 1 ? 's' : ''}
          </p>
        </div>
        <FormularioEgreso
          centroId={perfil.centro_id}
          categorias={(categorias as { id: string; nombre: string }[]) ?? []}
          insumos={(insumos as { id: string; nombre: string; unidad_medida: string; categoria: string }[]) ?? []}
          destinos={(destinos as { id: string; nombre: string; municipio: string; estado_geo: string }[]) ?? []}
          solicitudesPendientes={(solicitudesPendientes as { id: string; insumo: string; unidad_medida: string; cantidad_solicitada: number; solicitante: string; fecha_solicitud: string; estado: string }[]) ?? []}
        />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Insumo</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 text-left font-medium">Destino</th>
              <th className="px-4 py-3 text-left font-medium">Responsables</th>
              <th className="px-4 py-3 text-left font-medium">Registrado por</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listado.datos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No hay egresos registrados aún.
                </td>
              </tr>
            ) : (
              listado.datos.map((eg) => (
                <tr
                  key={eg.id}
                  className={`hover:bg-muted/30 transition-colors ${eg.anulado ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(eg.fecha_movimiento).toLocaleDateString('es-VE')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {eg.insumo}
                    <span className="ml-1 text-xs text-muted-foreground">{eg.unidad_medida}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {eg.cantidad.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{eg.destino}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {eg.responsables && eg.responsables.length > 0 ? eg.responsables.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{eg.registrado_por}</td>
                  <td className="px-4 py-3">
                    {eg.anulado ? (
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
