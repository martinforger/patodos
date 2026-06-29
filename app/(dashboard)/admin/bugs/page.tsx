import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CambiarEstadoBug } from './cambiar-estado-bug'

type Estado = 'por_revisar' | 'en_proceso' | 'solucionado'

type ReporteBug = {
  id: string
  titulo: string
  descripcion: string
  pagina: string | null
  estado: Estado
  created_at: string
  usuario: {
    nombre: string
    apellido: string
    correo: string
  }
}

const etiquetaEstado: Record<Estado, string> = {
  por_revisar: 'Por revisar',
  en_proceso: 'En proceso',
  solucionado: 'Solucionado',
}

async function getReportes(): Promise<ReporteBug[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('sp_listar_reportes_bug')
  if (error) throw new Error(error.message)
  return (data as ReporteBug[]) ?? []
}

export default async function BugsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const reportes = await getReportes()

  const conteos: Record<Estado, number> = { por_revisar: 0, en_proceso: 0, solucionado: 0 }
  for (const r of reportes) conteos[r.estado]++

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reportes de bugs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {reportes.length} {reportes.length === 1 ? 'reporte' : 'reportes'} en total
        </p>
      </div>

      {/* Resumen de estados */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border bg-yellow-50 px-4 py-3">
          <p className="text-xs text-yellow-700 font-medium">Por revisar</p>
          <p className="text-2xl font-bold text-yellow-800 mt-0.5">{conteos.por_revisar}</p>
        </div>
        <div className="rounded-lg border bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-700 font-medium">En proceso</p>
          <p className="text-2xl font-bold text-blue-800 mt-0.5">{conteos.en_proceso}</p>
        </div>
        <div className="rounded-lg border bg-green-50 px-4 py-3">
          <p className="text-xs text-green-700 font-medium">Solucionados</p>
          <p className="text-2xl font-bold text-green-800 mt-0.5">{conteos.solucionado}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Título</th>
              <th className="px-4 py-3 text-left font-medium">Reportado por</th>
              <th className="px-4 py-3 text-left font-medium">Página</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No hay reportes de bugs aún.
                </td>
              </tr>
            ) : (
              reportes.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors align-top">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium">{r.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{r.descripcion}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p>{r.usuario.nombre} {r.usuario.apellido}</p>
                    <p className="text-xs text-muted-foreground">{r.usuario.correo}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {r.pagina ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('es-VE', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <CambiarEstadoBug bugId={r.id} estadoActual={r.estado} />
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
