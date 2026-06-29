import { getPerfil, getMisCentros } from '@/lib/supabase/perfil'
import { SelectorCentroDropdown } from './selector-centro-dropdown'

/**
 * Server Component que se coloca en el encabezado de las páginas,
 * justo al lado del título. Obtiene el perfil y la lista de centros,
 * y renderiza el Dropdown de shadcn/ui.
 */
export async function SelectorCentroHeader() {
  const perfil = await getPerfil()
  if (!perfil) return null

  const centros = await getMisCentros()

  return (
    <SelectorCentroDropdown
      centros={centros}
      centroActivo={perfil.centro_id}
      centroNombre={perfil.centro}
    />
  )
}
