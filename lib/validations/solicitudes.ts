import { z } from 'zod'

// Cada renglón de insumo solicitado en una misma solicitud (multi-insumo).
export const itemSolicitudSchema = z.object({
  insumo_id: z.string().uuid('Seleccione un insumo'),
  cantidad: z.number().positive('Debe ser mayor a cero'),
})

export type ItemSolicitudData = z.infer<typeof itemSolicitudSchema>

export const solicitudSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  solicitante_modo: z.enum(['existente', 'nuevo']),
  solicitante_id: z.string().uuid().optional(),
  observaciones: z.string().optional(),
})

export type SolicitudData = z.infer<typeof solicitudSchema>
