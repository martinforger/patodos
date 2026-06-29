'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  egresoSchema,
  destinoSchema,
  personaSchema,
  type EgresoData,
  type DestinoData,
} from '@/lib/validations/egresos'
import type { PersonaData } from '@/lib/validations/ingresos'
import { createClient } from '@/lib/supabase/client'

type Insumo = { id: string; nombre: string; categoria: string }
type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }
type Destino = { id: string; nombre: string; municipio: string; estado_geo: string }
type Responsable = { persona_id: string | null; nombre: string; apellido: string; telefono: string }
type SolicitudPendiente = { id: string; insumo: string; cantidad_solicitada: number; solicitante: string; fecha_solicitud: string; estado: string }

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

// Traduce mensajes crudos de Postgres a algo legible para el voluntario.
function traducirErrorEgreso(mensaje: string): string {
  if (mensaje.includes('persona_contacto_id')) {
    return 'Debes indicar una persona de contacto que recibe el egreso.'
  }
  if (/stock|inventario|insuficiente|cantidad/i.test(mensaje)) {
    return 'No hay stock suficiente de este insumo para registrar el egreso.'
  }
  return mensaje
}

async function buscarPersona(termino: string): Promise<Persona[]> {
  if (termino.length < 2) return []
  const supabase = createClient()
  const { data } = await supabase.rpc('sp_buscar_persona', { p_termino: termino })
  return (data as Persona[]) ?? []
}

type Props = {
  centroId: string
  categorias: Categoria[]
  insumos: Insumo[]
  destinos: Destino[]
  solicitudesPendientes?: SolicitudPendiente[]
}

