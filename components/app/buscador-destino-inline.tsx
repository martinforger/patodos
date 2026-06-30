'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { inputCls } from '@/components/app/form'

export type Destino = {
  id: string
  nombre: string
  municipio: string
  estado_geo: string
  categoria?: string | null
}

type Props = {
  centroId: string
  seleccionado: Destino | null
  onSelect: (d: Destino) => void
  onCambiar: () => void
  placeholder?: string
  mensajeSinResultados?: string
}

export function BuscadorDestinoInline({
  centroId,
  seleccionado,
  onSelect,
  onCambiar,
  placeholder = 'Buscar por nombre o municipio…',
  mensajeSinResultados = 'Sin resultados. Intenta con otro término.',
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Destino[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    let cancelado = false
    const timer = setTimeout(async () => {
      if (busqueda.length < 1) { setResultados([]); setBuscando(false); return }
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('sp_buscar_destino', { p_termino: busqueda, p_centro_id: centroId })
      if (!cancelado) {
        setResultados((data as Destino[]) ?? [])
        setBuscando(false)
      }
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [busqueda, centroId])

  if (seleccionado) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
        <div>
          <p className="text-sm font-medium">{seleccionado.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {seleccionado.municipio}, {seleccionado.estado_geo}
            {seleccionado.categoria && ` · ${seleccionado.categoria}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onCambiar}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <input
        className={inputCls}
        placeholder={placeholder}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        autoComplete="off"
      />
      {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
      {!buscando && resultados.length > 0 && (
        <ul className="divide-y rounded-md border bg-background text-sm max-h-40 overflow-y-auto">
          {resultados.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => { onSelect(d); setBusqueda(''); setResultados([]) }}
                className="w-full px-3 py-2 text-left hover:bg-muted/50"
              >
                <span className="font-medium">{d.nombre}</span>
                <span className="ml-2 text-muted-foreground">{d.municipio}, {d.estado_geo}</span>
                {d.categoria && <span className="ml-2 text-muted-foreground text-xs">· {d.categoria}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!buscando && busqueda.length >= 1 && resultados.length === 0 && (
        <p className="text-xs text-muted-foreground">{mensajeSinResultados}</p>
      )}
    </div>
  )
}
