import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CrearCentroForm } from './crear-centro-form'
import { UnirseCentroForm } from './unirse-centro-form'

type SolicitudUnion = {
  id: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  centro_nombre: string
  municipio: string
  estado_geo: string
}

export default async function BienvenidaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase.rpc('sp_mi_perfil')
  if (perfil) redirect('/dashboard')

  const { data: solicitudesRaw } = await supabase.rpc('sp_mis_solicitudes_union')
  const solicitudes = (solicitudesRaw as SolicitudUnion[] | null) ?? []
  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente')

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Aún no estás en ningún centro</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Para empezar a usar el sistema necesitas pertenecer a un centro de acopio.
            Elige una de estas opciones.
          </p>
        </div>

        {pendientes.length > 0 && (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 space-y-1">
            <p className="text-sm font-semibold text-yellow-800">
              Tienes {pendientes.length === 1 ? 'una solicitud pendiente' : `${pendientes.length} solicitudes pendientes`}
            </p>
            <ul className="text-sm text-yellow-700 space-y-0.5">
              {pendientes.map((s) => (
                <li key={s.id}>· {s.centro_nombre} — {s.municipio}, {s.estado_geo}</li>
              ))}
            </ul>
            <p className="text-xs text-yellow-600 mt-1">
              El coordinador debe aprobar tu solicitud. Recarga la página para verificar si ya fuiste aceptado.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Opción 1: unirse a un centro público */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">1</span>
              <h2 className="font-semibold">Unirte a un centro público</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Solicita unirte a un centro de acopio. El coordinador aprobará tu acceso.
            </p>
            <UnirseCentroForm />
          </div>

          {/* Opción 2: que un coordinador te agregue */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">2</span>
              <h2 className="font-semibold">Que te agregue un coordinador</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Si el centro al que perteneces es privado, pídele al coordinador que te agregue usando tu correo:
            </p>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium break-all">
              {user.email}
            </div>
            <p className="text-xs text-muted-foreground">
              En cuanto te agregue, recarga la página y tendrás acceso.
            </p>
          </div>

          {/* Opción 3: crear tu propio centro */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">3</span>
              <h2 className="font-semibold">Crear un centro de acopio</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Si vas a coordinar un centro nuevo, créalo aquí. Quedarás registrado
              como <strong>coordinador</strong> y podrás invitar a tu equipo.
            </p>
            <CrearCentroForm />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿No eres tú? <a href="/login" className="underline">Cerrar sesión</a>
        </p>
      </div>
    </main>
  )
}
