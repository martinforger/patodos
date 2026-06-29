import { cookies } from 'next/headers'
import { createClient } from './server'

export type Perfil = {
  usuario_id: string
  nombre: string
  apellido: string
  correo: string
  centro_id: string
  centro: string
  rol: string
}

export type CentroResumen = {
  centro_id: string
  centro: string
  rol: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lee el centro activo desde la cookie. */
export async function getCentroActivo(): Promise<string | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get('centro_activo')?.value ?? null
  if (val && UUID_REGEX.test(val)) {
    return val
  }
  return null
}

/**
 * Retorna el perfil del usuario autenticado.
 * Si hay un centro_activo en cookie, lo usa; si no, retorna el de mayor jerarquía.
 */
export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient()
  const centroActivo = await getCentroActivo()

  const params = centroActivo ? { p_centro_id: centroActivo } : undefined
  const { data, error } = await supabase.rpc('sp_mi_perfil', params)

  if (error) {
    console.error('Error al obtener perfil en helper getPerfil:', error)
  }

  if (error || !data) return null
  return data as Perfil
}

/**
 * Retorna todos los centros a los que pertenece el usuario autenticado.
 */
export async function getMisCentros(): Promise<CentroResumen[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('sp_mis_centros')
  if (error || !data) return []
  return data as CentroResumen[]
}
