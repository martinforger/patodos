'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Estado = 'por_revisar' | 'en_proceso' | 'solucionado'

const etiquetas: Record<Estado, string> = {
  por_revisar: 'Por revisar',
  en_proceso: 'En proceso',
  solucionado: 'Solucionado',
}

const colores: Record<Estado, string> = {
  por_revisar: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_proceso: 'bg-blue-100 text-blue-800 border-blue-200',
  solucionado: 'bg-green-100 text-green-700 border-green-200',
}

export function CambiarEstadoBug({ bugId, estadoActual }: { bugId: string; estadoActual: Estado }) {
  const [estado, setEstado] = useState<Estado>(estadoActual)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function cambiar(nuevoEstado: Estado) {
    if (nuevoEstado === estado) { setAbierto(false); return }
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.rpc('sp_actualizar_estado_bug', {
      p_bug_id: bugId,
      p_estado: nuevoEstado,
    })
    if (err) { setError('Error al actualizar'); return }
    setEstado(nuevoEstado)
    setAbierto(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setAbierto(!abierto)}
        disabled={isPending}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${colores[estado]} hover:opacity-80`}
      >
        {etiquetas[estado]}
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-md border bg-popover shadow-md">
            {(Object.keys(etiquetas) as Estado[]).map((e) => (
              <button
                key={e}
                onClick={() => cambiar(e)}
                className={`flex w-full items-center px-3 py-2 text-xs transition-colors hover:bg-muted ${e === estado ? 'font-semibold' : ''}`}
              >
                {etiquetas[e]}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
