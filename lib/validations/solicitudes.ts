import { z } from 'zod'

export const solicitudSchema = z.object({
  insumo_id: z.string().uuid('Seleccione un insumo'),
  cantidad_solicitada: z.number().positive('Debe ser mayor a cero'),
  fecha: z.string().min(1, 'Fecha requerida'),
  solicitante_modo: z.enum(['existente', 'nuevo']),
  solicitante_id: z.string().uuid().optional(),
  observaciones: z.string().optional(),
})

export type SolicitudData = z.infer<typeof solicitudSchema>
