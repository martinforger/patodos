'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { destinoSchema, type DestinoData } from '@/lib/validations/destinos'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Field, LeyendaObligatoria, inputCls } from '@/components/app/form'
import { ESTADOS_VE } from '@/lib/constants/venezuela'

function traducirError(msg: string): string {
  if (/unique|duplicad/i.test(msg)) return 'Ya existe un destino con ese nombre.'
  return msg
}

export function FormularioDestino() {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<DestinoData>({ resolver: zodResolver(destinoSchema) })

  async function onSubmit(data: DestinoData) {
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_crear_destino', {
      p_nombre: data.nombre, p_direccion: data.direccion,
      p_municipio: data.municipio, p_estado_geo: data.estado_geo,
      p_referencia: data.referencia || undefined,
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
    setError(null)
    setAbierto(false)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Nuevo destino
      </button>

      <Dialog open={abierto} onOpenChange={(open) => { if (!open) cerrar() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar destino</DialogTitle>
            <LeyendaObligatoria />
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            <Field label="Nombre del destino *" error={errors.nombre?.message}>
              <input className={inputCls} {...register('nombre')} />
            </Field>

            <Field label="Dirección *" error={errors.direccion?.message}>
              <input className={inputCls} {...register('direccion')} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Municipio *" error={errors.municipio?.message}>
                <input className={inputCls} {...register('municipio')} />
              </Field>
              <Field label="Estado *" error={errors.estado_geo?.message}>
                <select className={inputCls} {...register('estado_geo')}>
                  <option value="">Seleccionar…</option>
                  {ESTADOS_VE.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Referencia (opcional)" error={errors.referencia?.message}>
              <input
                className={inputCls}
                placeholder="Indicaciones para llegar"
                {...register('referencia')}
              />
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
                {isSubmitting ? 'Guardando…' : 'Registrar destino'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
