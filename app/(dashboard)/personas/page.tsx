import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { BuscadorPersonas } from '@/components/app/buscador-personas'

export default async function PersonasPage() {
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold">Personas</h1>
          <SelectorCentroHeader />
        </div>
        <p className="text-sm text-muted-foreground">
          Busca donantes, solicitantes y contactos registrados
        </p>
      </div>

      <BuscadorPersonas centroId={perfil.centro_id} />
    </div>
  )
}
