'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { centroSchema, type CentroData } from '@/lib/validations/centros'
import { createClient } from '@/lib/supabase/client'

const ESTADOS_VE = [
  'Amazonas','Anzoátegui','Apure','Aragua','Barinas','Bolívar','Carabobo',
  'Cojedes','Delta Amacuro','Distrito Capital','Falcón','Guárico','Lara',
  'Mérida','Miranda','Monagas','Nueva Esparta','Portuguesa','Sucre','Táchira',
  'Trujillo','Vargas','Yaracuy','Zulia',
]

export function FormularioCentro() {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [esPublico, setEsPublico] = useState(true)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CentroData>({
    resolver: zodResolver(centroSchema),
    defaultValues: { es_publico: true },
  })

  function toggleVisibilidad(valor: boolean) {
    setEsPublico(valor)
    setValue('es_publico', valor)
  }

  async function onSubmit(data: CentroData) {
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_registrar_centro_acopio', {
      p_nombre: data.nombre,
      p_direccion: data.direccion,
      p_municipio: data.municipio,
      p_estado_geo: data.estado_geo,
      p_telefono: data.telefono || undefined,
      p_correo: data.correo || undefined,
      p_es_publico: data.es_publico,
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    reset()
    setEsPublico(true)
    setAbierto(false)
    router.refresh()
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Nuevo centro
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Registrar centro de acopio</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre del centro" error={errors.nombre?.message}>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono (opcional)" error={errors.telefono?.message}>
              <input className={inputCls} type="tel" {...register('telefono')} />
            </Field>
            <Field label="Correo (opcional)" error={errors.correo?.message}>
              <input className={inputCls} type="email" {...register('correo')} />
            </Field>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Visibilidad</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => toggleVisibilidad(true)}
                className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-left transition-colors ${esPublico ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 ${esPublico ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                <span>
                  <span className="font-medium block">Público</span>
                  <span className="text-xs text-muted-foreground">Cualquiera puede solicitar unirse; el coordinador aprueba</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleVisibilidad(false)}
                className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-left transition-colors ${!esPublico ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 ${!esPublico ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                <span>
                  <span className="font-medium block">Privado</span>
                  <span className="text-xs text-muted-foreground">Solo por invitación directa del coordinador</span>
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setAbierto(false); reset(); setEsPublico(true); setError(null) }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando…' : 'Registrar centro'}
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
