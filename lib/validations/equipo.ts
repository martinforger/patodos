import { z } from 'zod'

export const invitarUsuarioSchema = z.object({
  centro_id: z.string().uuid('Selecciona un centro'),
  correo: z.string().email('Correo inválido'),
  rol: z.enum(['coordinador_centro', 'operador_inventario']),
})

export type InvitarUsuarioData = z.infer<typeof invitarUsuarioSchema>
