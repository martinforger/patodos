'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { asistenciaCedulaSchema, type AsistenciaCedulaData } from '@/lib/validations/voluntarios'
import { createClient } from '@/lib/supabase/client'

type Props = {
  centroId: string
}

type Resultado =
  | { tipo: 'registrado'; nombre: string; hora: string }
  | { tipo: 'ya_registrado'; nombre: string; hora: string }
  | { tipo: 'no_encontrado' }
  | null

export function FormularioAsistencia({ centroId }: Props) {
  const [resultado, setResultado] = useState<Resultado>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AsistenciaCedulaData>({ resolver: zodResolver(asistenciaCedulaSchema) })

  async function onSubmit(data: AsistenciaCedulaData) {
    setResultado(null)
    const supabase = createClient()
    const { data: respuesta, error } = await supabase.rpc('sp_registrar_asistencia_voluntario', {
      p_centro_id:     centroId,
      p_nacionalidad:  data.nacionalidad,
      p_cedula_numero: data.cedula_numero,
    })

    if (error) return

    const res = respuesta as {
      ok: boolean
      estado: 'registrado' | 'ya_registrado' | 'no_encontrado'
      nombre?: string
      hora?: string
    }

    if (!res?.ok) {
      setResultado({ tipo: 'no_encontrado' })
      return
    }

    if (res.estado === 'ya_registrado') {
      setResultado({ tipo: 'ya_registrado', nombre: res.nombre!, hora: res.hora! })
    } else {
      setResultado({ tipo: 'registrado', nombre: res.nombre!, hora: res.hora! })
    }
  }

  if (resultado?.tipo === 'registrado') {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
        <p className="text-5xl">✅</p>
        <div>
          <p className="text-lg font-bold">{resultado.nombre}</p>
          <p className="text-sm text-muted-foreground">Asistencia registrada</p>
          <p className="text-2xl font-bold mt-2 tabular-nums">
            {new Date(resultado.hora).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => { setResultado(null); reset() }}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors w-full"
        >
          Registrar otro voluntario
        </button>
      </div>
    )
  }

  if (resultado?.tipo === 'ya_registrado') {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
        <p className="text-5xl">ℹ️</p>
        <div>
          <p className="text-lg font-bold">{resultado.nombre}</p>
          <p className="text-sm text-muted-foreground">Ya registrado hoy</p>
          <p className="text-2xl font-bold mt-2 tabular-nums">
            {new Date(resultado.hora).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => { setResultado(null); reset() }}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors w-full"
        >
          Volver
        </button>
      </div>
    )
  }

  if (resultado?.tipo === 'no_encontrado') {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
        <p className="text-5xl">👤</p>
        <div>
          <p className="text-base font-semibold">Voluntario no encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Esta cédula no está registrada en este centro.
            Por favor, acércate al coordinador para registrarte.
          </p>
        </div>
        <button
          onClick={() => { setResultado(null); reset() }}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors w-full"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Ingresa tu cédula para registrar tu asistencia de hoy.
        </p>

        <div className="flex gap-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nac.</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-20"
              {...register('nacionalidad')}
            >
              <option value="">—</option>
              <option value="V">V</option>
              <option value="E">E</option>
            </select>
            {errors.nacionalidad && (
              <p className="text-xs text-destructive">{errors.nacionalidad.message}</p>
            )}
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium">Número de cédula</label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="12345678"
              inputMode="numeric"
              {...register('cedula_numero')}
            />
            {errors.cedula_numero && (
              <p className="text-xs text-destructive">{errors.cedula_numero.message}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Registrando…' : 'Registrar asistencia'}
        </button>
      </form>
    </div>
  )
}
