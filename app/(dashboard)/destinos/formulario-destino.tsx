'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { destinoSchema, type DestinoData } from '@/lib/validations/destinos'
import { createClient } from '@/lib/supabase/client'

const ESTADOS_VE = [
  'Amazonas','Anzoátegui','Apure','Aragua','Barinas','Bolívar','Carabobo',
  'Cojedes','Delta Amacuro','Distrito Capital','Falcón','Guárico','Lara',
  'Mérida','Miranda','Monagas','Nueva Esparta','Portuguesa','Sucre','Táchira',
  'Trujillo','Vargas','Yaracuy','Zulia',
]

export function FormularioDestino() {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DestinoData>({ resolver: zodResolver(destinoSchema) })

  async function onSubmit(data: DestinoData) {
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_crear_destino', {
      p_nombre: data.nombre,
      p_direccion: data.direccion,
      p_municipio: data.municipio,
      p_estado_geo: data.estado_geo,
      p_referencia: data.referencia || undefined,
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    reset()
    setAbierto(false)
    router.refresh()
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Nuevo destino
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Registrar destino</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre del destino" error={errors.nombre?.message}>
            <input className={inputCls} {...register('nombre')} />
          </Field>

          <Field label="Dirección" error={errors.direccion?.message}>
            <input className={inputCls} {...register('direccion')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Municipio" error={errors.municipio?.message}>
              <input className={inputCls} {...register('municipio')} />
            </Field>

            <Field label="Estado" error={errors.estado_geo?.message}>
              <select className={inputCls} {...register('estado_geo')}>
                <option value="">Seleccionar…</option>
                {ESTADOS_VE.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Referencia (opcional)" error={errors.referencia?.message}>
            <input className={inputCls} placeholder="Indicaciones para llegar" {...register('referencia')} />
          </Field>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setAbierto(false); reset(); setError(null) }}
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
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
