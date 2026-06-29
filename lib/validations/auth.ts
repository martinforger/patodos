import { z } from 'zod'

export const loginSchema = z.object({
  correo: z.string().email('Correo inválido'),
  contrasena: z.string().min(6, 'Mínimo 6 caracteres'),
})

export const registroSchema = z.object({
  nombre: z.string().min(2, 'Requerido'),
  apellido: z.string().min(2, 'Requerido'),
  correo: z.string().email('Correo inválido'),
  telefono: z.string().min(7, 'Teléfono requerido'),
  contrasena: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmar: z.string(),
}).refine((d) => d.contrasena === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
})

export type LoginData = z.infer<typeof loginSchema>
export type RegistroData = z.infer<typeof registroSchema>
