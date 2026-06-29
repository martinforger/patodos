import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InvitarUsuarioForm } from './invitar-usuario-form'
import { CrearCentroForm } from '@/app/bienvenida/crear-centro-form'

type Centro = { id: string; nombre: string }
type Integrante = {
  id: string
  nombre: string
  apellido: string
  correo: string
  rol: string
  activo: boolean
}

const rolLabel: Record<string, string> = {
  administrador_sistema: 'Administrador',
  coordinador_centro: 'Coordinador',
  operador_inventario: 'Operador',
}

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: centrosRaw } = await supabase.rpc('sp_mis_centros_coordinados')
  const centros = (centrosRaw as Centro[] | null) ?? []

  // Equipo de cada centro coordinado
  const equipos = await Promise.all(
    centros.map(async (c) => {
      const { data } = await supabase.rpc('sp_listar_equipo', { p_centro_id: c.id })
      return { centro: c, integrantes: (data as Integrante[] | null) ?? [] }
    }),
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Invita a usuarios registrados a los centros que coordinas, usando su correo.
        </p>
      </div>

      <div className="mb-8 rounded-lg border bg-card p-5 max-w-md">
        <h2 className="font-semibold mb-1">Crear un centro nuevo</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Crea otro centro de acopio. Quedarás como coordinador del nuevo centro.
        </p>
        <CrearCentroForm redirectTo="/equipo" label="+ Nuevo centro de acopio" />
      </div>

      {centros.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Aún no coordinas ningún centro. Crea uno arriba o pide que un coordinador te agregue.
        </div>
      ) : (
        <div className="space-y-8">
          {equipos.map(({ centro, integrantes }) => (
            <section key={centro.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{centro.nombre}</h2>
                <InvitarUsuarioForm centroId={centro.id} />
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Nombre</th>
                      <th className="px-4 py-3 text-left font-medium">Correo</th>
                      <th className="px-4 py-3 text-left font-medium">Rol</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {integrantes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          Sin integrantes todavía.
                        </td>
                      </tr>
                    ) : (
                      integrantes.map((i) => (
                        <tr key={i.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{i.nombre} {i.apellido}</td>
                          <td className="px-4 py-3 text-muted-foreground">{i.correo}</td>
                          <td className="px-4 py-3">{rolLabel[i.rol] ?? i.rol}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              i.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                            }`}>
                              {i.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
