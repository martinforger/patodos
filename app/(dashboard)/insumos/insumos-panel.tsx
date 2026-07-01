'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InsumosTab } from './insumos-tab'
import { CategoriasTab } from './categorias-tab'
import { type InsumoDetalle, type CategoriaDetalle } from './page'

type Props = {
  centroId: string
  categorias: CategoriaDetalle[]
  insumos: InsumoDetalle[]
}

export function InsumosPanel({ centroId, categorias, insumos }: Props) {
  const [tabActiva, setTabActiva] = useState<'insumos' | 'categorias'>('insumos')

  return (
    <div className="space-y-4">
      {/* Selector de Pestañas Estilo Shadcn */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTabActiva('insumos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tabActiva === 'insumos'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Insumos ({insumos.length})
        </button>
        <button
          onClick={() => setTabActiva('categorias')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tabActiva === 'categorias'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Categorías ({categorias.length})
        </button>
      </div>

      {/* Contenido de las pestañas */}
      <div className="pt-2">
        {tabActiva === 'insumos' ? (
          <InsumosTab
            centroId={centroId}
            categorias={categorias.filter(c => c.activo)}
            insumos={insumos}
          />
        ) : (
          <CategoriasTab
            centroId={centroId}
            categorias={categorias}
          />
        )}
      </div>
    </div>
  )
}