export function FormularioEgreso({ centroId, categorias, insumos, destinos, solicitudesPendientes = [] }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')

  // Contacto existente
  const [busquedaContacto, setBusquedaContacto] = useState('')
  const [resultadosContacto, setResultadosContacto] = useState<Persona[]>([])
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Persona | null>(null)

  // Solicitud vinculada (HU-09)
  const [solicitudId, setSolicitudId] = useState<string>('')

  // Responsables
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [respManual, setRespManual] = useState({ nombre: '', apellido: '', telefono: '' })
  const [busquedaResp, setBusquedaResp] = useState('')
  const [resultadosResp, setResultadosResp] = useState<Persona[]>([])

  const router = useRouter()

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<EgresoData>({
    resolver: zodResolver(egresoSchema),
    defaultValues: {
      fecha: new Date().toISOString().slice(0, 10),
      destino_modo: 'existente',
      contacto_modo: 'existente',
    },
  })

  const {
    register: regDestino, reset: resetDestino, trigger: triggerDestino,
    getValues: getValuesDestino, formState: { errors: errorsDestino },
  } = useForm<DestinoData>({ resolver: zodResolver(destinoSchema) })

  const {
    register: regContacto, reset: resetContacto, trigger: triggerContacto,
    getValues: getValuesContacto, formState: { errors: errorsContacto },
  } = useForm<PersonaData>({ resolver: zodResolver(personaSchema) })

  const destinoModo = watch('destino_modo')
  const contactoModo = watch('contacto_modo')

  const insumosFiltrados = categoriaSeleccionada
    ? insumos.filter((i) => i.categoria === categorias.find((c) => c.id === categoriaSeleccionada)?.nombre)
    : insumos

  useEffect(() => {
    if (contactoModo !== 'existente') {
      setContactoSeleccionado(null)
      setBusquedaContacto('')
      setResultadosContacto([])
    }
    if (contactoModo !== 'nuevo') resetContacto()
  }, [contactoModo, resetContacto])

  useEffect(() => {
    if (destinoModo !== 'nuevo') resetDestino()
  }, [destinoModo, resetDestino])

  function agregarResponsablePersona(p: Persona) {
    setResponsables((prev) => [...prev, { persona_id: p.id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono }])
    setBusquedaResp('')
    setResultadosResp([])
  }

  function agregarResponsableManual() {
    if (!respManual.nombre.trim() || !respManual.telefono.trim()) {
      setError('El responsable manual requiere nombre y teléfono')
      return
    }
    setResponsables((prev) => [...prev, { persona_id: null, ...respManual }])
    setRespManual({ nombre: '', apellido: '', telefono: '' })
    setError(null)
  }

  function quitarResponsable(idx: number) {
    setResponsables((prev) => prev.filter((_, i) => i !== idx))
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

  async function crearDestino(data: DestinoData): Promise<string | null> {
    const supabase = createClient()
    const { data: res, error } = await supabase.rpc('sp_crear_destino', {
      p_nombre: data.nombre,
      p_direccion: data.direccion,
      p_municipio: data.municipio,
      p_estado_geo: data.estado_geo,
      p_referencia: data.referencia || undefined,
    })
    if (error) return null
    return (res as { id: string }).id
  }

  async function onSubmit(data: EgresoData) {
    setError(null)
    const supabase = createClient()

    // Resolver destino
    let destinoId: string | null = null
    if (data.destino_modo === 'existente') {
      if (!data.destino_id) { setError('Seleccione un destino'); return }
      destinoId = data.destino_id
    } else {
      const valid = await triggerDestino()
      if (!valid) { setError('Complete los datos del destino'); return }
      const parsed = destinoSchema.safeParse(getValuesDestino())
      if (!parsed.success) { setError('Datos del destino inválidos'); return }
      destinoId = await crearDestino(parsed.data)
      if (!destinoId) { setError('Error al registrar el destino'); return }
    }

    // Resolver persona contacto (obligatoria: quien recibe el egreso)
    let contactoId: string | null = null
    if (data.contacto_modo === 'existente') {
      if (!contactoSeleccionado) { setError('Seleccione la persona de contacto que recibe'); return }
      contactoId = contactoSeleccionado.id
    } else {
      const valid = await triggerContacto()
      if (!valid) { setError('Complete los datos de la persona de contacto'); return }
      const parsed = personaSchema.safeParse(getValuesContacto())
      if (!parsed.success) { setError('Datos de la persona de contacto inválidos'); return }
      contactoId = await crearPersona(parsed.data)
      if (!contactoId) { setError('Error al registrar la persona de contacto'); return }
    }
    if (!contactoId) { setError('La persona de contacto es obligatoria'); return }

    const { data: egresoRes, error: rpcError } = await supabase.rpc('sp_registrar_egreso', {
      p_centro_id: centroId,
      p_insumo_id: data.insumo_id,
      p_cantidad: data.cantidad,
      p_fecha: data.fecha,
      p_destino_id: destinoId ?? undefined,
      p_persona_contacto_id: contactoId ?? undefined,
      p_responsables: responsables,
      p_observaciones: data.observaciones || undefined,
    })

    if (rpcError) { setError(traducirErrorEgreso(rpcError.message)); return }

    // Vincular solicitud si fue seleccionada (HU-09)
    if (solicitudId && egresoRes) {
      const movimientoId = (egresoRes as { id: string }).id
      await supabase.rpc('sp_vincular_solicitud_egreso', {
        p_solicitud_id: solicitudId,
        p_movimiento_id: movimientoId,
      })
    }

    cerrar()
    router.refresh()
  }

  function onInvalid() {
    setError('Revisa los campos obligatorios marcados antes de registrar el egreso.')
  }

  function cerrar() {
    setAbierto(false)
    reset()
    resetDestino()
    resetContacto()
    setContactoSeleccionado(null)
    setBusquedaContacto('')
    setResultadosContacto([])
    setResponsables([])
    setRespManual({ nombre: '', apellido: '', telefono: '' })
    setBusquedaResp('')
    setResultadosResp([])
    setCategoriaSeleccionada('')
    setSolicitudId('')
    setError(null)
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Registrar egreso
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-lg p-6 my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Registrar egreso</h2>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          {/* Categoría (filtro local) */}
          <Field label="Categoría de insumo">
            <select
              className={inputCls}
              value={categoriaSeleccionada}
              onChange={(e) => { setCategoriaSeleccionada(e.target.value); setValue('insumo_id', '') }}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Field>

          {/* Insumo */}
          <Field label="Insumo *" error={errors.insumo_id?.message}>
            <select className={inputCls} {...register('insumo_id')}>
              <option value="">Seleccione un insumo…</option>
              {insumosFiltrados.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
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

          {/* Destino */}
          <div className="space-y-2">
            <label className={labelCls}>Destino *</label>
            <div className="flex gap-3">
              {(['existente', 'nuevo'] as const).map((modo) => (
                <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" value={modo} {...register('destino_modo')} className="accent-primary" />
                  {modo === 'existente' ? 'Destino existente' : 'Nuevo destino'}
                </label>
              ))}
            </div>
          </div>

          {destinoModo === 'existente' ? (
            <Field label="Seleccione destino" error={errors.destino_id?.message}>
              <select className={inputCls} {...register('destino_id')}>
                <option value="">Seleccione un destino…</option>
                {destinos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre} — {d.municipio}, {d.estado_geo}</option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="space-y-3 rounded-md bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Datos del destino</p>
              <Field label="Nombre referencial *" error={errorsDestino.nombre?.message}>
                <input className={inputCls} placeholder='Ej. "Casa profe Ana Karina"' {...regDestino('nombre')} />
              </Field>
              <Field label="Dirección *" error={errorsDestino.direccion?.message}>
                <input className={inputCls} {...regDestino('direccion')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Municipio *" error={errorsDestino.municipio?.message}>
                  <input className={inputCls} {...regDestino('municipio')} />
                </Field>
                <Field label="Estado *" error={errorsDestino.estado_geo?.message}>
                  <input className={inputCls} {...regDestino('estado_geo')} />
                </Field>
              </div>
              <Field label="Referencia (opcional)" error={errorsDestino.referencia?.message}>
                <input className={inputCls} placeholder="Indicaciones para llegar" {...regDestino('referencia')} />
              </Field>
            </div>
          )}

          {/* Persona contacto (obligatoria) */}
          <div className="space-y-2">
            <label className={labelCls}>Persona contacto (recibe) *</label>
            <div className="flex gap-3">
              {(['existente', 'nuevo'] as const).map((modo) => (
                <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" value={modo} {...register('contacto_modo')} className="accent-primary" />
                  {modo === 'existente' ? 'Buscar existente' : 'Nueva persona'}
                </label>
              ))}
            </div>
          </div>

          {contactoModo === 'existente' && (
            <div className="space-y-2 rounded-md bg-muted/40 p-3">
              {contactoSeleccionado ? (
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{contactoSeleccionado.nombre} {contactoSeleccionado.apellido}</p>
                    <p className="text-xs text-muted-foreground">{contactoSeleccionado.telefono}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setContactoSeleccionado(null); setBusquedaContacto(''); setResultadosContacto([]) }}
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
                    value={busquedaContacto}
                    onChange={async (e) => {
                      setBusquedaContacto(e.target.value)
                      setResultadosContacto(await buscarPersona(e.target.value))
                    }}
                  />
                  {resultadosContacto.length > 0 && (
                    <ul className="divide-y rounded-md border bg-background text-sm max-h-40 overflow-y-auto">
                      {resultadosContacto.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => { setContactoSeleccionado(p); setResultadosContacto([]) }}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50"
                          >
                            <span className="font-medium">{p.nombre} {p.apellido}</span>
                            <span className="ml-2 text-muted-foreground">{p.telefono}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {contactoModo === 'nuevo' && (
            <div className="space-y-3 rounded-md bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Datos de la persona contacto</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre *" error={errorsContacto.nombre?.message}>
                  <input className={inputCls} {...regContacto('nombre')} />
                </Field>
                <Field label="Apellido *" error={errorsContacto.apellido?.message}>
                  <input className={inputCls} {...regContacto('apellido')} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono *" error={errorsContacto.telefono?.message}>
                  <input className={inputCls} type="tel" {...regContacto('telefono')} />
                </Field>
                <Field label="Cédula (opcional)" error={errorsContacto.cedula?.message}>
                  <input className={inputCls} {...regContacto('cedula')} />
                </Field>
              </div>
            </div>
          )}

          {/* Responsables de entrega (opcional) */}
          <div className="space-y-2">
            <label className={labelCls}>
              Responsables de entrega <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            {responsables.length > 0 && (
              <ul className="space-y-1">
                {responsables.map((r, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm">
                    <span>
                      {r.nombre} {r.apellido}
                      <span className="ml-2 text-muted-foreground">{r.telefono}</span>
                      {r.persona_id && <span className="ml-2 text-xs text-muted-foreground">(registrado)</span>}
                    </span>
                    <button type="button" onClick={() => quitarResponsable(idx)} className="text-xs text-destructive hover:underline">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 rounded-md bg-muted/40 p-3">
              {/* Buscar persona existente */}
              <input
                className={inputCls}
                placeholder="Buscar responsable registrado…"
                value={busquedaResp}
                onChange={async (e) => {
                  setBusquedaResp(e.target.value)
                  setResultadosResp(await buscarPersona(e.target.value))
                }}
              />
              {resultadosResp.length > 0 && (
                <ul className="divide-y rounded-md border bg-background text-sm max-h-32 overflow-y-auto">
                  {resultadosResp.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => agregarResponsablePersona(p)}
                        className="w-full px-3 py-2 text-left hover:bg-muted/50"
                      >
                        <span className="font-medium">{p.nombre} {p.apellido}</span>
                        <span className="ml-2 text-muted-foreground">{p.telefono}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Manual */}
              <p className="text-xs text-muted-foreground">O ingrese uno manualmente:</p>
              <div className="grid grid-cols-3 gap-2">
                <input className={inputCls} placeholder="Nombre" value={respManual.nombre}
                  onChange={(e) => setRespManual((s) => ({ ...s, nombre: e.target.value }))} />
                <input className={inputCls} placeholder="Apellido" value={respManual.apellido}
                  onChange={(e) => setRespManual((s) => ({ ...s, apellido: e.target.value }))} />
                <input className={inputCls} placeholder="Teléfono" value={respManual.telefono}
                  onChange={(e) => setRespManual((s) => ({ ...s, telefono: e.target.value }))} />
              </div>
              <button
                type="button"
                onClick={agregarResponsableManual}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                + Agregar responsable
              </button>
            </div>
          </div>

          {/* Vincular solicitud (HU-09) */}
          {solicitudesPendientes.length > 0 && (
            <div className="space-y-1">
              <label className={labelCls}>Vincular solicitud (opcional)</label>
              <select
                className={inputCls}
                value={solicitudId}
                onChange={(e) => setSolicitudId(e.target.value)}
              >
                <option value="">Sin vincular</option>
                {solicitudesPendientes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.insumo} · {s.cantidad_solicitada} · {s.solicitante} ({s.estado === 'pendiente' ? 'Pendiente' : 'Parcial'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Observaciones */}
          <Field label="Observaciones (opcional)" error={errors.observaciones?.message}>
            <textarea className={inputCls} rows={2} {...register('observaciones')} />
          </Field>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrar} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando…' : 'Registrar egreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
