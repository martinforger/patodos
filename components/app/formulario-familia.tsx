'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { familiaSchema, type FamiliaData, type IntegranteData } from '@/lib/validations/familias'
import { personaSchema, type PersonaData } from '@/lib/validations/ingresos'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Field, LeyendaObligatoria, inputCls } from '@/components/app/form'
import { BuscadorPersonaInline } from '@/components/app/buscador-persona-inline'
import { IntegrantesEditor, integranteVacio } from '@/components/app/integrantes-editor'

type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }

export function FormularioFamilia({ centroId }: { centroId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [representante, setRepresentante] = useState<Persona | null>(null)
  const [integrantes, setIntegrantes] = useState<IntegranteData[]>([])
  const router = useRouter()

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FamiliaData>({
    resolver: zodResolver(familiaSchema),
    defaultValues: { representante_modo: 'existente' },
  })

  const {
    register: regRep, reset: resetRep, trigger: triggerRep, getValues: getValuesRep,
    formState: { errors: errorsRep },
  } = useForm<PersonaData>({ resolver: zodResolver(personaSchema) })

  const representanteModo = watch('representante_modo')

  function actualizarIntegrante(index: number, patch: Partial<IntegranteData>) {
    setIntegrantes(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  function agregarIntegrante() { setIntegrantes(prev => [...prev, { ...integranteVacio }]) }
  function quitarIntegrante(index: number) { setIntegrantes(prev => prev.filter((_, i) => i !== index)) }

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

  async function onSubmit(data: FamiliaData) {
    setError(null)

    let representanteId: string | null = null
    if (data.representante_modo === 'existente') {
      if (!representante) { setError('Seleccione un representante de la búsqueda'); return }
      representanteId = representante.id
    } else {
      const valid = await triggerRep()
      if (!valid) { setError('Complete los datos del representante'); return }
      const parsed = personaSchema.safeParse(getValuesRep())
      if (!parsed.success) { setError('Datos del representante inválidos'); return }
      representanteId = await crearPersona(parsed.data)
      if (!representanteId) { setError('Error al registrar el representante'); return }
    }

    const integrantesValidos = integrantes.filter(it => it.nombre.trim())

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_crear_grupo_familiar', {
      p_centro_id: centroId,
      p_nombre_familia: data.nombre_familia,
      p_representante_id: representanteId,
      p_observaciones: data.observaciones || undefined,
      p_integrantes: integrantesValidos,
    })
    if (rpcError) { setError(rpcError.message); return }
    cerrar()
    router.refresh()
  }

  function cerrar() {
    reset()
    resetRep()
    setRepresentante(null)
    setIntegrantes([])
    setError(null)
    setAbierto(false)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Registrar familia
      </button>

      <Dialog open={abierto} onOpenChange={(open) => { if (!open) cerrar() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar grupo familiar</DialogTitle>
            <LeyendaObligatoria />
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Nombre de la familia *" error={errors.nombre_familia?.message}>
              <input className={inputCls} placeholder='Ej. "Familia Pérez"' {...register('nombre_familia')} />
            </Field>

            {/* Representante */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Representante (quien retira) *</p>
              <div className="flex gap-4">
                {(['existente', 'nuevo'] as const).map((modo) => (
                  <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" value={modo} {...register('representante_modo')} className="accent-primary" />
                    {modo === 'existente' ? 'Buscar existente' : 'Nueva persona'}
                  </label>
                ))}
              </div>
            </div>

            {representanteModo === 'existente' && (
              <div className="rounded-md bg-muted/40 p-3">
                <BuscadorPersonaInline
                  centroId={centroId}
                  seleccionado={representante}
                  onSelect={setRepresentante}
                  onCambiar={() => setRepresentante(null)}
                  mensajeSinResultados='Sin resultados. Usa "Nueva persona" para registrarla.'
                />
              </div>
            )}

            {representanteModo === 'nuevo' && (
              <div className="space-y-3 rounded-md bg-muted/40 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre *" error={errorsRep.nombre?.message}>
                    <input className={inputCls} {...regRep('nombre')} />
                  </Field>
                  <Field label="Apellido *" error={errorsRep.apellido?.message}>
                    <input className={inputCls} {...regRep('apellido')} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Teléfono *" error={errorsRep.telefono?.message}>
                    <input className={inputCls} type="tel" {...regRep('telefono')} />
                  </Field>
                  <Field label="Cédula (opcional)" error={errorsRep.cedula?.message}>
                    <input className={inputCls} {...regRep('cedula')} />
                  </Field>
                </div>
              </div>
            )}

            <IntegrantesEditor
              integrantes={integrantes}
              onChange={actualizarIntegrante}
              onAdd={agregarIntegrante}
              onRemove={quitarIntegrante}
            />

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
                {isSubmitting ? 'Guardando…' : 'Registrar familia'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
