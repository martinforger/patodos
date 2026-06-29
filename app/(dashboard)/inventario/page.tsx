import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FiltroCategoria } from '@/components/app/filtro-categoria'

type Perfil = {
  usuario_id: string
  centro_id: string
  centro: string
  rol: string
}

type ItemInventario = {
  id: string
  insumo_id: string
  insumo: string
  categoria_id: string
  categoria: string
  stock: number
  updated_at: string
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: perfilRaw, error: perfilError } = await supabase.rpc('sp_mi_perfil')
  if (perfilError || !perfilRaw) redirect('/dashboard')

  const perfil = perfilRaw as Perfil

  const { data: inventarioRaw } = await supabase.rpc('sp_inventario_centro', {
    p_centro_id: perfil.centro_id,
  })

  const inventario = (inventarioRaw as ItemInventario[]) ?? []

  const categorias = Array.from(new Set(inventario.map((i) => i.categoria))).sort()

  const filtrado = params.categoria
    ? inventario.filter((i) => i.categoria === params.categoria)
    : inventario

  const sinStock = filtrado.filter((i) => i.stock === 0).length

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {perfil.centro} · {filtrado.length} insumo{filtrado.length !== 1 ? 's' : ''}
            {sinStock > 0 && (
              <span className="ml-2 text-destructive font-medium">· {sinStock} sin stock</span>
            )}
          </p>
        </div>
      </div>

      <FiltroCategoria categorias={categorias} categoriaActual={params.categoria} />

      <div className="mt-4 rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Insumo</th>
              <th className="px-4 py-3 text-left font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Stock</th>
              <th className="px-4 py-3 text-left font-medium">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtrado.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No hay insumos registrados en el inventario.
                </td>
              </tr>
            ) : (
              filtrado.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.insumo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.categoria}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${item.stock === 0 ? 'text-destructive' : ''}`}>
                    {item.stock.toLocaleString('es-VE')}
                    {item.stock === 0 && (
                      <span className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                        Sin stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(item.updated_at).toLocaleDateString('es-VE')}
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
