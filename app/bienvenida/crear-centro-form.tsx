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

type Props = {
  /** Ruta a la que ir tras crear el centro. Por defecto el panel. */
  redirectTo?: string
  /** Texto del botón que abre el formulario. */
  label?: string
}

export function CrearCentroForm({ redirectTo = '/dashboard', label = 'Crear centro de acopio' }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CentroData>({ resolver: zodResolver(centroSchema) })

  async function onSubmit(data: CentroData) {
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_crear_centro_acopio', {
      p_nombre: data.nombre,
      p_direccion: data.direccion,
      p_municipio: data.municipio,
      p_estado_geo: data.estado_geo,
      p_telefono: data.telefono || undefined,
      p_correo: data.correo || undefined,
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {label}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Nombre del centro" error={errors.nombre?.message}>
        <input className={inputCls} {...register('nombre')} />
      </Field>

      <Field label="Dirección" error={errors.direccion?.message}>
        <input className={inputCls} {...register('direccion')} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
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

      <div className="grid grid-cols-2 gap-2">
        <Field label="Teléfono (opcional)" error={errors.telefono?.message}>
          <input className={inputCls} type="tel" {...register('telefono')} />
        </Field>
        <Field label="Correo (opcional)" error={errors.correo?.message}>
          <input className={inputCls} type="email" {...register('correo')} />
        </Field>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? 'Creando…' : 'Crear y entrar como coordinador'}
      </button>
    </form>
  )
}

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
