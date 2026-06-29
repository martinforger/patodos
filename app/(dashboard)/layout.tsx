import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/app/sidebar'
import { AppTour } from '@/components/app/app-tour'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Gate de onboarding: si el usuario no está asignado a ningún centro
  // (y no es admin, que siempre tiene centro) lo mandamos a /bienvenida.
  const { data: perfil } = await supabase.rpc('sp_mi_perfil')
  if (!perfil) redirect('/bienvenida')

  return (
    <AppTour>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main id="tour-content" className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </AppTour>
  )
}
