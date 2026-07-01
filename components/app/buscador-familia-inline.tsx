'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { inputCls } from '@/components/app/form'

export type Familia = {
  id: string
  nombre_familia: string
  representante_id: string
  representante_nombre: string
  representante_apellido: string
  representante_telefono: string | null
  representante_cedula: string | null
  total_integrantes: number
  bebes: number
}

type Props = {
  centroId: string
  seleccionada: Familia | null
  onSelect: (f: Familia) => void
  onCambiar: () => void
}

export function BuscadorFamiliaInline({ centroId, seleccionada, onSelect, onCambiar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Familia[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    let cancelado = false
    const timer = setTimeout(async () => {
      if (busqueda.length < 2) { setResultados([]); setBuscando(false); return }
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('sp_buscar_grupo_familiar', { p_termino: busqueda, p_centro_id: centroId })
      if (!cancelado) {
        setResultados((data as unknown as Familia[]) ?? [])
        setBuscando(false)
      }
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [busqueda, centroId])

  if (seleccionada) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
        <div>
          <p className="text-sm font-medium">{seleccionada.nombre_familia}</p>
          <p className="text-xs text-muted-foreground">
            Representa {seleccionada.representante_nombre} {seleccionada.representante_apellido}
            {' · '}{seleccionada.total_integrantes} integrante{seleccionada.total_integrantes !== 1 ? 's' : ''}
            {seleccionada.bebes > 0 && ` · ${seleccionada.bebes} bebé${seleccionada.bebes !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button type="button" onClick={onCambiar} className="text-xs text-muted-foreground hover:text-foreground">
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <input
        className={inputCls}
        placeholder="Buscar familia por nombre o representante…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        autoComplete="off"
      />
      {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
      {!buscando && resultados.length > 0 && (
        <ul className="divide-y rounded-md border bg-background text-sm max-h-40 overflow-y-auto">
          {resultados.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => { onSelect(f); setBusqueda(''); setResultados([]) }}
                className="w-full px-3 py-2 text-left hover:bg-muted/50"
              >
                <span className="font-medium">{f.nombre_familia}</span>
                <span className="ml-2 text-muted-foreground">
                  {f.representante_nombre} {f.representante_apellido}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!buscando && busqueda.length >= 2 && resultados.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Sin resultados. Regístrala en la sección Familias.
        </p>
      )}
    </div>
  )
}
