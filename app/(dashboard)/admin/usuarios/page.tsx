import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AsignarUsuarioForm } from './asignar-usuario-form'

type AsignacionRow = {
  id: string
  rol: string
  activo: boolean
  usuario: { id: string; nombre: string; apellido: string; correo: string }
  centro: { id: string; nombre: string }
}

type CentroItem = { id: string; nombre: string }
type UsuarioItem = { id: string; nombre: string; apellido: string; correo: string }

const rolLabel: Record<string, string> = {
  administrador_sistema: 'Administrador',
  coordinador_centro: 'Coordinador',
  operador_inventario: 'Operador',
}

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [asigResult, centrosResult, usuariosResult] = await Promise.all([
    supabase.rpc('sp_listar_usuarios_centros'),
    supabase.rpc('sp_listar_centros'),
    supabase.rpc('sp_listar_usuarios'),
  ])

  const asignaciones = (asigResult.data as AsignacionRow[]) ?? []
  const centros = (centrosResult.data as CentroItem[]) ?? []
  const usuarios = (usuariosResult.data as UsuarioItem[]) ?? []

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Asigna usuarios a centros con un rol</p>
        </div>
        <AsignarUsuarioForm centros={centros} usuarios={usuarios} />
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Usuario</th>
              <th className="px-4 py-3 text-left font-medium">Correo</th>
              <th className="px-4 py-3 text-left font-medium">Centro</th>
              <th className="px-4 py-3 text-left font-medium">Rol</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {asignaciones.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No hay usuarios asignados a centros aún.
                </td>
              </tr>
            ) : (
              asignaciones.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {a.usuario.nombre} {a.usuario.apellido}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.usuario.correo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.centro.nombre}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {rolLabel[a.rol] ?? a.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {a.activo ? 'Activo' : 'Inactivo'}
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
