import { z } from 'zod'

export const voluntarioSchema = z.object({
  nombres: z.string().min(2, 'Mínimo 2 caracteres'),
  apellidos: z.string().min(2, 'Mínimo 2 caracteres'),
  nacionalidad: z.enum(['V', 'E'] as const, { error: 'Selecciona V o E' }),
  cedula_numero: z.string().min(4, 'Cédula requerida').regex(/^\d+$/, 'Solo números'),
  fecha_nacimiento: z.string().optional(),
  telefono: z.string().min(7, 'Teléfono requerido'),
  telefono_emergencia: z.string().optional(),
  zona: z.string().optional(),
})

export type VoluntarioData = z.infer<typeof voluntarioSchema>

export const asistenciaCedulaSchema = z.object({
  nacionalidad: z.enum(['V', 'E'] as const, { error: 'Selecciona V o E' }),
  cedula_numero: z.string().min(4, 'Cédula requerida').regex(/^\d+$/, 'Solo números'),
})

export type AsistenciaCedulaData = z.infer<typeof asistenciaCedulaSchema>
