import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/perfil'
import { createClient } from '@/lib/supabase/server'
import { SelectorCentroHeader } from '@/components/app/selector-centro-header'

export type InsumoDetalle = {
  id: string
  nombre: string
  categoria_id: string
  categoria: string
  unidad_medida: string | null
  presentacion: string | null
  activo: boolean
}

export type CategoriaDetalle = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  num_insumos: number
}

export default async function InsumosPage() {
  const supabase = await createClient()

  const perfil = await getPerfil()
  if (!perfil) redirect('/dashboard')

  // Listar todas las categorías del centro (activas e inactivas)
  const { data: categoriasRaw } = await supabase.rpc('sp_listar_todas_categorias_insumos', {
    p_centro_id: perfil.centro_id,
  })

  // Listar todos los insumos del centro (activos e inactivos)
  const { data: insumosRaw } = await supabase.rpc('sp_listar_todos_insumos', {
    p_centro_id: perfil.centro_id,
  })

  const categorias = (categoriasRaw as CategoriaDetalle[]) ?? []
  const insumos = (insumosRaw as InsumoDetalle[]) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Gestión de Insumos y Categorías</h1>
            <SelectorCentroHeader />
          </div>
          <p className="text-sm text-muted-foreground">
            Administra el catálogo de insumos y categorías de este centro de acopio.
          </p>
        </div>
      </div>

      <div className="border-b border-border pb-px">
        {/* Usamos un contenedor de tabs simple o shadcn tabs */}
      </div>

      <InsumosPanel
        centroId={perfil.centro_id}
        categorias={categorias}
        insumos={insumos}
      />
    </div>
  )
}

// Client wrapper component to handle switching tabs and rendering details
import { InsumosPanel } from './insumos-panel'
