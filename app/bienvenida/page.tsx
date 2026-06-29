import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CrearCentroForm } from './crear-centro-form'

export default async function BienvenidaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Si ya tiene centro asignado, no tiene nada que hacer aquí.
  const { data: perfil } = await supabase.rpc('sp_mi_perfil')
  if (perfil) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Aún no estás en ningún centro</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Para empezar a usar el sistema necesitas pertenecer a un centro de acopio.
            Elige una de estas dos opciones.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opción 1: que un coordinador te agregue */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">1</span>
              <h2 className="font-semibold">Que te agregue un coordinador</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Pídele al coordinador de un centro que te agregue a su equipo usando
              tu correo registrado:
            </p>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium break-all">
              {user.email}
            </div>
            <p className="text-xs text-muted-foreground">
              En cuanto te agregue, recarga la página y tendrás acceso a su centro.
            </p>
          </div>

          {/* Opción 2: crear tu propio centro */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">2</span>
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
