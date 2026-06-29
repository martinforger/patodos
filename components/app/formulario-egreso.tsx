'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  egresoSchema, destinoSchema, personaSchema,
  type EgresoData, type DestinoData,
} from '@/lib/validations/egresos'
import type { PersonaData } from '@/lib/validations/ingresos'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Field, LeyendaObligatoria, inputCls } from '@/components/app/form'
import { BuscadorPersonaInline } from '@/components/app/buscador-persona-inline'
import { FilaInsumoEgreso, type ItemEgreso } from '@/components/app/fila-insumo-egreso'
import { ESTADOS_VE } from '@/lib/constants/venezuela'

type Insumo = { id: string; nombre: string; categoria: string }
type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }
type Destino = { id: string; nombre: string; municipio: string; estado_geo: string }
type Responsable = { persona_id: string | null; nombre: string; apellido: string; telefono: string }
type SolicitudPendiente = {
  id: string; insumo_id: string; insumo: string
  cantidad_solicitada: number; solicitante: string; fecha_solicitud: string; estado: string
}
type ItemInventario = { insumo_id: string; insumo: string; stock: number }
type FaltanteInfo = { insumo: string; solicitado: number; disponible: number; falta: number }

function traducirError(msg: string): string {
  if (msg.includes('persona_contacto_id'))
    return 'Debes indicar una persona de contacto que recibe el egreso.'
  if (/stock|inventario|insuficiente|cantidad/i.test(msg))
    return 'No hay stock suficiente de este insumo para registrar el egreso.'
  return msg
}

type Props = {
  centroId: string
  categorias: Categoria[]
  insumos: Insumo[]
  destinos: Destino[]
  solicitudesPendientes?: SolicitudPendiente[]
  inventario?: ItemInventario[]
}

