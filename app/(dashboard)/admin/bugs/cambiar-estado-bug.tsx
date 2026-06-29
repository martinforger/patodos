'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

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
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function cambiar(nuevoEstado: Estado) {
    if (nuevoEstado === estado) return
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.rpc('sp_actualizar_estado_bug', {
      p_bug_id: bugId,
      p_estado: nuevoEstado,
    })
    if (err) { setError('Error al actualizar'); return }
    setEstado(nuevoEstado)
    startTransition(() => router.refresh())
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isPending}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${colores[estado]} hover:opacity-80 disabled:opacity-50`}
          >
            {etiquetas[estado]}
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.keys(etiquetas) as Estado[]).map((e) => (
            <DropdownMenuItem
              key={e}
              onClick={() => cambiar(e)}
              className={e === estado ? 'font-semibold' : ''}
            >
              {etiquetas[e]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
