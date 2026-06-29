'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { ingresoSchema, personaSchema, type IngresoData, type PersonaData } from '@/lib/validations/ingresos'
import { createClient } from '@/lib/supabase/client'

type Insumo = { id: string; nombre: string; categoria: string }
type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }

function normalizarTexto(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'text-sm font-medium'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

type Props = {
  centroId: string
  categorias: Categoria[]
  insumos: Insumo[]
}

export function FormularioIngreso({ centroId, categorias, insumos }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Insumo
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [busquedaInsumo, setBusquedaInsumo] = useState('')
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null)
  const [modoNuevoInsumo, setModoNuevoInsumo] = useState(false)
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('')
  const [nuevoInsumoCategoria, setNuevoInsumoCategoria] = useState('')
  const [creandoInsumo, setCreandoInsumo] = useState(false)

  // Donante
  const [busquedaDonante, setBusquedaDonante] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Persona[]>([])
  const [buscando, setBuscando] = useState(false)
  const [personaSeleccionada, setPersonaSeleccionada] = useState<Persona | null>(null)

  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<IngresoData>({
    resolver: zodResolver(ingresoSchema),
    defaultValues: {
      fecha: new Date().toISOString().slice(0, 10),
      donante_modo: 'anonimo',
    },
  })

  const {
    register: regPersona,
    reset: resetPersona,
    formState: { errors: errorsPersona },
    trigger: triggerPersona,
    getValues: getValuesPersona,
  } = useForm<PersonaData>({ resolver: zodResolver(personaSchema) })

  const donanteModo = watch('donante_modo')

  // Filtra por categoría primero, luego por texto
  const insumosFiltradosCategoria = categoriaSeleccionada
    ? insumos.filter((i) => i.categoria === categorias.find((c) => c.id === categoriaSeleccionada)?.nombre)
    : insumos

  const insumosSugeridos = busquedaInsumo.length >= 1
    ? insumosFiltradosCategoria
        .filter((i) => normalizarTexto(i.nombre).includes(normalizarTexto(busquedaInsumo)))
        .slice(0, 8)
    : []

  useEffect(() => {
    if (donanteModo !== 'existente') {
      setPersonaSeleccionada(null)
      setBusquedaDonante('')
      setResultadosBusqueda([])
    }
    if (donanteModo !== 'nuevo') resetPersona()
  }, [donanteModo, resetPersona])

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
  }

  async function confirmarNuevoInsumo() {
    if (!nuevoInsumoNombre.trim() || !nuevoInsumoCategoria) {
      setError('Complete nombre y categoría del insumo')
      return
    }
    setCreandoInsumo(true)
    setError(null)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('sp_crear_insumo', {
      p_nombre: nuevoInsumoNombre.trim(),
      p_categoria_id: nuevoInsumoCategoria,
    })
    setCreandoInsumo(false)
    if (rpcError) { setError(rpcError.message); return }
    const creado = data as { id: string; nombre: string; categoria: string }
    seleccionarInsumo(creado)
    cancelarNuevoInsumo()
  }

  async function buscarPersona(termino: string) {
    if (termino.length < 2) { setResultadosBusqueda([]); return }
    setBuscando(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('sp_buscar_persona', { p_termino: termino })
    setResultadosBusqueda((data as Persona[]) ?? [])
    setBuscando(false)
  }

  async function crearPersona(data: PersonaData): Promise<string | null> {
    const supabase = createClient()
    const { data: res, error } = await supabase.rpc('sp_crear_persona', {
      p_nombre: data.nombre,
      p_apellido: data.apellido,
      p_telefono: data.telefono,
      p_cedula: data.cedula || undefined,
      p_correo: data.correo || undefined,
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
    } else if (data.donante_modo === 'nuevo') {
      const valid = await triggerPersona()
      if (!valid) { setError('Complete los datos del donante'); return }
      const personaData = getValuesPersona()
      const parsed = personaSchema.safeParse(personaData)
      if (!parsed.success) { setError('Datos del donante inválidos'); return }
      const nuevaPersonaId = await crearPersona(parsed.data)
      if (!nuevaPersonaId) { setError('Error al registrar el donante'); return }
      donanteId = nuevaPersonaId
    }

    const { error: rpcError } = await supabase.rpc('sp_registrar_ingreso', {
      p_centro_id: centroId,
      p_insumo_id: data.insumo_id,
      p_cantidad: data.cantidad,
      p_fecha: data.fecha,
      p_donante_id: donanteId ?? undefined,
      p_donante_anonimo: donanteAnonimo,
      p_observaciones: data.observaciones || undefined,
    })

    if (rpcError) { setError(rpcError.message); return }

    reset()
    resetPersona()
    setPersonaSeleccionada(null)
    setBusquedaDonante('')
    setBusquedaInsumo('')
    setInsumoSeleccionado(null)
    setCategoriaSeleccionada('')
    setModoNuevoInsumo(false)
    setAbierto(false)
    router.refresh()
  }

  function onInvalid() {
    setError('Revisa los campos obligatorios marcados antes de registrar el ingreso.')
  }

  function cerrar() {
    setAbierto(false)
    reset()
    resetPersona()
    setPersonaSeleccionada(null)
    setBusquedaDonante('')
    setBusquedaInsumo('')
    setInsumoSeleccionado(null)
    setCategoriaSeleccionada('')
    setModoNuevoInsumo(false)
    setResultadosBusqueda([])
    setError(null)
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Registrar ingreso
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-lg p-6 my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Registrar ingreso</h2>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          {/* Categoría (filtro local) */}
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
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Field>

          {/* Insumo — input con sugerencias */}
          <Field label="Insumo *" error={errors.insumo_id?.message}>
            {insumoSeleccionado ? (
              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{insumoSeleccionado.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {insumoSeleccionado.categoria}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInsumoSeleccionado(null)
                    setBusquedaInsumo('')
                    setValue('insumo_id', '')
                  }}
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
                <Field label="Categoría *">
                  <select
                    className={inputCls}
                    value={nuevoInsumoCategoria}
                    onChange={(e) => setNuevoInsumoCategoria(e.target.value)}
                  >
                    <option value="">Selecciona…</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </Field>
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
                    {insumosSugeridos.map((i) => (
                      <li key={i.id} className="border-b last:border-b-0">
                        <button
                          type="button"
                          onClick={() => seleccionarInsumo(i)}
                          className="w-full px-3 py-2 text-left hover:bg-muted/50"
                        >
                          <span className="font-medium">{i.nombre}</span>
                          <span className="ml-2 text-muted-foreground text-xs">
                            {i.categoria}
                          </span>
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
          </Field>

          {/* Cantidad y fecha */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad *" error={errors.cantidad?.message}>
              <input className={inputCls} type="number" step="1" min="1" {...register('cantidad', { valueAsNumber: true })} />
            </Field>
            <Field label="Fecha *" error={errors.fecha?.message}>
              <input className={inputCls} type="date" {...register('fecha')} />
            </Field>
          </div>

          {/* Donante */}
          <div className="space-y-2">
            <label className={labelCls}>Donante</label>
            <div className="flex gap-2">
              {(['anonimo', 'existente', 'nuevo'] as const).map((modo) => (
                <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" value={modo} {...register('donante_modo')} className="accent-primary" />
                  {modo === 'anonimo' ? 'Anónimo' : modo === 'existente' ? 'Buscar existente' : 'Nuevo donante'}
                </label>
              ))}
            </div>
          </div>

          {/* Buscar donante existente */}
          {donanteModo === 'existente' && (
            <div className="space-y-2 rounded-md bg-muted/40 p-3">
              {personaSeleccionada ? (
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{personaSeleccionada.nombre} {personaSeleccionada.apellido}</p>
                    <p className="text-xs text-muted-foreground">{personaSeleccionada.telefono}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPersonaSeleccionada(null); setBusquedaDonante(''); setResultadosBusqueda([]) }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className={inputCls}
                    placeholder="Buscar por nombre, teléfono o cédula…"
                    value={busquedaDonante}
                    onChange={(e) => { setBusquedaDonante(e.target.value); buscarPersona(e.target.value) }}
                  />
                  {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
                  {resultadosBusqueda.length > 0 && (
                    <ul className="divide-y rounded-md border bg-background text-sm max-h-40 overflow-y-auto">
                      {resultadosBusqueda.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => { setPersonaSeleccionada(p); setValue('donante_id', p.id); setResultadosBusqueda([]) }}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50"
                          >
                            <span className="font-medium">{p.nombre} {p.apellido}</span>
                            <span className="ml-2 text-muted-foreground">{p.telefono}</span>
                            {p.cedula && <span className="ml-2 text-muted-foreground">CI: {p.cedula}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {busquedaDonante.length >= 2 && !buscando && resultadosBusqueda.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin resultados. Prueba con &quot;Nuevo donante&quot;.</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Nuevo donante */}
          {donanteModo === 'nuevo' && (
            <div className="space-y-3 rounded-md bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Datos del donante</p>
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
      </div>
    </div>
  )
}
