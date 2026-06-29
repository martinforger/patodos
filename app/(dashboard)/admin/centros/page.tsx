import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormularioCentro } from './formulario-centro'
import { ToggleVisibilidad } from './toggle-visibilidad'

type Centro = {
  id: string
  nombre: string
  municipio: string
  estado_geo: string
  telefono: string | null
  activo: boolean
  es_publico: boolean
}

async function getCentros(): Promise<Centro[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('sp_listar_centros')
  if (error) throw new Error(error.message)
  return (data as Centro[]) ?? []
}

export default async function CentrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const centros = await getCentros()

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Centros de acopio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Solo administrador del sistema</p>
        </div>
        <FormularioCentro />
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Municipio</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Teléfono</th>
              <th className="px-4 py-3 text-left font-medium">Visibilidad</th>
              <th className="px-4 py-3 text-left font-medium">Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {centros.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No hay centros registrados aún.
                </td>
              </tr>
            ) : (
              centros.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.municipio}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.estado_geo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.telefono ?? '—'}</td>
                  <td className="px-4 py-3">
                    <ToggleVisibilidad centroId={c.id} esPublico={c.es_publico} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.activo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
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
