'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, inputCls } from '@/components/app/form'
import { UNIDADES_MEDIDA } from '@/lib/constants/unidades'
import { Button } from '@/components/ui/button'
import { type InsumoDetalle, type CategoriaDetalle } from './page'

type Props = {
  centroId: string
  categorias: CategoriaDetalle[]
  insumos: InsumoDetalle[]
}

export function InsumosTab({ centroId, categorias, insumos }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Estado para creación de insumo
  const [dialogCrearAbierto, setDialogCrearAbierto] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoCategoria, setNuevoCategoria] = useState('')
  const [nuevoUnidad, setNuevoUnidad] = useState('')
  const [nuevoUnidadPersonalizada, setNuevoUnidadPersonalizada] = useState('')
  const [nuevoPresentacion, setNuevoPresentacion] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)

  // Estado para edición de insumo
  const [insumoEdicion, setInsumoEdicion] = useState<InsumoDetalle | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editCategoria, setEditCategoria] = useState('')
  const [editUnidad, setEditUnidad] = useState('')
  const [editUnidadPersonalizada, setEditUnidadPersonalizada] = useState('')
  const [editPresentacion, setEditPresentacion] = useState('')
  const [editActivo, setEditActivo] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  // Filtrado de insumos
  const insumosFiltrados = insumos.filter((insumo) => {
    const cumpleBusqueda = insumo.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const cumpleCategoria = !categoriaFiltro || insumo.categoria_id === categoriaFiltro
    return cumpleBusqueda && cumpleCategoria
  })

  // Funciones de creación
  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoNombre.trim() || !nuevoCategoria) {
      setErrorCrear('Nombre y categoría son obligatorios')
      return
    }
    setCreando(true)
    setErrorCrear(null)

    const unidadFinal = nuevoUnidad === '__otra__' ? nuevoUnidadPersonalizada.trim() : nuevoUnidad

    const supabase = createClient()
    const { data, error } = await supabase.rpc('sp_crear_insumo', {
      p_centro_id: centroId,
      p_nombre: nuevoNombre.trim(),
      p_categoria_id: nuevoCategoria,
      ...(unidadFinal ? { p_unidad_medida: unidadFinal } : {}),
      ...(nuevoPresentacion.trim() ? { p_presentacion: nuevoPresentacion.trim() } : {}),
    })

    setCreando(false)
    if (error) {
      setErrorCrear(/unique|duplicad/i.test(error.message) ? 'Este insumo ya existe en el catálogo.' : error.message)
      return
    }

    setDialogCrearAbierto(false)
    resetFormCrear()
    startTransition(() => {
      router.refresh()
    })
  }

  function resetFormCrear() {
    setNuevoNombre('')
    setNuevoCategoria('')
    setNuevoUnidad('')
    setNuevoUnidadPersonalizada('')
    setNuevoPresentacion('')
    setErrorCrear(null)
  }

  // Funciones de edición
  function abrirEdicion(insumo: InsumoDetalle) {
    setInsumoEdicion(insumo)
    setEditNombre(insumo.nombre)
    setEditCategoria(insumo.categoria_id)
    
    const esUnidadPredeterminada = UNIDADES_MEDIDA.includes(insumo.unidad_medida ?? '')
    if (insumo.unidad_medida) {
      if (esUnidadPredeterminada) {
        setEditUnidad(insumo.unidad_medida)
        setEditUnidadPersonalizada('')
      } else {
        setEditUnidad('__otra__')
        setEditUnidadPersonalizada(insumo.unidad_medida)
      }
    } else {
      setEditUnidad('')
      setEditUnidadPersonalizada('')
    }
    
    setEditPresentacion(insumo.presentacion ?? '')
    setEditActivo(insumo.activo)
    setErrorEdit(null)
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault()
    if (!insumoEdicion) return
    if (!editNombre.trim() || !editCategoria) {
      setErrorEdit('Nombre y categoría son obligatorios')
      return
    }

    setGuardando(true)
    setErrorEdit(null)

    const unidadFinal = editUnidad === '__otra__' ? editUnidadPersonalizada.trim() : editUnidad

    const supabase = createClient()
    const { error } = await supabase.rpc('sp_actualizar_insumo', {
      p_id: insumoEdicion.id,
      p_nombre: editNombre.trim(),
      p_categoria_id: editCategoria,
      p_unidad_medida: unidadFinal || undefined,
      p_presentacion: editPresentacion.trim() || undefined,
      p_activo: editActivo,
    })

    setGuardando(false)
    if (error) {
      setErrorEdit(error.message)
      return
    }

    setInsumoEdicion(null)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className={`${inputCls} sm:max-w-xs`}
            placeholder="Buscar insumo por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            className={`${inputCls} sm:max-w-xs`}
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => setDialogCrearAbierto(true)}>
          + Crear Insumo
        </Button>
      </div>

      {/* Tabla de Insumos */}
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Insumo</th>
              <th className="px-4 py-3 text-left font-medium">Categoría</th>
              <th className="px-4 py-3 text-left font-medium">Presentación</th>
              <th className="px-4 py-3 text-left font-medium">Unidad</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {insumosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No se encontraron insumos.
                </td>
              </tr>
            ) : (
              insumosFiltrados.map((insumo) => (
                <tr key={insumo.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{insumo.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{insumo.categoria}</td>
                  <td className="px-4 py-3 text-muted-foreground">{insumo.presentacion ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{insumo.unidad_medida ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        insumo.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {insumo.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => abrirEdicion(insumo)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog Crear Insumo */}
      <Dialog open={dialogCrearAbierto} onOpenChange={(open) => { if (!open) setDialogCrearAbierto(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Insumo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrear} className="space-y-4 pt-2">
            <Field label="Nombre del insumo *">
              <input
                className={inputCls}
                placeholder="Ej. Agua Minalba 5L"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                required
              />
            </Field>

            <Field label="Categoría *">
              <select
                className={inputCls}
                value={nuevoCategoria}
                onChange={(e) => setNuevoCategoria(e.target.value)}
                required
              >
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Presentación — cantidad/volumen (opcional)">
              <input
                className={inputCls}
                placeholder="Ej. 5, 1.5, 500"
                value={nuevoPresentacion}
                onChange={(e) => setNuevoPresentacion(e.target.value)}
              />
            </Field>

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
                  placeholder="Escribe la unidad personalizada..."
                  value={nuevoUnidadPersonalizada}
                  onChange={(e) => setNuevoUnidadPersonalizada(e.target.value)}
                  required
                />
              )}
            </div>

            {errorCrear && (
              <p className="text-sm text-destructive font-medium">{errorCrear}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogCrearAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creando}>
                {creando ? 'Creando...' : 'Crear insumo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Insumo */}
      <Dialog open={insumoEdicion !== null} onOpenChange={(open) => { if (!open) setInsumoEdicion(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Insumo</DialogTitle>
          </DialogHeader>
          {insumoEdicion && (
            <form onSubmit={handleEditar} className="space-y-4 pt-2">
              <Field label="Nombre del insumo *">
                <input
                  className={inputCls}
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                />
              </Field>

              <Field label="Categoría *">
                <select
                  className={inputCls}
                  value={editCategoria}
                  onChange={(e) => setEditCategoria(e.target.value)}
                  required
                >
                  <option value="">Seleccionar categoría...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Presentación — cantidad/volumen (opcional)">
                <input
                  className={inputCls}
                  value={editPresentacion}
                  onChange={(e) => setEditPresentacion(e.target.value)}
                />
              </Field>

              <div className="space-y-1">
                <label className="text-sm font-medium">Unidad de medida (opcional)</label>
                <select
                  className={inputCls}
                  value={editUnidad}
                  onChange={(e) => {
                    setEditUnidad(e.target.value)
                    if (e.target.value !== '__otra__') setEditUnidadPersonalizada('')
                  }}
                >
                  <option value="">Sin unidad</option>
                  {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
                  <option value="__otra__">Otra…</option>
                </select>
                {editUnidad === '__otra__' && (
                  <input
                    className={`${inputCls} mt-1.5`}
                    placeholder="Escribe la unidad personalizada..."
                    value={editUnidadPersonalizada}
                    onChange={(e) => setEditUnidadPersonalizada(e.target.value)}
                    required
                  />
                )}
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="editActivo"
                  checked={editActivo}
                  onChange={(e) => setEditActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-primary text-primary-foreground focus:ring-primary"
                />
                <label htmlFor="editActivo" className="text-sm font-medium cursor-pointer selection:bg-transparent">
                  Insumo activo (se muestra en formularios y búsquedas)
                </label>
              </div>

              {errorEdit && (
                <p className="text-sm text-destructive font-medium">{errorEdit}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setInsumoEdicion(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
