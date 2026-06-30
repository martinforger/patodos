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
import { FilaInsumoSolicitud, type ItemSolicitud } from '@/components/app/fila-insumo-solicitud'

type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }

function traducirError(msg: string): string {
  if (/stock|inventario|insuficiente/i.test(msg)) return 'Stock insuficiente para registrar el movimiento.'
  return msg
}

type Props = { centroId: string; categorias: Categoria[] }

export function FormularioIngreso({ centroId, categorias }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ItemSolicitud[]>([{ insumo_id: '', cantidad: '' }])
  const [personaSeleccionada, setPersonaSeleccionada] = useState<Persona | null>(null)

  const router = useRouter()

  const {
    register, handleSubmit, reset, watch,
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

  async function onSubmit(data: IngresoData) {
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
      const nuevaId = await crearPersona(parsed.data)
      if (!nuevaId) { setError('Error al registrar el donante'); return }
      donanteId = nuevaId
    }

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_registrar_ingreso_multiple', {
      p_centro_id: centroId,
      p_fecha: data.fecha,
      p_donante_id: donanteId ?? undefined,
      p_donante_anonimo: donanteAnonimo,
      p_observaciones: data.observaciones || undefined,
      p_items: itemsValidos.map(it => ({ insumo_id: it.insumo_id, cantidad: Number(it.cantidad) })),
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
    setItems([{ insumo_id: '', cantidad: '' }])
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

            {/* Insumos */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Insumos recibidos *</p>
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
                  onSelect={(p) => setPersonaSeleccionada(p)}
                  onCambiar={() => setPersonaSeleccionada(null)}
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
