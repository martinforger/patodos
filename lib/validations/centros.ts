import { z } from 'zod'

export const centroSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  direccion: z.string().min(5, 'Dirección requerida'),
  municipio: z.string().min(2, 'Municipio requerido'),
  estado_geo: z.string().min(2, 'Estado requerido'),
  telefono: z.string().optional(),
  correo: z.string().email('Correo inválido').optional().or(z.literal('')),
  es_publico: z.boolean(),
})

export type CentroData = z.infer<typeof centroSchema>
