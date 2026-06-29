'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { asignarUsuarioSchema, type AsignarUsuarioData } from '@/lib/validations/usuarios'
import { createClient } from '@/lib/supabase/client'

type Props = {
  centros: { id: string; nombre: string }[]
  usuarios: { id: string; nombre: string; apellido: string; correo: string }[]
}

export function AsignarUsuarioForm({ centros, usuarios }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AsignarUsuarioData>({ resolver: zodResolver(asignarUsuarioSchema) })

  async function onSubmit(data: AsignarUsuarioData) {
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_asignar_usuario_centro', {
      p_usuario_id: data.usuario_id,
      p_centro_id: data.centro_id,
      p_rol: data.rol,
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
        + Asignar usuario
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card border shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Asignar usuario a centro</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Usuario</label>
            <select className={inputCls} {...register('usuario_id')}>
              <option value="">Seleccionar usuario…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} — {u.correo}
                </option>
              ))}
            </select>
            {errors.usuario_id && <p className="text-xs text-destructive">{errors.usuario_id.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Centro de acopio</label>
            <select className={inputCls} {...register('centro_id')}>
              <option value="">Seleccionar centro…</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            {errors.centro_id && <p className="text-xs text-destructive">{errors.centro_id.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Rol</label>
            <select className={inputCls} {...register('rol')}>
              <option value="">Seleccionar rol…</option>
              <option value="operador_inventario">Operador de inventario</option>
              <option value="coordinador_centro">Coordinador de centro</option>
              <option value="administrador_sistema">Administrador del sistema</option>
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
              {isSubmitting ? 'Guardando…' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
