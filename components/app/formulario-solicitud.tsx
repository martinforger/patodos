'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { solicitudSchema, type SolicitudData } from '@/lib/validations/solicitudes'
import { personaSchema, type PersonaData } from '@/lib/validations/ingresos'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Field, LeyendaObligatoria, inputCls } from '@/components/app/form'
import { BuscadorPersonaInline } from '@/components/app/buscador-persona-inline'
import { BuscadorFamiliaInline, type Familia } from '@/components/app/buscador-familia-inline'
import { AvisoEntregasRecientes } from '@/components/app/aviso-entregas-recientes'
import { BuscadorDestinoInline, type Destino } from '@/components/app/buscador-destino-inline'
import { FilaInsumoSolicitud, type ItemSolicitud } from '@/components/app/fila-insumo-solicitud'

type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }

function traducirError(msg: string): string {
  if (/stock|inventario|insuficiente/i.test(msg)) return 'Stock insuficiente para esta solicitud.'
  if (/insumo/i.test(msg)) return 'El insumo seleccionado no es válido.'
  return msg
}

type Props = { centroId: string; categorias: Categoria[] }

export function FormularioSolicitud({ centroId, categorias }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [solicitanteSeleccionado, setSolicitanteSeleccionado] = useState<Persona | null>(null)
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState<Familia | null>(null)

  const [items, setItems] = useState<ItemSolicitud[]>([{ insumo_id: '', cantidad: '' }])
  const [sinDestino, setSinDestino] = useState(true)
  const [destinoSeleccionado, setDestinoSeleccionado] = useState<Destino | null>(null)

  const router = useRouter()

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<SolicitudData>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10), solicitante_modo: 'existente' },
  })

  const {
    register: regSol, reset: resetSol,
    formState: { errors: errorsSol },
    trigger: triggerSol, getValues: getValuesSol,
  } = useForm<PersonaData>({ resolver: zodResolver(personaSchema) })

  const solicitanteModo = watch('solicitante_modo')

  function seleccionarFamilia(f: Familia) {
    setFamiliaSeleccionada(f)
    // El representante de la familia pasa a ser el solicitante.
    setValue('solicitante_modo', 'existente')
    setSolicitanteSeleccionado({
      id: f.representante_id,
      nombre: f.representante_nombre,
      apellido: f.representante_apellido,
      telefono: f.representante_telefono ?? '',
      cedula: f.representante_cedula,
    })
  }

  function actualizarItem(index: number, patch: Partial<ItemSolicitud>) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  function agregarItem() {
    setItems(prev => [...prev, { insumo_id: '', cantidad: '' }])
  }
  function quitarItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
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

  async function onSubmit(data: SolicitudData) {
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

    let solicitanteId: string | null = null
    if (data.solicitante_modo === 'existente') {
      if (!solicitanteSeleccionado) { setError('Seleccione un solicitante de la búsqueda'); return }
      solicitanteId = solicitanteSeleccionado.id
    } else {
      const valid = await triggerSol()
      if (!valid) { setError('Complete los datos del solicitante'); return }
      const parsed = personaSchema.safeParse(getValuesSol())
      if (!parsed.success) { setError('Datos del solicitante inválidos'); return }
      solicitanteId = await crearPersona(parsed.data)
      if (!solicitanteId) { setError('Error al registrar el solicitante'); return }
    }

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_registrar_solicitud_multiple', {
      p_centro_id: centroId,
      p_solicitante_id: solicitanteId,
      p_fecha: data.fecha,
      p_destino_id: sinDestino ? undefined : (destinoSeleccionado?.id ?? undefined),
      p_observaciones: data.observaciones || undefined,
      p_items: itemsValidos.map(it => ({ insumo_id: it.insumo_id, cantidad: Number(it.cantidad) })),
      p_grupo_familiar_id: familiaSeleccionada?.id ?? undefined,
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
    resetSol()
    setSolicitanteSeleccionado(null)
    setFamiliaSeleccionada(null)
    setItems([{ insumo_id: '', cantidad: '' }])
    setSinDestino(true)
    setDestinoSeleccionado(null)
    setError(null)
    setAbierto(false)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Registrar solicitud
      </button>

      <Dialog open={abierto} onOpenChange={(open) => { if (!open) cerrar() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar solicitud de ayuda</DialogTitle>
            <LeyendaObligatoria />
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">

            {/* Insumos solicitados */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Insumos solicitados *</p>
              {items.map((it, idx) => (
                <FilaInsumoSolicitud
                  key={idx}
                  item={it}
                  index={idx}
                  centroId={centroId}
                  categorias={categorias}
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

            <Field label="Fecha *" error={errors.fecha?.message}>
              <input className={inputCls} type="date" {...register('fecha')} />
            </Field>

            {/* Destino opcional */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Destino <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={sinDestino}
                  onChange={(e) => { setSinDestino(e.target.checked); if (e.target.checked) setDestinoSeleccionado(null) }}
                  className="accent-primary"
                />
                Sin destino específico
              </label>
              {!sinDestino && (
                <div className="rounded-md bg-muted/40 p-3">
                  <BuscadorDestinoInline
                    centroId={centroId}
                    seleccionado={destinoSeleccionado}
                    onSelect={setDestinoSeleccionado}
                    onCambiar={() => setDestinoSeleccionado(null)}
                  />
                </div>
              )}
            </div>

            {/* Grupo familiar (opcional) */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Grupo familiar{' '}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>
              <div className="rounded-md bg-muted/40 p-3">
                <BuscadorFamiliaInline
                  centroId={centroId}
                  seleccionada={familiaSeleccionada}
                  onSelect={seleccionarFamilia}
                  onCambiar={() => setFamiliaSeleccionada(null)}
                />
                {familiaSeleccionada && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    El representante quedó como solicitante.
                  </p>
                )}
              </div>
            </div>

            {/* Solicitante */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Solicitante *</p>
              <div className="flex gap-4">
                {(['existente', 'nuevo'] as const).map((modo) => (
                  <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value={modo}
                      {...register('solicitante_modo')}
                      className="accent-primary"
                    />
                    {modo === 'existente' ? 'Buscar existente' : 'Nueva persona'}
                  </label>
                ))}
              </div>
            </div>

            {solicitanteModo === 'existente' && (
              <div className="rounded-md bg-muted/40 p-3">
                <BuscadorPersonaInline
                  centroId={centroId}
                  seleccionado={solicitanteSeleccionado}
                  onSelect={(p) => setSolicitanteSeleccionado(p)}
                  onCambiar={() => setSolicitanteSeleccionado(null)}
                  mensajeSinResultados='Sin resultados. Usa "Nueva persona" para registrarla.'
                />
              </div>
            )}

            {solicitanteModo === 'nuevo' && (
              <div className="space-y-3 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Datos del solicitante
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre *" error={errorsSol.nombre?.message}>
                    <input className={inputCls} {...regSol('nombre')} />
                  </Field>
                  <Field label="Apellido *" error={errorsSol.apellido?.message}>
                    <input className={inputCls} {...regSol('apellido')} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Teléfono *" error={errorsSol.telefono?.message}>
                    <input className={inputCls} type="tel" {...regSol('telefono')} />
                  </Field>
                  <Field label="Cédula (opcional)" error={errorsSol.cedula?.message}>
                    <input className={inputCls} {...regSol('cedula')} />
                  </Field>
                </div>
              </div>
            )}

            {/* Aviso de entregas recientes (no bloqueante) */}
            <AvisoEntregasRecientes
              centroId={centroId}
              personaId={solicitanteSeleccionado?.id ?? null}
              grupoFamiliarId={familiaSeleccionada?.id ?? null}
              insumoIds={items.filter(it => it.insumo_id).map(it => it.insumo_id)}
            />

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
                {isSubmitting ? 'Guardando…' : 'Registrar solicitud'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
