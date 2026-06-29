import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormularioDestino } from './formulario-destino'

type Destino = {
  id: string
  nombre: string
  direccion: string
  municipio: string
  estado_geo: string
  referencia: string | null
}

async function getDestinos(): Promise<Destino[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('sp_listar_destinos')
  if (error) throw new Error(error.message)
  return (data as Destino[]) ?? []
}

export default async function DestinosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const destinos = await getDestinos()

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Destinos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Lugares a donde se despachan los egresos.
          </p>
        </div>
        <FormularioDestino />
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Dirección</th>
              <th className="px-4 py-3 text-left font-medium">Municipio</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Referencia</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {destinos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No hay destinos registrados aún.
                </td>
              </tr>
            ) : (
              destinos.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{d.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.direccion}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.municipio}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.estado_geo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.referencia ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
