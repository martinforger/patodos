import { z } from 'zod'

export const asignarUsuarioSchema = z.object({
  usuario_id: z.string().uuid('UUID inválido'),
  centro_id: z.string().uuid('UUID inválido'),
  rol: z.enum(['administrador_sistema', 'coordinador_centro', 'operador_inventario']),
})

export type AsignarUsuarioData = z.infer<typeof asignarUsuarioSchema>
