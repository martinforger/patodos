import { z } from 'zod'

export const voluntarioSchema = z.object({
  nombres: z.string().min(2, 'Mínimo 2 caracteres'),
  apellidos: z.string().min(2, 'Mínimo 2 caracteres'),
  nacionalidad: z.enum(['V', 'E'] as const, { error: 'Selecciona V o E' }),
  cedula_numero: z.string().min(4, 'Cédula requerida').regex(/^\d+$/, 'Solo números'),
  telefono: z.string().min(7, 'Teléfono requerido'),
  telefono_emergencia: z.string().optional(),
  turno: z.enum(['completo', 'manana', 'tarde'] as const, { error: 'Selecciona un turno' }),
  tiene_laptop: z.boolean(),
  tiene_vehiculo: z.boolean(),
  vinculo_ucab: z.enum(['estudiante', 'egresado', 'profesor_empleado', 'externo'] as const, {
    error: 'Selecciona vínculo UCAB',
  }),
  carrera: z.string().optional(),
}).superRefine((data, ctx) => {
  if (['estudiante', 'egresado'].includes(data.vinculo_ucab) && !data.carrera?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Indica la carrera',
      path: ['carrera'],
    })
  }
})

export type VoluntarioData = z.infer<typeof voluntarioSchema>

export const asistenciaCedulaSchema = z.object({
  nacionalidad: z.enum(['V', 'E'] as const, { error: 'Selecciona V o E' }),
  cedula_numero: z.string().min(4, 'Cédula requerida').regex(/^\d+$/, 'Solo números'),
})

export type AsistenciaCedulaData = z.infer<typeof asistenciaCedulaSchema>