export function FormularioEgreso({
  centroId, categorias, insumos, destinos,
  solicitudesPendientes = [], inventario = [],
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stockMap = Object.fromEntries(inventario.map(i => [i.insumo_id, i.stock]))

  const [solicitudId, setSolicitudId] = useState('')
  const [faltantes, setFaltantes] = useState<FaltanteInfo[]>([])
  const [items, setItems] = useState<ItemEgreso[]>([{ insumo_id: '', cantidad: '', solicitud_id: '' }])
  const [confirmandoFaltantes, setConfirmandoFaltantes] = useState(false)
  const [submitPayload, setSubmitPayload] = useState<(() => Promise<void>) | null>(null)

  // — Contacto —
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Persona | null>(null)

  // — Responsables —
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [respManual, setRespManual] = useState({ nombre: '', apellido: '', telefono: '' })
  const [busquedaResp, setBusquedaResp] = useState('')
  const [resultadosResp, setResultadosResp] = useState<Persona[]>([])
  const [buscandoResp, setBuscandoResp] = useState(false)

  const router = useRouter()

  // Debounce para búsqueda de responsables
  useEffect(() => {
    let cancelado = false
    const timer = setTimeout(async () => {
      if (busquedaResp.length < 2) { setResultadosResp([]); setBuscandoResp(false); return }
      setBuscandoResp(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('sp_buscar_persona', { p_termino: busquedaResp })
      if (!cancelado) {
        setResultadosResp((data as Persona[]) ?? [])
        setBuscandoResp(false)
      }
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [busquedaResp])

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<EgresoData>({
    resolver: zodResolver(egresoSchema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10), destino_modo: 'existente', contacto_modo: 'existente' },
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

  useEffect(() => {
    if (contactoModo !== 'existente') setContactoSeleccionado(null)
    if (contactoModo !== 'nuevo') resetContacto()
  }, [contactoModo, resetContacto])

  useEffect(() => {
    if (destinoModo !== 'nuevo') resetDestino()
  }, [destinoModo, resetDestino])

  function seleccionarSolicitud(id: string) {
    setSolicitudId(id)
    setFaltantes([])
    if (!id) { setItems([{ insumo_id: '', cantidad: '', solicitud_id: '' }]); return }
    const sol = solicitudesPendientes.find(s => s.id === id)
    if (!sol) return
    const stock = stockMap[sol.insumo_id] ?? 0
    const disponible = Math.min(stock, sol.cantidad_solicitada)
    if (stock < sol.cantidad_solicitada) {
      setFaltantes([{ insumo: sol.insumo, solicitado: sol.cantidad_solicitada, disponible: stock, falta: sol.cantidad_solicitada - stock }])
    }
    setItems([{ insumo_id: sol.insumo_id, cantidad: disponible > 0 ? disponible : '', solicitud_id: id }])
  }

  function actualizarItem(index: number, patch: Partial<ItemEgreso>) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  function agregarItem() {
    setItems(prev => [...prev, { insumo_id: '', cantidad: '', solicitud_id: '' }])
  }
  function quitarItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function agregarResponsablePersona(p: Persona) {
    setResponsables(prev => [...prev, { persona_id: p.id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono }])
    setBusquedaResp('')
    setResultadosResp([])
  }

  function agregarResponsableManual() {
    if (!respManual.nombre.trim() || !respManual.telefono.trim()) {
      setError('El responsable manual requiere nombre y teléfono')
      return
    }
    setResponsables(prev => [...prev, { persona_id: null, ...respManual }])
    setRespManual({ nombre: '', apellido: '', telefono: '' })
    setError(null)
  }

  function quitarResponsable(idx: number) {
    setResponsables(prev => prev.filter((_, i) => i !== idx))
  }

  async function crearPersona(data: PersonaData): Promise<string | null> {
    const supabase = createClient()
    const { data: res, error } = await supabase.rpc('sp_crear_persona', {
      p_nombre: data.nombre, p_apellido: data.apellido, p_telefono: data.telefono,
      p_cedula: data.cedula || undefined, p_correo: data.correo || undefined,
      p_observaciones: data.observaciones || undefined,
    })
    if (error) return null
    return (res as { id: string }).id
  }

  async function crearDestino(data: DestinoData): Promise<string | null> {
    const supabase = createClient()
    const { data: res, error } = await supabase.rpc('sp_crear_destino', {
      p_nombre: data.nombre, p_direccion: data.direccion, p_municipio: data.municipio,
      p_estado_geo: data.estado_geo, p_referencia: data.referencia || undefined,
    })
    if (error) return null
    return (res as { id: string }).id
  }

  async function ejecutarEnvio(
    data: EgresoData,
    destinoId: string,
    contactoId: string,
    itemsPayload: { insumo_id: string; cantidad: number; solicitud_id?: string }[]
  ) {
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_registrar_egreso_multiple', {
      p_centro_id: centroId, p_fecha: data.fecha, p_destino_id: destinoId,
      p_persona_contacto_id: contactoId, p_responsables: responsables,
      p_observaciones: data.observaciones || undefined, p_items: itemsPayload,
    })
    if (rpcError) { setError(traducirError(rpcError.message)); return }
    cerrar()
    router.refresh()
  }

  async function onSubmit(data: EgresoData) {
    setError(null)

    const itemsValidos = items.filter(it => it.insumo_id && it.cantidad !== '' && Number(it.cantidad) > 0)
    if (itemsValidos.length === 0) {
      setError('Agregue al menos un insumo con cantidad mayor a cero.')
      return
    }
    if (new Set(itemsValidos.map(it => it.insumo_id)).size !== itemsValidos.length) {
      setError('Hay insumos repetidos. Use un solo renglón por insumo.')
      return
    }

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

    const itemsPayload = itemsValidos.map(it => ({
      insumo_id: it.insumo_id, cantidad: Number(it.cantidad),
      solicitud_id: it.solicitud_id || undefined,
    }))

    const dId = destinoId!
    const cId = contactoId!

    if (faltantes.length > 0 && solicitudId) {
      setSubmitPayload(() => () => ejecutarEnvio(data, dId, cId, itemsPayload))
      setConfirmandoFaltantes(true)
      return
    }

    await ejecutarEnvio(data, dId, cId, itemsPayload)
  }

  function onInvalid() {
    setError('Revisa los campos obligatorios marcados antes de continuar.')
  }

  function cerrar() {
    reset()
    resetDestino()
    resetContacto()
    setContactoSeleccionado(null)
    setResponsables([])
    setRespManual({ nombre: '', apellido: '', telefono: '' })
    setBusquedaResp('')
    setResultadosResp([])
    setItems([{ insumo_id: '', cantidad: '', solicitud_id: '' }])
    setSolicitudId('')
    setFaltantes([])
    setConfirmandoFaltantes(false)
    setSubmitPayload(null)
    setError(null)
    setAbierto(false)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Registrar egreso
      </button>

      {/* Diálogo de confirmación por insumos faltantes */}
      <Dialog open={confirmandoFaltantes} onOpenChange={(open) => { if (!open) setConfirmandoFaltantes(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar egreso con insumos faltantes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No hay suficiente stock para cubrir toda la solicitud. El egreso se registrará con lo disponible:
          </p>
          <ul className="space-y-2">
            {faltantes.map((f, i) => (
              <li key={i} className="rounded-md border bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
                <span className="font-medium">{f.insumo}</span>
                <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                  <div>Solicitado: <span className="font-medium">{f.solicitado.toLocaleString('es-VE')}</span></div>
                  <div>Disponible: <span className="font-medium text-foreground">{f.disponible.toLocaleString('es-VE')}</span></div>
                  <div className="text-amber-700 dark:text-amber-400 font-medium">
                    Falta: {f.falta.toLocaleString('es-VE')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm">
            ¿Deseas enviar el egreso con los insumos disponibles y dejar la solicitud como{' '}
            <strong>parcialmente atendida</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmandoFaltantes(false)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Volver al formulario
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmandoFaltantes(false)
                if (submitPayload) await submitPayload()
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sí, enviar con lo disponible
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Formulario principal */}
      <Dialog open={abierto && !confirmandoFaltantes} onOpenChange={(open) => { if (!open) cerrar() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar egreso</DialogTitle>
            <LeyendaObligatoria />
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">

            {/* Solicitud asociada */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Solicitud asociada{' '}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <select
                className={inputCls}
                value={solicitudId}
                onChange={(e) => seleccionarSolicitud(e.target.value)}
              >
                <option value="">Sin solicitud — egreso libre</option>
                {solicitudesPendientes.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.insumo} · {s.cantidad_solicitada.toLocaleString('es-VE')} · {s.solicitante}{' '}
                    ({s.estado === 'pendiente' ? 'Pendiente' : 'Parcial'})
                  </option>
                ))}
              </select>

              {solicitudId && (() => {
                const sol = solicitudesPendientes.find(s => s.id === solicitudId)!
                const stock = stockMap[sol.insumo_id] ?? 0
                const suficiente = stock >= sol.cantidad_solicitada
                return (
                  <div className={`rounded-md border px-3 py-2 text-sm space-y-1 ${
                    suficiente
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  }`}>
                    <p className="font-medium">{sol.insumo}</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>
                        Solicitado por{' '}
                        <span className="font-medium text-foreground">{sol.solicitante}</span>:{' '}
                        <span className="font-medium text-foreground">
                          {sol.cantidad_solicitada.toLocaleString('es-VE')}
                        </span>
                      </div>
                      <div>
                        En inventario:{' '}
                        <span className={`font-medium ${suficiente ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                          {stock.toLocaleString('es-VE')}
                        </span>
                      </div>
                      {suficiente
                        ? <div className="text-green-700 dark:text-green-400 font-medium">Hay stock suficiente — insumos autocargados.</div>
                        : <div className="text-amber-700 dark:text-amber-400 font-medium">
                            Falta: {(sol.cantidad_solicitada - stock).toLocaleString('es-VE')} — se precargó lo disponible.
                          </div>
                      }
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Insumos a despachar */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Insumos a despachar *</p>
              {items.map((it, idx) => (
                <FilaInsumoEgreso
                  key={idx}
                  item={it}
                  index={idx}
                  categorias={categorias}
                  insumos={insumos}
                  solicitudesPendientes={solicitudesPendientes}
                  stockMap={stockMap}
                  onChange={actualizarItem}
                  onRemove={quitarItem}
                  removable={items.length > 1}
                />
              ))}
              <button
                type="button"
                onClick={agregarItem}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                + Agregar insumo
              </button>
            </div>

            {/* Fecha */}
            <Field label="Fecha *" error={errors.fecha?.message}>
              <input className={inputCls} type="date" {...register('fecha')} />
            </Field>

            {/* Destino */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Destino *</p>
              <div className="flex gap-4">
                {(['existente', 'nuevo'] as const).map(modo => (
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
                  {destinos.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} — {d.municipio}, {d.estado_geo}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="space-y-3 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Datos del destino
                </p>
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
                    <select className={inputCls} {...regDestino('estado_geo')}>
                      <option value="">Seleccionar…</option>
                      {ESTADOS_VE.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Referencia (opcional)" error={errorsDestino.referencia?.message}>
                  <input className={inputCls} placeholder="Indicaciones para llegar" {...regDestino('referencia')} />
                </Field>
              </div>
            )}

            {/* Persona contacto */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Persona contacto (recibe) *</p>
              <div className="flex gap-4">
                {(['existente', 'nuevo'] as const).map(modo => (
                  <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" value={modo} {...register('contacto_modo')} className="accent-primary" />
                    {modo === 'existente' ? 'Buscar existente' : 'Nueva persona'}
                  </label>
                ))}
              </div>
            </div>

            {contactoModo === 'existente' && (
              <div className="rounded-md bg-muted/40 p-3">
                <BuscadorPersonaInline
                  seleccionado={contactoSeleccionado}
                  onSelect={(p) => setContactoSeleccionado(p)}
                  onCambiar={() => setContactoSeleccionado(null)}
                  mensajeSinResultados='Sin resultados. Usa "Nueva persona" para registrarla.'
                />
              </div>
            )}

            {contactoModo === 'nuevo' && (
              <div className="space-y-3 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Datos de la persona contacto
                </p>
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

            {/* Responsables de entrega */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Responsables de entrega{' '}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>

              {responsables.length > 0 && (
                <ul className="space-y-1">
                  {responsables.map((r, idx) => (
                    <li key={idx} className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm">
                      <span>
                        {r.nombre} {r.apellido}
                        <span className="ml-2 text-muted-foreground">{r.telefono}</span>
                        {r.persona_id && (
                          <span className="ml-2 text-xs text-muted-foreground">(registrado)</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarResponsable(idx)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2 rounded-md bg-muted/40 p-3">
                {/* Búsqueda con debounce */}
                <div className="space-y-1.5">
                  <input
                    className={inputCls}
                    placeholder="Buscar responsable registrado…"
                    value={busquedaResp}
                    onChange={(e) => setBusquedaResp(e.target.value)}
                    autoComplete="off"
                  />
                  {buscandoResp && <p className="text-xs text-muted-foreground">Buscando…</p>}
                  {!buscandoResp && resultadosResp.length > 0 && (
                    <ul className="divide-y rounded-md border bg-background text-sm max-h-32 overflow-y-auto">
                      {resultadosResp.map(p => (
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
                  {!buscandoResp && busquedaResp.length >= 2 && resultadosResp.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin resultados. Usa el formulario manual.</p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">O ingrese uno manualmente:</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    className={inputCls}
                    placeholder="Nombre *"
                    value={respManual.nombre}
                    onChange={(e) => setRespManual(s => ({ ...s, nombre: e.target.value }))}
                  />
                  <input
                    className={inputCls}
                    placeholder="Apellido"
                    value={respManual.apellido}
                    onChange={(e) => setRespManual(s => ({ ...s, apellido: e.target.value }))}
                  />
                  <input
                    className={inputCls}
                    placeholder="Teléfono *"
                    value={respManual.telefono}
                    onChange={(e) => setRespManual(s => ({ ...s, telefono: e.target.value }))}
                  />
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
                {isSubmitting ? 'Guardando…' : 'Registrar egreso'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
