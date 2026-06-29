'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function BotonCerrarSesion() {
  const router = useRouter()

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={cerrarSesion}
      className="underline hover:text-foreground transition-colors cursor-pointer focus:outline-none"
    >
      Cerrar sesión
    </button>
  )
}
