import { z } from 'zod'
import { personaSchema } from './ingresos'

export const destinoSchema = z.object({
  nombre: z.string().min(1, 'Nombre del destino requerido'),
  direccion: z.string().min(1, 'Dirección requerida'),
  municipio: z.string().min(1, 'Municipio requerido'),
  estado_geo: z.string().min(1, 'Estado requerido'),
  referencia: z.string().optional(),
})

export type DestinoData = z.infer<typeof destinoSchema>

// Responsable de entrega: persona existente o datos libres (nombre + teléfono mínimo)
export const responsableSchema = z.object({
  persona_id: z.string().uuid().nullable().optional(),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
  telefono: z.string().optional(),
})

export type ResponsableData = z.infer<typeof responsableSchema>

// Un <select> con opción vacía emite '' (no undefined); aceptarlo evita que la
// validación falle de forma invisible. onSubmit ya trata '' como "sin seleccionar".
const uuidOpcional = z.string().uuid().optional().or(z.literal(''))

// Cada renglón de insumo a despachar en un mismo egreso (multi-insumo).
// solicitud_id es opcional: vincula ese insumo a una solicitud pendiente.
export const itemEgresoSchema = z.object({
  insumo_id: z.string().uuid('Seleccione un insumo'),
  cantidad: z.number().positive('Debe ser mayor a cero'),
  solicitud_id: uuidOpcional,
})

export type ItemEgresoData = z.infer<typeof itemEgresoSchema>

export const egresoSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  destino_modo: z.enum(['existente', 'nuevo']),
  destino_id: uuidOpcional,
  // La persona de contacto (quien recibe) es obligatoria: solo se puede buscar o crear.
  contacto_modo: z.enum(['existente', 'nuevo']),
  persona_contacto_id: uuidOpcional,
  observaciones: z.string().optional(),
})

export type EgresoData = z.infer<typeof egresoSchema>

export { personaSchema }
