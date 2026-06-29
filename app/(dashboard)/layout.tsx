import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/supabase/perfil'
import { Sidebar } from '@/components/app/sidebar'
import { MobileNav } from '@/components/app/mobile-nav'
import { AppTour } from '@/components/app/app-tour'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Obtiene perfil respetando el centro activo en cookie
  const perfil = await getPerfil()
  if (!perfil) redirect('/bienvenida')

  return (
    <AppTour userId={user.id}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar rol={perfil.rol} />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Barra superior móvil */}
          <header className="flex md:hidden items-center gap-3 border-b bg-sidebar px-4 py-3 shrink-0">
            <MobileNav rol={perfil.rol} />
            <span className="font-bold text-sm text-sidebar-foreground">Ayuda Humanitaria</span>
          </header>
          <main id="tour-content" className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AppTour>
  )
}
