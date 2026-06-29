'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { usePathname } from 'next/navigation'
import { bugSchema, type BugData } from '@/lib/validations/bugs'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Field, LeyendaObligatoria, inputCls } from '@/components/app/form'
import { Bug } from 'lucide-react'

export function FormularioBug() {
  const [abierto, setAbierto] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pathname = usePathname()

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<BugData>({
    resolver: zodResolver(bugSchema),
    defaultValues: { pagina: pathname },
  })

  function cerrar() {
    setAbierto(false)
    setEnviado(false)
    setError(null)
    reset({ pagina: pathname })
  }

  async function onSubmit(data: BugData) {
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.rpc('sp_crear_reporte_bug', {
      p_titulo: data.titulo,
      p_descripcion: data.descripcion,
      p_pagina: data.pagina || pathname,
    })
    if (err) { setError('No se pudo enviar el reporte. Intenta de nuevo.'); return }
    setEnviado(true)
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) cerrar(); else setAbierto(true) }}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
          <Bug className="h-4 w-4 shrink-0" />
          Reportar bug
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar un problema</DialogTitle>
          {!enviado && <LeyendaObligatoria />}
        </DialogHeader>

        {enviado ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm font-medium text-green-700">¡Reporte enviado con éxito!</p>
            <p className="text-sm text-muted-foreground">
              El equipo revisará el problema pronto. Gracias por tu ayuda.
            </p>
            <button
              onClick={cerrar}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <Field label="Título del problema *" error={errors.titulo?.message}>
              <input
                {...register('titulo')}
                className={inputCls}
                placeholder="Ej: El botón de guardar no funciona"
              />
            </Field>

            <Field label="Descripción *" error={errors.descripcion?.message}>
              <textarea
                {...register('descripcion')}
                rows={4}
                className={inputCls}
                placeholder="Describe qué pasó, qué esperabas que pasara y los pasos para reproducirlo."
              />
            </Field>

            <Field label="Página donde ocurrió" error={errors.pagina?.message}>
              <input
                {...register('pagina')}
                className={inputCls}
                placeholder="/ingresos"
              />
            </Field>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cerrar}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
