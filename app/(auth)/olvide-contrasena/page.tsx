'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  correo: z.string().email('Correo inválido'),
})
type FormData = z.infer<typeof schema>

export default function OlvideContrasenaPage() {
  const [enviado, setEnviado] = useState(false)
  const [correoEnviado, setCorreoEnviado] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(data.correo, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    })
    setCorreoEnviado(data.correo)
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
            ✉️
          </div>
        </div>
        <h1 className="text-2xl font-bold">Revisa tu correo</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Si existe una cuenta con{' '}
          <span className="font-medium text-foreground">{correoEnviado}</span>, recibirás un enlace
          para restablecer tu contraseña.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Si no lo ves, revisa tu carpeta de spam o correo no deseado.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">¿Olvidaste tu contraseña?</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ingresa tu correo y te enviaremos un enlace para restablecerla
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="correo">
            Correo electrónico
          </label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('correo')}
          />
          {errors.correo && <p className="text-xs text-destructive">{errors.correo.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Enviando…' : 'Enviar enlace de restablecimiento'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline hover:text-foreground">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  )
}
