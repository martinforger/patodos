import { z } from 'zod'

// Integrante ligero de una familia (no es una persona completa).
export const integranteSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  parentesco: z.string().optional(),
  fecha_nacimiento: z.string().optional(),
  es_menor: z.boolean(),
  es_bebe: z.boolean(),
})

export type IntegranteData = z.infer<typeof integranteSchema>

export const familiaSchema = z.object({
  nombre_familia: z.string().min(1, 'Nombre de la familia requerido'),
  representante_modo: z.enum(['existente', 'nuevo']),
  observaciones: z.string().optional(),
})

export type FamiliaData = z.infer<typeof familiaSchema>
