'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { voluntarioSchema, type VoluntarioData } from '@/lib/validations/voluntarios'
import { registrarVoluntario } from './actions'

type Props = {
  centroId: string
}

export function FormularioVoluntario({ centroId }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VoluntarioData>({
    resolver: zodResolver(voluntarioSchema),
    defaultValues: { tiene_laptop: false, tiene_vehiculo: false },
  })

  async function onSubmit(data: VoluntarioData) {
    setError(null)
    const resultado = await registrarVoluntario(centroId, data)
    if (!resultado.ok) {
      setError(resultado.error ?? 'Error al registrar')
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
        + Registrar voluntario
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Registrar voluntario</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombres" error={errors.nombres?.message}>
              <input className={inputCls} placeholder="Ej. María Alejandra" {...register('nombres')} />
            </Field>
            <Field label="Apellidos" error={errors.apellidos?.message}>
              <input className={inputCls} placeholder="Ej. García Pérez" {...register('apellidos')} />
            </Field>
          </div>

          <div className="flex gap-2">
            <Field label="Nac." error={errors.nacionalidad?.message}>
              <select className={`${inputCls} w-20`} {...register('nacionalidad')}>
                <option value="">—</option>
                <option value="V">V</option>
                <option value="E">E</option>
              </select>
            </Field>
            <div className="flex-1">
              <Field label="Número de cédula" error={errors.cedula_numero?.message}>
                <input
                  className={inputCls}
                  placeholder="12345678"
                  inputMode="numeric"
                  {...register('cedula_numero')}
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono" error={errors.telefono?.message}>
              <input className={inputCls} placeholder="0414-1234567" {...register('telefono')} />
            </Field>
            <Field label="Tel. emergencia (opcional)" error={errors.telefono_emergencia?.message}>
              <input className={inputCls} placeholder="0414-7654321" {...register('telefono_emergencia')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Turno (opcional)" error={errors.turno?.message}>
              <select className={inputCls} {...register('turno')}>
                <option value="">—</option>
                <option value="completo">Completo</option>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </Field>
            <Field label="Vínculo UCAB (opcional)" error={errors.vinculo_ucab?.message}>
              <select className={inputCls} {...register('vinculo_ucab')}>
                <option value="">—</option>
                <option value="estudiante">Estudiante</option>
                <option value="egresado">Egresado</option>
                <option value="profesor_empleado">Profesor/empleado</option>
                <option value="externo">Externo</option>
              </select>
            </Field>
          </div>

          <Field label="Carrera (opcional)" error={errors.carrera?.message}>
            <input className={inputCls} placeholder="Ej. Ing Informática" {...register('carrera')} />
          </Field>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...register('tiene_laptop')} />
              Tiene laptop
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...register('tiene_vehiculo')} />
              Tiene vehículo
            </label>
          </div>

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
              {isSubmitting ? 'Guardando…' : 'Registrar voluntario'}
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
