'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EntregasPersonaDialog } from '@/components/app/entregas-persona-dialog'

type Persona = {
  id: string
  nombre: string
  apellido: string
  cedula: string | null
  telefono: string
  correo: string | null
  observaciones: string | null
}

export function BuscadorPersonas({ centroId }: { centroId: string }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Persona[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBuscando(true)
    setBuscado(false)
    const supabase = createClient()
    const { data } = await supabase.rpc('sp_buscar_persona', { p_termino: query.trim(), p_centro_id: centroId })
    setResultados((data as Persona[]) ?? [])
    setBuscando(false)
    setBuscado(true)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={buscar} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, apellido, teléfono o cédula…"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={buscando || !query.trim()}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {buscado && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium">Cédula</th>
                <th className="px-4 py-3 text-left font-medium">Correo</th>
                <th className="px-4 py-3 text-left font-medium">Observaciones</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resultados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No se encontraron personas con «{query}».
                  </td>
                </tr>
              ) : (
                resultados.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {p.nombre} {p.apellido}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.telefono}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.cedula ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.correo ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {p.observaciones ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <EntregasPersonaDialog
                        personaId={p.id}
                        nombre={`${p.nombre} ${p.apellido}`}
                        centroId={centroId}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!buscado && (
        <p className="text-sm text-muted-foreground">
          Ingresa un nombre, teléfono o cédula para buscar personas registradas en este centro.
        </p>
      )}
    </div>
  )
}
