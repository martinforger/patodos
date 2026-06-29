'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const schema = z
  .object({
    contrasena: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmar: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  })

type FormData = z.infer<typeof schema>

export default function RestablecerContrasenaPage() {
  const router = useRouter()
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    // Supabase maneja el token de recovery desde el hash de la URL automáticamente.
    // Solo necesitamos escuchar el evento para saber que la sesión recovery está activa.
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function onSubmit(data: FormData) {
    setError(null)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.contrasena,
    })
    if (updateError) {
      setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.')
      return
    }
    setListo(true)
    setTimeout(() => router.push('/login'), 2500)
  }

  if (listo) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
            ✅
          </div>
        </div>
        <h1 className="text-2xl font-bold">Contraseña actualizada</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Tu contraseña fue cambiada correctamente. Redirigiendo al inicio de sesión…
        </p>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-muted-foreground text-sm">Verificando enlace…</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Nueva contraseña</h1>
        <p className="text-muted-foreground mt-1 text-sm">Elige una contraseña segura para tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="contrasena">
            Nueva contraseña
          </label>
          <input
            id="contrasena"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('contrasena')}
          />
          {errors.contrasena && (
            <p className="text-xs text-destructive">{errors.contrasena.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="confirmar">
            Confirmar contraseña
          </label>
          <input
            id="confirmar"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('confirmar')}
          />
          {errors.confirmar && (
            <p className="text-xs text-destructive">{errors.confirmar.message}</p>
          )}
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
          {isSubmitting ? 'Guardando…' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  )
}
