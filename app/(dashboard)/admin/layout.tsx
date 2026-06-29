import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: perfil } = await supabase.rpc('sp_mi_perfil')

  if (!perfil || perfil.rol !== 'administrador_sistema') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
