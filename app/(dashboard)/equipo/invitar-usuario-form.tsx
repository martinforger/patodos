'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { invitarUsuarioSchema, type InvitarUsuarioData } from '@/lib/validations/equipo'
import { createClient } from '@/lib/supabase/client'

export function InvitarUsuarioForm({ centroId }: { centroId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvitarUsuarioData>({
    resolver: zodResolver(invitarUsuarioSchema),
    defaultValues: { centro_id: centroId },
  })

  async function onSubmit(data: InvitarUsuarioData) {
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_invitar_usuario_centro', {
      p_centro_id: data.centro_id,
      p_correo: data.correo,
      p_rol: data.rol,
    })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    reset({ centro_id: centroId, correo: '', rol: undefined })
    setAbierto(false)
    router.refresh()
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Agregar usuario
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card border shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Agregar usuario al centro</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('centro_id')} />

          <div className="space-y-1">
            <label className="text-sm font-medium">Correo del usuario</label>
            <input
              type="email"
              placeholder="usuario@correo.com"
              className={inputCls}
              {...register('correo')}
            />
            <p className="text-xs text-muted-foreground">
              El usuario ya debe estar registrado en el sistema.
            </p>
            {errors.correo && <p className="text-xs text-destructive">{errors.correo.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Rol</label>
            <select className={inputCls} {...register('rol')}>
              <option value="">Seleccionar rol…</option>
              <option value="operador_inventario">Operador de inventario</option>
              <option value="coordinador_centro">Coordinador de centro</option>
            </select>
            {errors.rol && <p className="text-xs text-destructive">{errors.rol.message}</p>}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setAbierto(false); reset({ centro_id: centroId }); setError(null) }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
