import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BotonAnular } from '@/components/app/boton-anular'

type Perfil = {
  usuario_id: string
  centro_id: string
  centro: string
  rol: string
}

type Movimiento = {
  id: string
  tipo: 'ingreso' | 'egreso'
  cantidad: number
  fecha_movimiento: string
  observaciones: string | null
  anulado: boolean
  anulado_motivo: string | null
  anulado_at: string | null
  insumo: string
  unidad_medida: string
  categoria: string
  registrado_por: string
  destino: string | null
  donante: string | null
}

type Historial = {
  total: number
  pagina: number
  datos: Movimiento[]
}

const puedeAnular = (rol: string) =>
  rol === 'coordinador_centro' || rol === 'administrador_sistema'

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string
    desde?: string
    hasta?: string
    pagina?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: perfilRaw, error: perfilError } = await supabase.rpc('sp_mi_perfil')
  if (perfilError || !perfilRaw) redirect('/dashboard')

  const perfil = perfilRaw as Perfil
  const pagina = parseInt(params.pagina ?? '1', 10)

  const { data: historialRaw } = await supabase.rpc('sp_historial_movimientos', {
    p_centro_id: perfil.centro_id,
    p_tipo: (params.tipo as 'ingreso' | 'egreso') || undefined,
    p_fecha_desde: params.desde || undefined,
    p_fecha_hasta: params.hasta || undefined,
    p_pagina: pagina,
    p_por_pagina: 50,
  })

  const historial = (historialRaw as Historial) ?? { total: 0, pagina: 1, datos: [] }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Historial de movimientos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {perfil.centro} · {historial.total} registro{historial.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 mb-4">
        <select
          name="tipo"
          defaultValue={params.tipo ?? ''}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>

        <input
          type="date"
          name="desde"
          defaultValue={params.desde ?? ''}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          placeholder="Desde"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={params.hasta ?? ''}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          placeholder="Hasta"
        />

        <button
          type="submit"
          className="rounded-md bg-foreground text-background px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Filtrar
        </button>
        <a
          href="/historial"
          className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          Limpiar
        </a>
      </form>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Insumo</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 text-left font-medium">Destino / Donante</th>
              <th className="px-4 py-3 text-left font-medium">Registrado por</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              {puedeAnular(perfil.rol) && (
                <th className="px-4 py-3 text-left font-medium">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {historial.datos.length === 0 ? (
              <tr>
                <td
                  colSpan={puedeAnular(perfil.rol) ? 8 : 7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No hay movimientos para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              historial.datos.map((mov) => (
                <tr
                  key={mov.id}
                  className={`hover:bg-muted/30 transition-colors ${mov.anulado ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(mov.fecha_movimiento).toLocaleDateString('es-VE')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        mov.tipo === 'ingreso'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {mov.insumo}
                    <span className="ml-1 text-xs text-muted-foreground">{mov.unidad_medida}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {mov.cantidad.toLocaleString('es-VE')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {mov.tipo === 'egreso' ? mov.destino : mov.donante}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{mov.registrado_por}</td>
                  <td className="px-4 py-3">
                    {mov.anulado ? (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive"
                        title={mov.anulado_motivo ?? ''}
                      >
                        Anulado
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                        Activo
                      </span>
                    )}
                  </td>
                  {puedeAnular(perfil.rol) && (
                    <td className="px-4 py-3">
                      {!mov.anulado && (
                        <BotonAnular movimientoId={mov.id} />
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación simple */}
      {historial.total > 50 && (
        <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
          <span>
            Página {pagina} de {Math.ceil(historial.total / 50)}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <a
                href={`?tipo=${params.tipo ?? ''}&desde=${params.desde ?? ''}&hasta=${params.hasta ?? ''}&pagina=${pagina - 1}`}
                className="rounded-md border px-3 py-1 hover:bg-muted transition-colors"
              >
                Anterior
              </a>
            )}
            {pagina < Math.ceil(historial.total / 50) && (
              <a
                href={`?tipo=${params.tipo ?? ''}&desde=${params.desde ?? ''}&hasta=${params.hasta ?? ''}&pagina=${pagina + 1}`}
                className="rounded-md border px-3 py-1 hover:bg-muted transition-colors"
              >
                Siguiente
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
