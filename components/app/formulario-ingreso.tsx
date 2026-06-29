'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  ingresoSchema, personaSchema,
  type IngresoData, type PersonaData,
} from '@/lib/validations/ingresos'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Field, LeyendaObligatoria, inputCls } from '@/components/app/form'
import { BuscadorPersonaInline } from '@/components/app/buscador-persona-inline'

type Insumo = { id: string; nombre: string; categoria: string; unidad_medida?: string | null }
type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }

const UNIDADES_MEDIDA = [
  'kg', 'g', 'L', 'mL', 'unidades', 'cajas', 'bolsas', 'paquetes', 'paletas', 'sacos',
]

function normalizarTexto(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function traducirError(msg: string): string {
  if (/unique|duplicad/i.test(msg)) return 'Este insumo ya existe en el catálogo.'
  if (/stock|inventario|insuficiente/i.test(msg)) return 'Stock insuficiente para registrar el movimiento.'
  return msg
}

type Props = { centroId: string; categorias: Categoria[]; insumos: Insumo[] }

export function FormularioIngreso({ centroId, categorias, insumos }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // — Insumo —
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [busquedaInsumo, setBusquedaInsumo] = useState('')
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null)
  const [modoNuevoInsumo, setModoNuevoInsumo] = useState(false)
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('')
  const [nuevoInsumoCategoria, setNuevoInsumoCategoria] = useState('')
  const [nuevoInsumoUnidad, setNuevoInsumoUnidad] = useState('')
  const [nuevoInsumoUnidadPersonalizada, setNuevoInsumoUnidadPersonalizada] = useState('')
  const [nuevoInsumoPresentacion, setNuevoInsumoPresentacion] = useState('')
  const [creandoInsumo, setCreandoInsumo] = useState(false)

  // — Donante —
  const [personaSeleccionada, setPersonaSeleccionada] = useState<Persona | null>(null)

  const router = useRouter()

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<IngresoData>({
    resolver: zodResolver(ingresoSchema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10), donante_modo: 'anonimo' },
  })

  const {
    register: regPersona, reset: resetPersona,
    formState: { errors: errorsPersona },
    trigger: triggerPersona, getValues: getValuesPersona,
  } = useForm<PersonaData>({ resolver: zodResolver(personaSchema) })

  const donanteModo = watch('donante_modo')

  useEffect(() => {
    if (donanteModo !== 'existente') setPersonaSeleccionada(null)
    if (donanteModo !== 'nuevo') resetPersona()
  }, [donanteModo, resetPersona])

  const insumosFiltradosCategoria = categoriaSeleccionada
    ? insumos.filter(i => i.categoria === categorias.find(c => c.id === categoriaSeleccionada)?.nombre)
    : insumos

  const insumosSugeridos = busquedaInsumo.length >= 1
    ? insumosFiltradosCategoria
        .filter(i => normalizarTexto(i.nombre).includes(normalizarTexto(busquedaInsumo)))
        .slice(0, 8)
    : []

  function seleccionarInsumo(i: Insumo) {
    setInsumoSeleccionado(i)
    setValue('insumo_id', i.id)
    setBusquedaInsumo('')
    setModoNuevoInsumo(false)
  }

  function iniciarNuevoInsumo() {
    setModoNuevoInsumo(true)
    setNuevoInsumoNombre(busquedaInsumo)
    setNuevoInsumoCategoria(categoriaSeleccionada)
    setBusquedaInsumo('')
  }

  function cancelarNuevoInsumo() {
    setModoNuevoInsumo(false)
    setNuevoInsumoNombre('')
    setNuevoInsumoCategoria('')
    setNuevoInsumoUnidad('')
    setNuevoInsumoUnidadPersonalizada('')
    setNuevoInsumoPresentacion('')
  }

  async function confirmarNuevoInsumo() {
    if (!nuevoInsumoNombre.trim() || !nuevoInsumoCategoria) {
      setError('Complete nombre y categoría del insumo')
      return
    }
    setCreandoInsumo(true)
    setError(null)
    const supabase = createClient()
    const unidadFinal =
      nuevoInsumoUnidad === '__otra__' ? nuevoInsumoUnidadPersonalizada.trim() : nuevoInsumoUnidad
    const { data, error: rpcError } = await supabase.rpc('sp_crear_insumo', {
      p_nombre: nuevoInsumoNombre.trim(),
      p_categoria_id: nuevoInsumoCategoria,
      ...(unidadFinal ? { p_unidad_medida: unidadFinal } : {}),
      ...(nuevoInsumoPresentacion.trim() ? { p_presentacion: nuevoInsumoPresentacion.trim() } : {}),
    })
    setCreandoInsumo(false)
    if (rpcError) { setError(traducirError(rpcError.message)); return }
    const creado = data as { id: string; nombre: string; categoria: string }
    seleccionarInsumo(creado)
    cancelarNuevoInsumo()
  }

  async function crearPersona(data: PersonaData): Promise<string | null> {
    const supabase = createClient()
    const { data: res, error } = await supabase.rpc('sp_crear_persona', {
      p_centro_id: centroId,
      p_nombre: data.nombre, p_apellido: data.apellido, p_telefono: data.telefono,
      p_cedula: data.cedula || undefined, p_correo: data.correo || undefined,
      p_observaciones: data.observaciones || undefined,
    })
    if (error) return null
    return (res as { id: string }).id
  }

  async function onSubmit(data: IngresoData) {
    setError(null)
    const supabase = createClient()

    let donanteId: string | null = null
    let donanteAnonimo = false

    if (data.donante_modo === 'anonimo') {
      donanteAnonimo = true
    } else if (data.donante_modo === 'existente') {
      if (!personaSeleccionada) { setError('Seleccione un donante de la búsqueda'); return }
      donanteId = personaSeleccionada.id
    } else {
      const valid = await triggerPersona()
      if (!valid) { setError('Complete los datos del donante'); return }
      const parsed = personaSchema.safeParse(getValuesPersona())
      if (!parsed.success) { setError('Datos del donante inválidos'); return }
      const nuevaPersonaId = await crearPersona(parsed.data)
      if (!nuevaPersonaId) { setError('Error al registrar el donante'); return }
      donanteId = nuevaPersonaId
    }

    const { error: rpcError } = await supabase.rpc('sp_registrar_ingreso', {
      p_centro_id: centroId, p_insumo_id: data.insumo_id, p_cantidad: data.cantidad,
      p_fecha: data.fecha, p_donante_id: donanteId ?? undefined,
      p_donante_anonimo: donanteAnonimo, p_observaciones: data.observaciones || undefined,
    })

    if (rpcError) { setError(traducirError(rpcError.message)); return }
    cerrar()
    router.refresh()
  }

  function onInvalid() {
    setError('Revisa los campos obligatorios marcados antes de continuar.')
  }

  function cerrar() {
    reset()
    resetPersona()
    setPersonaSeleccionada(null)
    setBusquedaInsumo('')
    setInsumoSeleccionado(null)
    setCategoriaSeleccionada('')
    cancelarNuevoInsumo()
    setError(null)
    setAbierto(false)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Registrar ingreso
      </button>

      <Dialog open={abierto} onOpenChange={(open) => { if (!open) cerrar() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar ingreso</DialogTitle>
            <LeyendaObligatoria />
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">

            {/* Categoría — filtro local, no obligatorio */}
            <Field label="Categoría de insumo">
              <select
                className={inputCls}
                value={categoriaSeleccionada}
                onChange={(e) => {
                  setCategoriaSeleccionada(e.target.value)
                  setInsumoSeleccionado(null)
                  setBusquedaInsumo('')
                  setValue('insumo_id', '')
                  setModoNuevoInsumo(false)
                }}
              >
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>

            {/* Insumo — combobox con estados múltiples */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Insumo *</p>
              {insumoSeleccionado ? (
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {insumoSeleccionado.nombre}
                      {insumoSeleccionado.unidad_medida && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ({insumoSeleccionado.unidad_medida})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{insumoSeleccionado.categoria}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setInsumoSeleccionado(null); setBusquedaInsumo(''); setValue('insumo_id', '') }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cambiar
                  </button>
                </div>
              ) : modoNuevoInsumo ? (
                <div className="space-y-3 rounded-md border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo insumo</p>
                  <Field label="Nombre *">
                    <input
                      className={inputCls}
                      value={nuevoInsumoNombre}
                      onChange={(e) => setNuevoInsumoNombre(e.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label="Presentación — cantidad por envase (opcional)">
                    <input
                      className={inputCls}
                      placeholder="Ej: 500, 1, 2.5"
                      value={nuevoInsumoPresentacion}
                      onChange={(e) => setNuevoInsumoPresentacion(e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Unidad de medida (opcional)</label>
                      <select
                        className={inputCls}
                        value={nuevoInsumoUnidad}
                        onChange={(e) => {
                          setNuevoInsumoUnidad(e.target.value)
                          if (e.target.value !== '__otra__') setNuevoInsumoUnidadPersonalizada('')
                        }}
                      >
                        <option value="">Sin unidad</option>
                        {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
                        <option value="__otra__">Otra…</option>
                      </select>
                      {nuevoInsumoUnidad === '__otra__' && (
                        <input
                          className={`${inputCls} mt-1.5`}
                          placeholder="Escribe la unidad…"
                          value={nuevoInsumoUnidadPersonalizada}
                          onChange={(e) => setNuevoInsumoUnidadPersonalizada(e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>
                    <Field label="Categoría *">
                      <select
                        className={inputCls}
                        value={nuevoInsumoCategoria}
                        onChange={(e) => setNuevoInsumoCategoria(e.target.value)}
                      >
                        <option value="">Selecciona…</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={cancelarNuevoInsumo}
                      className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmarNuevoInsumo}
                      disabled={creandoInsumo}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {creandoInsumo ? 'Creando…' : 'Crear insumo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    className={inputCls}
                    placeholder="Escribe para buscar un insumo…"
                    value={busquedaInsumo}
                    onChange={(e) => setBusquedaInsumo(e.target.value)}
                    autoComplete="off"
                  />
                  {(insumosSugeridos.length > 0 || busquedaInsumo.length >= 1) && (
                    <ul className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow text-sm max-h-52 overflow-y-auto">
                      {insumosSugeridos.map(i => (
                        <li key={i.id} className="border-b last:border-b-0">
                          <button
                            type="button"
                            onClick={() => seleccionarInsumo(i)}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50"
                          >
                            <span className="font-medium">{i.nombre}</span>
                            {i.unidad_medida && (
                              <span className="ml-1 text-muted-foreground text-xs">({i.unidad_medida})</span>
                            )}
                            <span className="ml-2 text-muted-foreground text-xs">{i.categoria}</span>
                          </button>
                        </li>
                      ))}
                      <li>
                        <button
                          type="button"
                          onClick={iniciarNuevoInsumo}
                          className="w-full px-3 py-2 text-left text-primary hover:bg-muted/50 font-medium"
                        >
                          + Crear &quot;{busquedaInsumo || 'nuevo insumo'}&quot;
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
              {errors.insumo_id && (
                <p className="text-xs text-destructive">{errors.insumo_id.message}</p>
              )}
            </div>

            {/* Cantidad y fecha */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad *" error={errors.cantidad?.message}>
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register('cantidad', { valueAsNumber: true })}
                />
              </Field>
              <Field label="Fecha *" error={errors.fecha?.message}>
                <input className={inputCls} type="date" {...register('fecha')} />
              </Field>
            </div>

            {/* Donante */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Donante</p>
              <div className="flex gap-4">
                {(['anonimo', 'existente', 'nuevo'] as const).map((modo) => (
                  <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value={modo}
                      {...register('donante_modo')}
                      className="accent-primary"
                    />
                    {modo === 'anonimo' ? 'Anónimo' : modo === 'existente' ? 'Buscar existente' : 'Nuevo donante'}
                  </label>
                ))}
              </div>
            </div>

            {donanteModo === 'existente' && (
              <div className="rounded-md bg-muted/40 p-3">
                <BuscadorPersonaInline
                  centroId={centroId}
                  seleccionado={personaSeleccionada}
                  onSelect={(p) => { setPersonaSeleccionada(p); setValue('donante_id', p.id) }}
                  onCambiar={() => { setPersonaSeleccionada(null); setValue('donante_id', '') }}
                  mensajeSinResultados='Sin resultados. Usa "Nuevo donante" para registrarlo.'
                />
              </div>
            )}

            {donanteModo === 'nuevo' && (
              <div className="space-y-3 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Datos del donante
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre *" error={errorsPersona.nombre?.message}>
                    <input className={inputCls} {...regPersona('nombre')} />
                  </Field>
                  <Field label="Apellido *" error={errorsPersona.apellido?.message}>
                    <input className={inputCls} {...regPersona('apellido')} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Teléfono *" error={errorsPersona.telefono?.message}>
                    <input className={inputCls} type="tel" {...regPersona('telefono')} />
                  </Field>
                  <Field label="Cédula (opcional)" error={errorsPersona.cedula?.message}>
                    <input className={inputCls} {...regPersona('cedula')} />
                  </Field>
                </div>
                <Field label="Correo (opcional)" error={errorsPersona.correo?.message}>
                  <input className={inputCls} type="email" {...regPersona('correo')} />
                </Field>
              </div>
            )}

            {/* Observaciones */}
            <Field label="Observaciones (opcional)" error={errors.observaciones?.message}>
              <textarea className={inputCls} rows={2} {...register('observaciones')} />
            </Field>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cerrar}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando…' : 'Registrar ingreso'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
