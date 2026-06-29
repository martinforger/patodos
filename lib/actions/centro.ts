'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getMisCentros } from '@/lib/supabase/perfil'

/**
 * Server Action: cambia el centro activo del usuario.
 * Valida que el usuario tenga acceso al centro antes de guardar la cookie.
 */
export async function cambiarCentro(formData: FormData) {
  const centroId = formData.get('centro_id') as string
  if (!centroId) return

  // Validar que el usuario tenga acceso a ese centro
  const centros = await getMisCentros()
  const tieneAcceso = centros.some((c) => c.centro_id === centroId)
  if (!tieneAcceso) return

  const cookieStore = await cookies()
  cookieStore.set('centro_activo', centroId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // Sin maxAge → cookie de sesión; se borra al cerrar el navegador
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
