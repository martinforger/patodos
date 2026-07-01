'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, inputCls } from '@/components/app/form'
import { Button } from '@/components/ui/button'
import { type CategoriaDetalle } from './page'

type Props = {
  centroId: string
  categorias: CategoriaDetalle[]
}

export function CategoriasTab({ centroId, categorias }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Estado para creación de categoría
  const [dialogCrearAbierto, setDialogCrearAbierto] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoDescripcion, setNuevoDescripcion] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)

  // Estado para edición de categoría
  const [categoriaEdicion, setCategoriaEdicion] = useState<CategoriaDetalle | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editActivo, setEditActivo] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  // Filtrado de categorías
  const categoriasFiltradas = categorias.filter((cat) =>
    cat.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Funciones de creación
  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoNombre.trim()) {
      setErrorCrear('El nombre es obligatorio')
      return
    }
    setCreando(true)
    setErrorCrear(null)

    const supabase = createClient()
    const { error } = await supabase.rpc('sp_crear_categoria_insumo', {
      p_centro_id: centroId,
      p_nombre: nuevoNombre.trim(),
      p_descripcion: nuevoDescripcion.trim() || undefined,
    })

    setCreando(false)
    if (error) {
      setErrorCrear(/unique|duplicad/i.test(error.message) ? 'Esta categoría ya existe en este centro.' : error.message)
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
    setNuevoDescripcion('')
    setErrorCrear(null)
  }

  // Funciones de edición
  function abrirEdicion(cat: CategoriaDetalle) {
    setCategoriaEdicion(cat)
    setEditNombre(cat.nombre)
    setEditDescripcion(cat.descripcion ?? '')
    setEditActivo(cat.activo)
    setErrorEdit(null)
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault()
    if (!categoriaEdicion) return
    if (!editNombre.trim()) {
      setErrorEdit('El nombre es obligatorio')
      return
    }

    setGuardando(true)
    setErrorEdit(null)

    const supabase = createClient()
    const { error } = await supabase.rpc('sp_actualizar_categoria_insumo', {
      p_id: categoriaEdicion.id,
      p_nombre: editNombre.trim(),
      p_descripcion: editDescripcion.trim() || undefined,
      p_activo: editActivo,
    })

    setGuardando(false)
    if (error) {
      setErrorEdit(error.message)
      return
    }

    setCategoriaEdicion(null)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className={`${inputCls} sm:max-w-xs`}
          placeholder="Buscar categoría..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Button onClick={() => setDialogCrearAbierto(true)}>
          + Crear Categoría
        </Button>
      </div>

      {/* Tabla de Categorías */}
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Categoría</th>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-center font-medium">Insumos Activos</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categoriasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No se encontraron categorías.
                </td>
              </tr>
            ) : (
              categoriasFiltradas.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{cat.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {cat.descripcion ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {cat.num_insumos}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        cat.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {cat.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => abrirEdicion(cat)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog Crear Categoría */}
      <Dialog open={dialogCrearAbierto} onOpenChange={(open) => { if (!open) setDialogCrearAbierto(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrear} className="space-y-4 pt-2">
            <Field label="Nombre de la categoría *">
              <input
                className={inputCls}
                placeholder="Ej. Comunicación, Medicamentos"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                required
              />
            </Field>

            <Field label="Descripción (opcional)">
              <textarea
                className={inputCls}
                rows={3}
                placeholder="Ej. Insumos destinados a telecomunicaciones, radios, etc."
                value={nuevoDescripcion}
                onChange={(e) => setNuevoDescripcion(e.target.value)}
              />
            </Field>

            {errorCrear && (
              <p className="text-sm text-destructive font-medium">{errorCrear}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogCrearAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creando}>
                {creando ? 'Creando...' : 'Crear categoría'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Categoría */}
      <Dialog open={categoriaEdicion !== null} onOpenChange={(open) => { if (!open) setCategoriaEdicion(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Categoría</DialogTitle>
          </DialogHeader>
          {categoriaEdicion && (
            <form onSubmit={handleEditar} className="space-y-4 pt-2">
              <Field label="Nombre de la categoría *">
                <input
                  className={inputCls}
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                />
              </Field>

              <Field label="Descripción (opcional)">
                <textarea
                  className={inputCls}
                  rows={3}
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                />
              </Field>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="editActivoCat"
                  checked={editActivo}
                  onChange={(e) => setEditActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-primary text-primary-foreground focus:ring-primary"
                />
                <label htmlFor="editActivoCat" className="text-sm font-medium cursor-pointer selection:bg-transparent">
                  Categoría activa (se muestra en formularios de registro)
                </label>
              </div>

              {errorEdit && (
                <p className="text-sm text-destructive font-medium">{errorEdit}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCategoriaEdicion(null)}>
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
