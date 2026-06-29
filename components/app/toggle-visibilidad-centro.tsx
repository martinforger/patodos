'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ToggleVisibilidadCentro({ centroId, esPublico }: { centroId: string; esPublico: boolean }) {
  const [valor, setValor] = useState(esPublico)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function cambiar() {
    setCargando(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_cambiar_visibilidad_centro', {
      p_centro_id: centroId,
      p_es_publico: !valor,
    })
    if (rpcError) {
      setError(rpcError.message)
    } else {
      setValor((v) => !v)
      router.refresh()
    }
    setCargando(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={cambiar}
        disabled={cargando}
        title={valor ? 'Cambiar a privado' : 'Cambiar a público'}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          valor
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-muted text-muted-foreground hover:bg-muted/70'
        }`}
      >
        {valor ? 'Público' : 'Privado'}
        <span className="text-[10px] opacity-60">{cargando ? '…' : '↕'}</span>
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
