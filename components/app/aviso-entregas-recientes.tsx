'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type EntregaReciente = {
  insumo_id: string
  insumo: string
  cantidad_hoy: number | null
  veces_hoy: number | null
  cantidad_semana: number | null
  veces_semana: number | null
}

type Props = {
  centroId: string
  personaId: string | null
  grupoFamiliarId: string | null
  insumoIds: string[]
}

/**
 * Aviso NO bloqueante: si la persona o su familia ya recibió alguno de los
 * insumos seleccionados hoy o en los últimos 7 días, muestra un panel amarillo
 * para que el voluntario lo tenga en cuenta. Nunca impide registrar.
 */
export function AvisoEntregasRecientes({ centroId, personaId, grupoFamiliarId, insumoIds }: Props) {
  const [resultados, setResultados] = useState<EntregaReciente[]>([])

  // Clave estable para el efecto (evita re-consultar por cambios de referencia).
  const insumosKey = [...insumoIds].sort().join(',')

  useEffect(() => {
    let cancelado = false

    if ((!personaId && !grupoFamiliarId) || insumoIds.length === 0) {
      setResultados([])
      return
    }

    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.rpc('sp_entregas_recientes', {
        p_centro_id: centroId,
        p_persona_id: personaId as string,
        p_grupo_familiar_id: grupoFamiliarId as string,
        p_insumo_ids: insumoIds,
      })
      if (!cancelado) setResultados((data as unknown as EntregaReciente[]) ?? [])
    }, 300)

    return () => { cancelado = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centroId, personaId, grupoFamiliarId, insumosKey])

  if (resultados.length === 0) return null

  return (
    <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
      <p className="font-medium text-amber-800 dark:text-amber-300">
        ⚠ Esta {grupoFamiliarId ? 'familia' : 'persona'} ya recibió recientemente:
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
        {resultados.map(r => {
          const hoy = Number(r.cantidad_hoy ?? 0)
          const semana = Number(r.cantidad_semana ?? 0)
          return (
            <li key={r.insumo_id}>
              <span className="font-medium">{r.insumo}</span>:{' '}
              {hoy > 0 && <>{hoy.toLocaleString('es-VE')} hoy</>}
              {hoy > 0 && semana > hoy && ' · '}
              {semana > hoy && <>{semana.toLocaleString('es-VE')} en los últimos 7 días</>}
              {hoy > 0 && semana <= hoy && ' (todo hoy)'}
            </li>
          )
        })}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        Puedes registrar de todas formas si lo consideras justificado.
      </p>
    </div>
  )
}
