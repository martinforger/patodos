'use server'

import { createClient } from '@/lib/supabase/server'
import { voluntarioSchema } from '@/lib/validations/voluntarios'

export async function registrarVoluntario(centroId: string, formData: unknown) {
  const parsed = voluntarioSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos' }
  }

  const d = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('sp_registrar_voluntario', {
    p_centro_id:           centroId,
    p_nombres:             d.nombres,
    p_apellidos:           d.apellidos,
    p_nacionalidad:        d.nacionalidad,
    p_cedula_numero:       d.cedula_numero,
    p_telefono:            d.telefono,
    p_telefono_emergencia: d.telefono_emergencia || undefined,
    p_turno:               d.turno,
    p_tiene_laptop:        d.tiene_laptop,
    p_tiene_vehiculo:      d.tiene_vehiculo,
    p_vinculo_ucab:        d.vinculo_ucab,
    p_carrera:             d.carrera || undefined,
  })

  if (error) return { ok: false, error: error.message }

  const res = data as { ok: boolean; error?: string }
  if (!res.ok) return { ok: false, error: res.error ?? 'Error al registrar' }
  return { ok: true }
}
