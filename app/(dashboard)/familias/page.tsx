import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'
import { createClient } from '@/lib/supabase/server'
import { FormularioFamilia } from '@/components/app/formulario-familia'
import { TablaFamilias } from '@/components/app/tabla-familias'
import type { FilaFamilia } from '@/components/app/detalle-familia-dialog'

export default async function FamiliasPage() {
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  const { data } = await supabase.rpc('sp_listar_grupos_familiares', {
    p_centro_id: perfil.centro_id,
  })
  const filas = (data as unknown as FilaFamilia[]) ?? []

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold">Grupos familiares</h1>
            <SelectorCentroHeader />
          </div>
          <p className="text-sm text-muted-foreground">
            {filas.length} familia{filas.length !== 1 ? 's' : ''} registrada{filas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <FormularioFamilia centroId={perfil.centro_id} />
      </div>

      <TablaFamilias filas={filas} centroId={perfil.centro_id} />
    </div>
  )
}
