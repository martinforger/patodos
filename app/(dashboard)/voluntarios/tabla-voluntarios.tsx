'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Voluntario } from './page'

type Props = {
  voluntarios: Voluntario[]
}

const TURNO_LABEL: Record<string, string> = {
  completo: 'Completo',
  manana: 'Mañana',
  tarde: 'Tarde',
}

const VINCULO_LABEL: Record<string, string> = {
  estudiante: 'Estudiante',
  egresado: 'Egresado/a',
  profesor_empleado: 'Prof./Empl.',
  externo: 'Externo',
}

export function TablaVoluntarios({ voluntarios }: Props) {
  if (voluntarios.length === 0) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-10 text-center text-muted-foreground text-sm">
          No hay voluntarios registrados aún.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Voluntario</th>
            <th className="px-4 py-3 text-left font-medium">Cédula</th>
            <th className="px-4 py-3 text-left font-medium">Turno</th>
            <th className="px-4 py-3 text-left font-medium">Vínculo</th>
            <th className="px-4 py-3 text-left font-medium">Carrera</th>
            <th className="px-4 py-3 text-center font-medium">Laptop</th>
            <th className="px-4 py-3 text-center font-medium">Vehículo</th>
            <th className="px-4 py-3 text-center font-medium">Asistencia hoy</th>
            <th className="px-4 py-3 text-center font-medium">Comida 1</th>
            <th className="px-4 py-3 text-center font-medium">Comida 2</th>
            <th className="px-4 py-3 text-center font-medium">Comida 3</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {voluntarios.map((v) => (
            <FilaVoluntario key={v.id} voluntario={v} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilaVoluntario({ voluntario: v }: { voluntario: Voluntario }) {
  const router = useRouter()
  const [cargando, setCargando] = useState<number | null>(null)
  const [errores, setErrores] = useState<Record<number, string>>({})

  async function marcarComida(asistenciaId: string, numero: number, comio: boolean) {
    setCargando(numero)
    setErrores((prev) => ({ ...prev, [numero]: '' }))
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('sp_marcar_comida', {
      p_asistencia_id: asistenciaId,
      p_numero_comida: numero,
      p_comio: comio,
    })
    setCargando(null)
    if (rpcError) {
      setErrores((prev) => ({ ...prev, [numero]: rpcError.message }))
      return
    }
    const res = data as { ok: boolean; error?: string }
    if (!res?.ok) {
      setErrores((prev) => ({ ...prev, [numero]: res?.error ?? 'Error' }))
      return
    }
    router.refresh()
  }

  const asistencia = v.asistencia_hoy
  const hora = asistencia
    ? new Date(asistencia.hora_checkin).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium">{v.apellidos}, {v.nombres}</p>
        <p className="text-xs text-muted-foreground">{v.telefono}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground tabular-nums">
        {v.nacionalidad}-{v.cedula_numero}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {v.turno ? TURNO_LABEL[v.turno] ?? v.turno : '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {v.vinculo_ucab ? VINCULO_LABEL[v.vinculo_ucab] ?? v.vinculo_ucab : '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {v.carrera ?? '—'}
      </td>
      <td className="px-4 py-3 text-center">
        {v.tiene_laptop ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">Sí</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {v.tiene_vehiculo ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Sí</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {asistencia ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            ✓ {hora}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            Ausente
          </span>
        )}
      </td>
      {[1, 2, 3].map((num) => {
        const comida = asistencia?.comidas?.find((c) => c.numero === num)
        const tieneAsistencia = Boolean(asistencia)
        const elegible = comida?.elegible ?? false
        const comio = comida?.comio ?? false
        const marcado = comida?.marcado ?? false

        if (!tieneAsistencia) {
          return (
            <td key={num} className="px-4 py-3 text-center">
              <span className="text-muted-foreground/40">—</span>
            </td>
          )
        }

        return (
          <td key={num} className="px-4 py-3 text-center">
            <div className="flex flex-col items-center gap-1">
              {elegible ? (
                <label className={`flex items-center gap-1.5 cursor-pointer ${cargando === num ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={marcado && comio}
                    disabled={cargando !== null}
                    onChange={(e) => marcarComida(asistencia!.id, num, e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs">{marcado && comio ? 'Comió' : 'Marcar'}</span>
                </label>
              ) : (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                  {comida
                    ? `Desde ${new Date(comida.elegible_desde).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`
                    : '—'}
                </span>
              )}
              {errores[num] && (
                <p className="text-xs text-destructive">{errores[num]}</p>
              )}
            </div>
          </td>
        )
      })}
    </tr>
  )
}
