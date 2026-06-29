import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/app/sidebar'
import { AppTour } from '@/components/app/app-tour'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
