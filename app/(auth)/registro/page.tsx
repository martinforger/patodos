'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { registroSchema, type RegistroData } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'

export default function RegistroPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistroData>({ resolver: zodResolver(registroSchema) })

  async function onSubmit(data: RegistroData) {
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email: data.correo,
      password: data.contrasena,
      options: {
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono,
        },
      },
    })
    if (authError) {
      setError(authError.message)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Crear cuenta</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Un administrador deberá asignarte a un centro después
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('nombre')}
            />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="apellido">Apellido</label>
            <input
              id="apellido"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('apellido')}
            />
            {errors.apellido && <p className="text-xs text-destructive">{errors.apellido.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            type="tel"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('telefono')}
          />
          {errors.telefono && <p className="text-xs text-destructive">{errors.telefono.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('correo')}
          />
          {errors.correo && <p className="text-xs text-destructive">{errors.correo.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="contrasena">Contraseña</label>
          <input
            id="contrasena"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('contrasena')}
          />
          {errors.contrasena && <p className="text-xs text-destructive">{errors.contrasena.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="confirmar">Confirmar contraseña</label>
          <input
            id="confirmar"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('confirmar')}
          />
          {errors.confirmar && <p className="text-xs text-destructive">{errors.confirmar.message}</p>}
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
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="underline hover:text-foreground">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
