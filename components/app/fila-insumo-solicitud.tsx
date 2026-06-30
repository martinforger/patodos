'use client'

import { useState, useEffect } from 'react'
import { inputCls } from '@/components/app/form'
import { BuscadorInsumoInline, type Insumo } from '@/components/app/buscador-insumo-inline'

type Categoria = { id: string; nombre: string }

export type ItemSolicitud = { insumo_id: string; cantidad: number | '' }

type Props = {
  item: ItemSolicitud
  index: number
  centroId: string
  categorias: Categoria[]
  onChange: (index: number, patch: Partial<ItemSolicitud>) => void
  onRemove: (index: number) => void
  removable: boolean
}

export function FilaInsumoSolicitud({
  item, index, centroId, categorias, onChange, onRemove, removable,
}: Props) {
  const [categoria, setCategoria] = useState('')
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null)

  useEffect(() => {
    if (!item.insumo_id && insumoSeleccionado) setInsumoSeleccionado(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.insumo_id])

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Insumo #{index + 1}</span>
        {removable && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-xs text-destructive hover:underline"
          >
            Quitar
          </button>
        )}
      </div>

      <select
        className={inputCls}
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      >
        <option value="">Todas las categorías</option>
        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <BuscadorInsumoInline
        centroId={centroId}
        categorias={categorias}
        categoriaFiltro={categoria || undefined}
        seleccionado={insumoSeleccionado}
        onSelect={(i) => { setInsumoSeleccionado(i); onChange(index, { insumo_id: i.id }) }}
        onCambiar={() => { setInsumoSeleccionado(null); onChange(index, { insumo_id: '' }) }}
      />

      <input
        className={inputCls}
        type="number"
        step="1"
        min="0.01"
        placeholder="Cantidad"
        value={item.cantidad}
        onChange={(e) => onChange(index, { cantidad: e.target.value === '' ? '' : Number(e.target.value) })}
      />
    </div>
  )
}
