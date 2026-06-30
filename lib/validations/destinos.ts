import { z } from 'zod'

export const destinoSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  direccion: z.string().min(5, 'Dirección requerida'),
  municipio: z.string().min(2, 'Municipio requerido'),
  estado_geo: z.string().min(2, 'Estado requerido'),
  referencia: z.string().optional(),
})

export const categoriaDestinoSchema = z.object({
  nombre: z.string().min(1, 'Nombre de la categoría requerido'),
})

export type CategoriaDestinoData = z.infer<typeof categoriaDestinoSchema>

export type DestinoData = z.infer<typeof destinoSchema>
