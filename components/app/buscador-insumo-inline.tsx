'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Field, inputCls } from '@/components/app/form'
import { UNIDADES_MEDIDA } from '@/lib/constants/unidades'

export type Insumo = {
  id: string
  nombre: string
  categoria: string
  categoria_id?: string
  unidad_medida?: string | null
  presentacion?: string | null
}

type Categoria = { id: string; nombre: string }

type Props = {
  centroId: string
  categorias: Categoria[]
  seleccionado: Insumo | null
  onSelect: (i: Insumo) => void
  onCambiar: () => void
  categoriaFiltro?: string
  placeholder?: string
}

export function BuscadorInsumoInline({
  centroId,
  categorias,
  seleccionado,
  onSelect,
  onCambiar,
  categoriaFiltro,
  placeholder = 'Escribe para buscar un insumo…',
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Insumo[]>([])
  const [buscando, setBuscando] = useState(false)

  const [modoNuevo, setModoNuevo] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoCategoria, setNuevoCategoria] = useState('')
  const [nuevoUnidad, setNuevoUnidad] = useState('')
  const [nuevoUnidadPersonalizada, setNuevoUnidadPersonalizada] = useState('')
  const [nuevoPresentacion, setNuevoPresentacion] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    const timer = setTimeout(async () => {
      if (busqueda.length < 1) { setResultados([]); setBuscando(false); return }
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('sp_buscar_insumo', {
        p_termino: busqueda,
        p_centro_id: centroId,
        ...(categoriaFiltro ? { p_categoria_id: categoriaFiltro } : {}),
      })
      if (!cancelado) {
        setResultados((data as Insumo[]) ?? [])
        setBuscando(false)
      }
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [busqueda, centroId, categoriaFiltro])

  function iniciarNuevo() {
    setModoNuevo(true)
    setNuevoNombre(busqueda)
    setNuevoCategoria(categoriaFiltro ?? '')
    setBusqueda('')
    setResultados([])
  }

  function cancelarNuevo() {
    setModoNuevo(false)
    setNuevoNombre('')
    setNuevoCategoria('')
    setNuevoUnidad('')
    setNuevoUnidadPersonalizada('')
    setNuevoPresentacion('')
    setError(null)
  }

  async function confirmarNuevo() {
    if (!nuevoNombre.trim() || !nuevoCategoria) {
      setError('Complete nombre y categoría del insumo')
      return
    }
    setCreando(true)
    setError(null)
    const supabase = createClient()
    const unidadFinal =
      nuevoUnidad === '__otra__' ? nuevoUnidadPersonalizada.trim() : nuevoUnidad
    const { data, error: rpcError } = await supabase.rpc('sp_crear_insumo', {
      p_centro_id: centroId,
      p_nombre: nuevoNombre.trim(),
      p_categoria_id: nuevoCategoria,
      ...(unidadFinal ? { p_unidad_medida: unidadFinal } : {}),
      ...(nuevoPresentacion.trim() ? { p_presentacion: nuevoPresentacion.trim() } : {}),
    })
    setCreando(false)
    if (rpcError) {
      setError(/unique|duplicad/i.test(rpcError.message) ? 'Este insumo ya existe en el catálogo.' : rpcError.message)
      return
    }
    const creado = data as { id: string; nombre: string; categoria: string }
    onSelect(creado)
    cancelarNuevo()
  }

  if (seleccionado) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
        <div>
          <p className="text-sm font-medium">{seleccionado.nombre}</p>
          <p className="text-xs text-muted-foreground">{seleccionado.categoria}</p>
        </div>
        <button
          type="button"
          onClick={() => { onCambiar(); setBusqueda('') }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cambiar
        </button>
      </div>
    )
  }

  if (modoNuevo) {
    return (
      <div className="space-y-3 rounded-md border bg-muted/40 p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo insumo</p>
        <Field label="Nombre *">
          <input className={inputCls} value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} autoFocus />
        </Field>
        <Field label="Presentación — cantidad por envase (opcional)">
          <input
            className={inputCls}
            placeholder="Ej: 500, 1, 2.5"
            value={nuevoPresentacion}
            onChange={(e) => setNuevoPresentacion(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Unidad de medida (opcional)</label>
            <select
              className={inputCls}
              value={nuevoUnidad}
              onChange={(e) => {
                setNuevoUnidad(e.target.value)
                if (e.target.value !== '__otra__') setNuevoUnidadPersonalizada('')
              }}
            >
              <option value="">Sin unidad</option>
              {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
              <option value="__otra__">Otra…</option>
            </select>
            {nuevoUnidad === '__otra__' && (
              <input
                className={`${inputCls} mt-1.5`}
                placeholder="Escribe la unidad…"
                value={nuevoUnidadPersonalizada}
                onChange={(e) => setNuevoUnidadPersonalizada(e.target.value)}
                autoFocus
              />
            )}
          </div>
          <Field label="Categoría *">
            <select className={inputCls} value={nuevoCategoria} onChange={(e) => setNuevoCategoria(e.target.value)}>
              <option value="">Selecciona…</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={cancelarNuevo} className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarNuevo}
            disabled={creando}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creando ? 'Creando…' : 'Crear insumo'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        className={inputCls}
        placeholder={placeholder}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        autoComplete="off"
      />
      {busqueda.length >= 1 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow text-sm max-h-52 overflow-y-auto">
          {buscando && <li className="px-3 py-2 text-xs text-muted-foreground">Buscando…</li>}
          {!buscando && resultados.map(i => (
            <li key={i.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => { onSelect(i); setBusqueda(''); setResultados([]) }}
                className="w-full px-3 py-2 text-left hover:bg-muted/50"
              >
                <span className="font-medium">{i.nombre}</span>
                <span className="ml-2 text-muted-foreground text-xs">{i.categoria}</span>
              </button>
            </li>
          ))}
          {!buscando && (
            <li>
              <button
                type="button"
                onClick={iniciarNuevo}
                className="w-full px-3 py-2 text-left text-primary hover:bg-muted/50 font-medium"
              >
                + Crear &quot;{busqueda || 'nuevo insumo'}&quot;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
