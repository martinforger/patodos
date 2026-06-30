'use client'

import { useState, useEffect } from 'react'
import { inputCls } from '@/components/app/form'
import { BuscadorInsumoInline, type Insumo } from '@/components/app/buscador-insumo-inline'

type Categoria = { id: string; nombre: string }
type SolicitudPendiente = {
  id: string; insumo_id: string; insumo: string; cantidad_solicitada: number
  solicitante: string; fecha_solicitud: string; estado: string
}

export type ItemEgreso = { insumo_id: string; cantidad: number | ''; solicitud_id: string }

type Props = {
  item: ItemEgreso
  index: number
  centroId: string
  categorias: Categoria[]
  insumos: Insumo[]
  solicitudesPendientes: SolicitudPendiente[]
  stockMap: Record<string, number>
  mostrarStock?: boolean
  onChange: (index: number, patch: Partial<ItemEgreso>) => void
  onRemove: (index: number) => void
  removable: boolean
}

export function FilaInsumoEgreso({
  item, index, centroId, categorias, insumos, solicitudesPendientes, stockMap, mostrarStock = true,
  onChange, onRemove, removable,
}: Props) {
  const [categoria, setCategoria] = useState('')
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null)

  // Si insumo_id llega precargado (ej. autocompletado desde una solicitud
  // vinculada) y aún no tenemos el objeto completo, resolverlo del catálogo.
  useEffect(() => {
    if (item.insumo_id && (!insumoSeleccionado || insumoSeleccionado.id !== item.insumo_id)) {
      const encontrado = insumos.find(i => i.id === item.insumo_id)
      if (encontrado) setInsumoSeleccionado(encontrado)
    }
    if (!item.insumo_id && insumoSeleccionado) {
      setInsumoSeleccionado(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.insumo_id])

  const solicitudesDelInsumo = item.insumo_id
    ? solicitudesPendientes.filter(s => s.insumo_id === item.insumo_id)
    : []

  const stockDisponible = mostrarStock && item.insumo_id ? (stockMap[item.insumo_id] ?? 0) : null
  const cantidadNum = item.cantidad !== '' ? Number(item.cantidad) : 0
  const stockInsuficiente = stockDisponible !== null && cantidadNum > stockDisponible

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
        onSelect={(i) => { setInsumoSeleccionado(i); onChange(index, { insumo_id: i.id, solicitud_id: '' }) }}
        onCambiar={() => { setInsumoSeleccionado(null); onChange(index, { insumo_id: '', solicitud_id: '' }) }}
      />

      <input
        className={inputCls}
        type="number"
        step="1"
        min="1"
        placeholder="Cantidad"
        value={item.cantidad}
        onChange={(e) => onChange(index, { cantidad: e.target.value === '' ? '' : Number(e.target.value) })}
      />

      {/* Disponibilidad de stock */}
      {stockDisponible !== null && (
        <p className={`text-xs ${stockInsuficiente ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
          Disponible: {stockDisponible.toLocaleString('es-VE')}
          {stockInsuficiente && ' — cantidad supera el stock'}
        </p>
      )}

      {solicitudesDelInsumo.length > 0 && (
        <select
          className={inputCls}
          value={item.solicitud_id}
          onChange={(e) => onChange(index, { solicitud_id: e.target.value })}
        >
          <option value="">Sin vincular solicitud</option>
          {solicitudesDelInsumo.map(s => (
            <option key={s.id} value={s.id}>
              Vincular: {s.cantidad_solicitada} · {s.solicitante}{' '}
              ({s.estado === 'pendiente' ? 'Pendiente' : 'Parcial'})
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
