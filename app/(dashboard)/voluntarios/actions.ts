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

  // Verificar cédula duplicada en el mismo centro
  const { data: existe } = await supabase
    .from('voluntario')
    .select('id')
    .eq('centro_id', centroId)
    .eq('nacionalidad', d.nacionalidad)
    .eq('cedula_numero', d.cedula_numero)
    .eq('activo', true)
    .maybeSingle()

  if (existe) {
    return { ok: false, error: 'Ya existe un voluntario con esa cédula en este centro' }
  }

  const { error } = await supabase.from('voluntario').insert({
    centro_id:           centroId,
    nombres:             d.nombres,
    apellidos:           d.apellidos,
    nacionalidad:        d.nacionalidad,
    cedula_numero:       d.cedula_numero,
    fecha_nacimiento:    d.fecha_nacimiento || null,
    telefono:            d.telefono,
    telefono_emergencia: d.telefono_emergencia || null,
    zona:                d.zona || null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
