'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { inputCls } from '@/components/app/form'

type Persona = {
  id: string
  nombre: string
  apellido: string
  telefono: string
  cedula: string | null
}

type Props = {
  seleccionado: Persona | null
  onSelect: (p: Persona) => void
  onCambiar: () => void
  placeholder?: string
  mensajeSinResultados?: string
}

export function BuscadorPersonaInline({
  seleccionado,
  onSelect,
  onCambiar,
  placeholder = 'Buscar por nombre, teléfono o cédula…',
  mensajeSinResultados = 'Sin resultados. Intenta con otro término.',
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Persona[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    let cancelado = false
    const timer = setTimeout(async () => {
      if (busqueda.length < 2) {
        setResultados([])
        setBuscando(false)
        return
      }
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('sp_buscar_persona', { p_termino: busqueda })
      if (!cancelado) {
        setResultados((data as Persona[]) ?? [])
        setBuscando(false)
      }
    }, 300)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [busqueda])

  if (seleccionado) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
        <div>
          <p className="text-sm font-medium">
            {seleccionado.nombre} {seleccionado.apellido}
          </p>
          <p className="text-xs text-muted-foreground">{seleccionado.telefono}</p>
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
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p)
                  setBusqueda('')
                  setResultados([])
                }}
                className="w-full px-3 py-2 text-left hover:bg-muted/50"
              >
                <span className="font-medium">{p.nombre} {p.apellido}</span>
                <span className="ml-2 text-muted-foreground">{p.telefono}</span>
                {p.cedula && (
                  <span className="ml-2 text-muted-foreground">CI: {p.cedula}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!buscando && busqueda.length >= 2 && resultados.length === 0 && (
        <p className="text-xs text-muted-foreground">{mensajeSinResultados}</p>
      )}
    </div>
  )
}
