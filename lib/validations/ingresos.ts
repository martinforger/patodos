import { z } from 'zod'

export const personaSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  apellido: z.string().min(1, 'Apellido requerido'),
  telefono: z.string().min(7, 'Teléfono requerido'),
  cedula: z.string().optional(),
  correo: z.string().email('Correo inválido').optional().or(z.literal('')),
  observaciones: z.string().optional(),
})

export type PersonaData = z.infer<typeof personaSchema>

export const itemIngresoSchema = z.object({
  insumo_id: z.string().uuid('Seleccione un insumo'),
  cantidad: z.number().positive('Debe ser mayor a cero'),
})

export type ItemIngresoData = z.infer<typeof itemIngresoSchema>

export const ingresoSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  observaciones: z.string().optional(),
  donante_modo: z.enum(['anonimo', 'existente', 'nuevo']),
  donante_id: z.string().uuid().optional().or(z.literal('')),
  donante: personaSchema.optional(),
})

export type IngresoData = z.infer<typeof ingresoSchema>
