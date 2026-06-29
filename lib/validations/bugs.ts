import { z } from 'zod'

export const bugSchema = z.object({
  titulo: z.string().min(5, 'El título debe tener al menos 5 caracteres').max(200),
  descripcion: z.string().min(10, 'Describe el problema con más detalle').max(2000),
  pagina: z.string().optional(),
})

export type BugData = z.infer<typeof bugSchema>
