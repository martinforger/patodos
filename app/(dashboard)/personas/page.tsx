import { BuscadorPersonas } from '@/components/app/buscador-personas'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type Perfil = {
  usuario_id: string
  centro_id: string
  centro: string
  rol: string
}

export default async function PersonasPage() {
  const supabase = await createClient()

  const { data: perfilRaw, error: perfilError } = await supabase.rpc('sp_mi_perfil')
  if (perfilError || !perfilRaw) redirect('/dashboard')

  const perfil = perfilRaw as Perfil

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Personas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {perfil.centro} · Busca donantes, solicitantes y contactos registrados
        </p>
      </div>

      <BuscadorPersonas centroId={perfil.centro_id} />
    </div>
  )
}
