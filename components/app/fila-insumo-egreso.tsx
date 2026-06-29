'use client'

import { useState } from 'react'

type Insumo = { id: string; nombre: string; categoria: string }
type Categoria = { id: string; nombre: string }
type SolicitudPendiente = { id: string; insumo: string; cantidad_solicitada: number; solicitante: string; fecha_solicitud: string; estado: string }

export type ItemEgreso = { insumo_id: string; cantidad: number | ''; solicitud_id: string }

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

type Props = {
  item: ItemEgreso
  index: number
  categorias: Categoria[]
  insumos: Insumo[]
  solicitudesPendientes: SolicitudPendiente[]
  onChange: (index: number, patch: Partial<ItemEgreso>) => void
  onRemove: (index: number) => void
  removable: boolean
}

export function FilaInsumoEgreso({
  item, index, categorias, insumos, solicitudesPendientes, onChange, onRemove, removable,
}: Props) {
  // Filtro de categoría local a esta fila (solo acota el select de insumo).
  const [categoria, setCategoria] = useState('')

  const insumosFiltrados = categoria
    ? insumos.filter((i) => i.categoria === categorias.find((c) => c.id === categoria)?.nombre)
    : insumos

  // Solicitudes pendientes que correspondan al insumo elegido en esta fila.
  const insumoNombre = insumos.find((i) => i.id === item.insumo_id)?.nombre
  const solicitudesDelInsumo = insumoNombre
    ? solicitudesPendientes.filter((s) => s.insumo === insumoNombre)
    : []

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Insumo #{index + 1}</span>
        {removable && (
          <button type="button" onClick={() => onRemove(index)} className="text-xs text-destructive hover:underline">
            Quitar
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          className={inputCls}
          value={categoria}
          onChange={(e) => { setCategoria(e.target.value); onChange(index, { insumo_id: '', solicitud_id: '' }) }}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <select
          className={inputCls}
          value={item.insumo_id}
          onChange={(e) => onChange(index, { insumo_id: e.target.value, solicitud_id: '' })}
        >
          <option value="">Seleccione un insumo…</option>
          {insumosFiltrados.map((i) => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
          ))}
        </select>
      </div>

      <input
        className={inputCls}
        type="number"
        step="1"
        min="1"
        placeholder="Cantidad"
        value={item.cantidad}
        onChange={(e) => onChange(index, { cantidad: e.target.value === '' ? '' : Number(e.target.value) })}
      />

      {solicitudesDelInsumo.length > 0 && (
        <select
          className={inputCls}
          value={item.solicitud_id}
          onChange={(e) => onChange(index, { solicitud_id: e.target.value })}
        >
          <option value="">Sin vincular solicitud</option>
          {solicitudesDelInsumo.map((s) => (
            <option key={s.id} value={s.id}>
              Vincular: {s.cantidad_solicitada} · {s.solicitante} ({s.estado === 'pendiente' ? 'Pendiente' : 'Parcial'})
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
