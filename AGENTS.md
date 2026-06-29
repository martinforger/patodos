# AGENTS.md — Sistema de Inventario de Ayuda Humanitaria (`patodos`)

Documento de contexto para agentes de IA (Claude Code, Cursor, Copilot, etc.).
Léelo completo antes de tocar cualquier archivo. Todas las decisiones de arquitectura
ya están tomadas; tu trabajo es implementar dentro de ellas, no cuestionarlas.

---

## 1. Propósito del proyecto

Sistema web para gestionar el inventario de ayuda humanitaria post-terremoto en Venezuela.
Permite a múltiples centros de acopio registrar ingresos de donaciones, egresos a destinos,
solicitudes de ayuda y hacer seguimiento de responsables. Está diseñado para ser usado
por voluntarios con distinto nivel técnico, por lo que la UX debe ser simple y directa.

Las historias de usuario completas, con criterios de aceptación y el SP responsable
de cada una, están en [`HISTORIAS_USUARIO.md`](./HISTORIAS_USUARIO.md).

---

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Server Components por defecto |
| UI | shadcn/ui + Tailwind CSS | No instalar otras librerías de componentes |
| Backend | Supabase (proyecto `patodos`) | PostgreSQL 17, Auth, Storage, RLS |
| ORM / cliente | `@supabase/supabase-js` v2 | Usar el cliente tipado generado |
| Lenguaje | TypeScript estricto | `strict: true` en tsconfig, sin `any` |
| Validación | Zod | Para forms y respuestas de SPs |
| Forms | React Hook Form + Zod resolver | No usar `action=` nativas sin validación |
| Estado global | Zustand (solo si es necesario) | Preferir Server Components y URL state |
| Testing | Vitest + Testing Library | Cobertura mínima en lógica de negocio |

---

## 3. Estructura de carpetas

```
/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Rutas públicas: login, registro
│   ├── (dashboard)/             # Rutas protegidas
│   │   ├── layout.tsx           # Sidebar + auth guard
│   │   ├── inventario/          # Stock por centro
│   │   ├── ingresos/            # Registro y listado de ingresos
│   │   ├── egresos/             # Registro y listado de egresos
│   │   ├── solicitudes/         # Solicitudes de ayuda
│   │   ├── personas/            # Búsqueda y gestión de personas
│   │   ├── destinos/            # Gestión de destinos
│   │   └── admin/               # Solo administrador_sistema
│   └── api/                     # Route Handlers solo si Supabase no alcanza
├── components/
│   ├── ui/                      # Componentes shadcn/ui (no editar)
│   └── app/                     # Componentes propios del sistema
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Supabase browser client (singleton)
│   │   ├── server.ts            # Supabase server client (cookies)
│   │   └── types.ts             # Tipos generados: `supabase gen types`
│   ├── validations/             # Schemas Zod por dominio
│   └── utils.ts                 # cn() y helpers generales
├── hooks/                       # Custom hooks (solo client-side)
└── middleware.ts                 # Protección de rutas con Supabase Auth
```

---

## 4. Base de datos — esquema real en producción

Proyecto Supabase: `patodos` · región: `us-east-1` · PostgreSQL 17

### 4.1 Tablas

#### `centro_acopio`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| nombre | varchar(200) | NOT NULL |
| direccion | text | NOT NULL |
| municipio | varchar(100) | NOT NULL |
| estado_geo | varchar(100) | NOT NULL — estado venezolano |
| telefono | varchar(20) | nullable |
| correo | varchar(150) | nullable |
| activo | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | — |

#### `usuario`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| auth_user_id | uuid UNIQUE | FK lógica a `auth.users` de Supabase |
| nombre / apellido | varchar(100) | NOT NULL |
| telefono | varchar(20) | nullable |
| correo | varchar(150) | NOT NULL |
| activo | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | — |

#### `usuario_centro` — N:M usuario ↔ centro con rol
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| usuario_id | uuid FK → usuario | — |
| centro_id | uuid FK → centro_acopio | — |
| rol | `rol_usuario` ENUM | ver §4.2 |
| activo | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | — |
| — | UNIQUE (usuario_id, centro_id) | — |

#### `categoria_insumo`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| nombre | varchar(100) UNIQUE | NOT NULL |
| descripcion | text | nullable |
| activo | boolean | DEFAULT true |
| created_at | timestamptz | — |

**Datos precargados:** Agua, Alimentos, Comunicación, Herramientas, Higiene, Medicamentos, Otros, Ropa.

#### `insumo`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| categoria_id | uuid FK → categoria_insumo | — |
| nombre | varchar(200) | NOT NULL — describe todo, ej. "Agua 1L", "Agua Minalba 5L" |
| descripcion | text | nullable |
| activo | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | — |
| — | UNIQUE (nombre) | — |

#### `inventario_centro` — stock actual por (centro, insumo)
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| centro_id | uuid FK → centro_acopio | — |
| insumo_id | uuid FK → insumo | — |
| stock | numeric(12,2) | DEFAULT 0, CHECK >= 0 |
| updated_at | timestamptz | — |
| — | UNIQUE (centro_id, insumo_id) | — |

> **Importante:** el stock lo actualiza el trigger `trg_actualizar_stock` automáticamente
> al insertar o anular un `movimiento`. Nunca escribir directamente sobre esta tabla.

#### `persona` — registro unificado de personas externas
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| nombre / apellido | varchar(100) | NOT NULL |
| cedula | varchar(20) | nullable, sin UNIQUE por errores de campo |
| telefono | varchar(20) | NOT NULL — campo mínimo obligatorio |
| correo | varchar(150) | nullable |
| observaciones | text | nullable |
| created_at / updated_at | timestamptz | — |

> Una misma persona puede ser donante en un ingreso, solicitante en una solicitud
> y persona contacto en un egreso. El rol lo determina el contexto, no un atributo.

#### `destino`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| nombre | varchar(200) | NOT NULL — Ej: "Casa profe Ana Karina" |
| direccion | text | NOT NULL |
| municipio | varchar(100) | NOT NULL |
| estado_geo | varchar(100) | NOT NULL |
| referencia | text | indicaciones adicionales para llegar |
| activo | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | — |

#### `movimiento` — registro central de ingresos y egresos
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| centro_id | uuid FK → centro_acopio | — |
| insumo_id | uuid FK → insumo | — |
| tipo | `tipo_movimiento` ENUM | 'ingreso' \| 'egreso' |
| cantidad | numeric(12,2) | NOT NULL, CHECK > 0 |
| fecha_movimiento | date | DEFAULT CURRENT_DATE |
| usuario_id | uuid FK → usuario | quien registró |
| observaciones | text | nullable |
| anulado | boolean | DEFAULT false |
| anulado_por | uuid FK → usuario | nullable |
| anulado_motivo | text | nullable |
| anulado_at | timestamptz | nullable |
| created_at | timestamptz | — |

> Los movimientos son inmutables. Solo se anulan (soft delete) con motivo y responsable.
> El constraint `chk_anulacion_consistente` exige que los 3 campos de anulación
> estén todos presentes o todos ausentes.

#### `detalle_ingreso` — atributos exclusivos del ingreso
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| movimiento_id | uuid FK → movimiento UNIQUE | 1:1 |
| donante_id | uuid FK → persona | NULL si anónimo |
| donante_anonimo | boolean | DEFAULT false |

> `chk_donante_consistente`: si `donante_anonimo = true` entonces `donante_id` debe ser NULL, y viceversa.

#### `detalle_egreso` — atributos exclusivos del egreso
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| movimiento_id | uuid FK → movimiento UNIQUE | 1:1 |
| destino_id | uuid FK → destino | NOT NULL |
| persona_contacto_id | uuid FK → persona | quien recibe |

#### `responsable_entrega` — voluntarios que llevan el despacho
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| detalle_egreso_id | uuid FK → detalle_egreso | — |
| persona_id | uuid FK → persona | nullable |
| nombre / apellido / telefono | varchar | campos libres si no está en `persona` |
| created_at | timestamptz | — |

> `chk_responsable_identificado`: debe haber `persona_id` OR (`nombre` + `telefono`).
> Puede haber N responsables por egreso.

#### `solicitud`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| centro_id | uuid FK → centro_acopio | — |
| insumo_id | uuid FK → insumo | — |
| cantidad_solicitada | numeric(12,2) | NOT NULL, CHECK > 0 |
| solicitante_id | uuid FK → persona | — |
| estado | `estado_solicitud` ENUM | DEFAULT 'pendiente' |
| fecha_solicitud | date | DEFAULT CURRENT_DATE |
| observaciones | text | nullable |
| usuario_registro_id | uuid FK → usuario | — |
| created_at / updated_at | timestamptz | — |

#### `solicitud_movimiento` — N:M solicitud ↔ movimiento
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | — |
| solicitud_id | uuid FK → solicitud | — |
| movimiento_id | uuid FK → movimiento | — |
| created_at | timestamptz | — |
| — | UNIQUE (solicitud_id, movimiento_id) | — |

> Al insertar aquí, el trigger `trg_estado_solicitud` recalcula automáticamente
> el estado de la solicitud comparando cantidad despachada vs solicitada.

### 4.2 ENUMs

```sql
rol_usuario:       'administrador_sistema' | 'coordinador_centro' | 'operador_inventario'
estado_solicitud:  'pendiente' | 'parcialmente_atendida' | 'completada' | 'cancelada'
tipo_movimiento:   'ingreso' | 'egreso'
```

### 4.3 Triggers activos

| Trigger | Tabla | Evento | Función |
|---|---|---|---|
| `trg_updated_at_*` | Varias | BEFORE UPDATE | `fn_actualizar_updated_at()` |
| `trg_actualizar_stock` | `movimiento` | AFTER INSERT / UPDATE | `fn_actualizar_stock()` |
| `trg_estado_solicitud` | `solicitud_movimiento` | AFTER INSERT | `fn_actualizar_estado_solicitud()` |

### 4.4 Índices

```
idx_persona_nombre    — (nombre, apellido)
idx_persona_cedula    — (cedula) WHERE cedula IS NOT NULL
idx_persona_telefono  — (telefono)
idx_movimiento_centro — (centro_id)
idx_movimiento_insumo — (insumo_id)
idx_movimiento_fecha  — (fecha_movimiento DESC)
idx_movimiento_tipo   — (tipo)
idx_solicitud_centro  — (centro_id)
idx_solicitud_estado  — (estado)
```

---

## 5. Regla crítica: toda consulta a la BD va por Stored Procedure con RLS

**Nunca** escribir queries directas desde el cliente o desde Server Actions con `.from('tabla').select(...)`.
Toda operación de lectura o escritura que toque datos de dominio debe pasar por un
stored procedure (función PostgreSQL) creado en Supabase con `SECURITY DEFINER` o `SECURITY INVOKER`
según corresponda, y con RLS habilitado explícitamente.

### Por qué

- RLS garantiza que un operador del centro A no pueda ver ni modificar datos del centro B.
- Los SPs permiten encapsular lógica de negocio multi-tabla en una transacción atómica.
- Evitan que una refactorización del esquema rompa el cliente sin una capa de contrato explícita.

### Cómo crear un SP correctamente

```sql
-- Patrón obligatorio para todos los stored procedures
CREATE OR REPLACE FUNCTION sp_nombre_del_procedimiento(
  p_parametro1 uuid,
  p_parametro2 text
)
RETURNS jsonb            -- siempre retornar jsonb o SETOF tipo_compuesto
LANGUAGE plpgsql
SECURITY INVOKER         -- usa los permisos del usuario autenticado (RLS se aplica)
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  -- lógica aquí
  RETURN v_resultado;
END;
$$;

-- Habilitar RLS sobre el SP (requerido para que Supabase Auth lo proteja)
REVOKE ALL ON FUNCTION sp_nombre_del_procedimiento(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_nombre_del_procedimiento(uuid, text) TO authenticated;
```

> Usar `SECURITY INVOKER` (no `DEFINER`) para que el SP ejecute con los permisos del
> usuario autenticado y las políticas RLS de cada tabla se apliquen normalmente.
> `SECURITY DEFINER` solo se usa en casos excepcionales donde se necesita elevar
> permisos intencionalmente (ej: registrar un usuario en `usuario` al hacer signup),
> y debe documentarse el motivo en un comentario SQL.

### Cómo invocar un SP desde Next.js

```typescript
// lib/supabase/server.ts — cliente con cookies para Server Components / Actions
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}

// Uso en Server Action o Route Handler
const supabase = createClient()
const { data, error } = await supabase.rpc('sp_nombre_del_procedimiento', {
  p_parametro1: centroId,
  p_parametro2: texto,
})
if (error) throw new Error(error.message)
```

### SPs que deben existir (implementar en orden)

Los SPs se crean con `supabase.rpc()` desde el cliente. Cada SP nuevo requiere:
1. Crear la función en Supabase (migration o SQL editor).
2. `GRANT EXECUTE` al rol `authenticated`.
3. Regenerar tipos: `supabase gen types typescript --project-id moxcewdppzbyrvfmgijw > lib/supabase/types.ts`.

| SP | Descripción |
|---|---|
| `sp_registrar_ingreso` | Inserta en `movimiento` + `detalle_ingreso` en una tx |
| `sp_registrar_egreso` | Inserta en `movimiento` + `detalle_egreso` + `responsable_entrega` en una tx |
| `sp_anular_movimiento` | Actualiza `anulado`, `anulado_por`, `anulado_motivo`, `anulado_at` |
| `sp_registrar_solicitud` | Inserta solicitud con validación de insumo/centro |
| `sp_vincular_solicitud_egreso` | Inserta en `solicitud_movimiento` (trigger recalcula estado) |
| `sp_buscar_persona` | Búsqueda fuzzy por nombre, apellido, teléfono o cédula |
| `sp_inventario_centro` | Retorna stock actual del centro del usuario autenticado |
| `sp_historial_movimientos` | Retorna movimientos paginados con filtros de fecha y tipo |
| `sp_resumen_panel` | KPIs del día/semana para el panel principal |
| `sp_reporte_centro` | Datos del reporte exportable por rango de fechas |
| `sp_registrar_centro_acopio` | Crea centro nuevo (solo `administrador_sistema`) |
| `sp_asignar_usuario_centro` | Asigna usuario a centro con rol (coordinador o admin) |

---

## 6. Autenticación y autorización

- Supabase Auth gestiona el ciclo de vida de sesión (JWT, refresh tokens, cookies).
- Al hacer signup/login, el hook `on_auth_user_created` (o un SP con `SECURITY DEFINER`)
  debe crear el registro correspondiente en la tabla `usuario` con el `auth_user_id`.
- El `middleware.ts` de Next.js protege todas las rutas bajo `(dashboard)/` verificando
  la sesión activa con `@supabase/ssr`.
- El rol del usuario en cada centro se lee de `usuario_centro` y se almacena en el
  contexto de la sesión (Zustand o React Context) al hacer login.
- **Los SPs leen el rol internamente** via `auth.uid()` → `usuario` → `usuario_centro`
  para validar permisos antes de ejecutar operaciones sensibles.

### Roles y permisos

| Acción | operador_inventario | coordinador_centro | administrador_sistema |
|---|:---:|:---:|:---:|
| Registrar ingreso/egreso | ✓ | ✓ | ✓ |
| Ver inventario de su centro | ✓ | ✓ | ✓ |
| Ver historial de su centro | ✓ | ✓ | ✓ |
| Anular movimientos | — | ✓ | ✓ |
| Gestionar usuarios de su centro | — | ✓ | ✓ |
| Generar reportes | — | ✓ | ✓ |
| Ver panel multi-centro | — | — | ✓ |
| Crear centros de acopio | — | — | ✓ |

---

## 7. Convenciones de código

### General

- Todo en español en la capa de datos y lógica de negocio (nombres de SPs, variables,
  comentarios). El código de infraestructura (Next.js, Supabase client) puede estar en inglés.
- Componentes React en PascalCase. Funciones y variables en camelCase. Archivos en kebab-case.
- Un componente por archivo. Máximo ~150 líneas por archivo; si crece, dividirlo.
- Server Components por defecto. Agregar `'use client'` solo cuando se necesite interactividad.

### Supabase / base de datos

- Nunca hardcodear UUIDs ni IDs en el código. Siempre vienen de la sesión o de SPs.
- Nunca hacer `.from('tabla').select()` directamente desde componentes o actions.
  Toda consulta va por `supabase.rpc('sp_nombre', params)`.
- Al crear un SP nuevo, agregar su firma al tipo `Database['public']['Functions']`
  regenerando tipos con `supabase gen types`.
- Las migraciones van en `/supabase/migrations/` con nombre `YYYYMMDD_descripcion.sql`.

### shadcn/ui

- Instalar componentes con `npx shadcn@latest add <componente>`. No copiarlos a mano.
- Los componentes de shadcn van en `components/ui/` sin modificación.
- Los componentes propios del sistema van en `components/app/`.
- Usar las variantes y tokens de shadcn (`cn()`, `variants`) en lugar de clases Tailwind ad-hoc.
- El tema de color se configura en `globals.css` con variables CSS. No inline styles.

### Formularios

```typescript
// Patrón obligatorio para todos los formularios
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  cantidad: z.number().positive('Debe ser mayor a cero'),
  observaciones: z.string().optional(),
})

type FormData = z.infer<typeof schema>

// En Server Actions: validar con el mismo schema antes de llamar al SP
export async function registrarIngreso(data: unknown) {
  'use server'
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new Error('Datos inválidos')
  const supabase = createClient()
  const { error } = await supabase.rpc('sp_registrar_ingreso', parsed.data)
  if (error) throw error
}
```

---

## 8. Variables de entorno

```bash
# .env.local — nunca commitear
NEXT_PUBLIC_SUPABASE_URL=https://moxcewdppzbyrvfmgijw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>   # pública, va al cliente
SUPABASE_SERVICE_ROLE_KEY=<service_key>    # privada, solo en servidor, con extremo cuidado
```

> `SUPABASE_SERVICE_ROLE_KEY` bypasea RLS completamente. Solo usarla en scripts
> de migración de datos o jobs de servidor con acceso controlado. Nunca exponerla
> al cliente ni usarla en Server Actions regulares.

---

## 9. Flujos de negocio — referencia rápida

### Registrar un ingreso
1. Usuario elige insumo y cantidad.
2. Opcionalmente asocia un donante (busca en `persona` por nombre/teléfono o crea uno nuevo).
3. Al guardar → `sp_registrar_ingreso` → inserta `movimiento` (tipo='ingreso') + `detalle_ingreso`.
4. El trigger `trg_actualizar_stock` incrementa `inventario_centro.stock` automáticamente.

### Registrar un egreso
1. Usuario elige insumo, cantidad y destino (busca en `destino` o crea uno nuevo).
2. Agrega persona contacto (busca en `persona` o crea).
3. Agrega uno o más responsables de entrega.
4. Al guardar → `sp_registrar_egreso` → inserta `movimiento` + `detalle_egreso` + `responsable_entrega`.
5. El trigger valida stock suficiente; si no hay, lanza excepción y hace rollback.
6. El stock en `inventario_centro` se decrementa automáticamente.

### Atender una solicitud
1. Al registrar un egreso, el usuario puede vincular una solicitud existente.
2. → `sp_vincular_solicitud_egreso` → inserta en `solicitud_movimiento`.
3. El trigger `trg_estado_solicitud` recalcula el estado: pendiente → parcialmente_atendida → completada.

### Anular un movimiento
1. Solo coordinador o admin puede anular.
2. → `sp_anular_movimiento(p_movimiento_id, p_motivo)` → actualiza `anulado=true` con metadatos.
3. El trigger revierte el efecto sobre `inventario_centro.stock`.

---

## 10. Lo que NO hacer

- ❌ Consultar tablas directamente con `.from().select()` desde el cliente.
- ❌ Escribir directamente en `inventario_centro` (lo maneja el trigger).
- ❌ Usar `SECURITY DEFINER` en SPs sin documentar el motivo.
- ❌ Exponer `SUPABASE_SERVICE_ROLE_KEY` en el cliente o en Server Actions comunes.
- ❌ Instalar librerías de componentes distintas a shadcn/ui (Chakra, MUI, Ant, etc.).
- ❌ Usar `any` en TypeScript.
- ❌ Eliminar registros de la base de datos. Todo es soft delete (`activo = false` o `anulado = true`).
- ❌ Crear migraciones que modifiquen SPs existentes sin versionar el cambio en `/supabase/migrations/`.
- ❌ Asumir que el usuario tiene rol de admin; siempre verificar en el SP via `auth.uid()`.

---

## 11. Flujo de trabajo Git (Gitflow)

Este proyecto sigue **Gitflow**. Las ramas tienen roles estrictos:

| Rama | Propósito |
|---|---|
| `main` | Producción. Siempre desplegable. Solo recibe merges de `hotfix/*` y `release/*`. |
| `develop` | Integración de features. Base para las ramas de feature. |
| `feature/<nombre>` | Nueva funcionalidad. Sale de `develop`, vuelve a `develop`. |
| `release/<version>` | Preparación de release. Sale de `develop`, vuelve a `main` + `develop`. |
| `hotfix/<nombre>` | Parche urgente de producción. Sale de `main`, vuelve a `main` + `develop`. |

### Reglas para agentes

- **Nunca commitear directamente a `main`**. Cualquier fix urgente va en una rama `hotfix/`.
- Al crear una `hotfix/`: `git checkout main && git checkout -b hotfix/<descripcion-corta>`.
- Después de commitear el hotfix, hacer push de la rama: `git push origin hotfix/<nombre>`.
- El merge a `main` y `develop` lo hace el humano o un pipeline; el agente solo hace push de la rama.
- Las features nuevas parten siempre de `develop`: `git checkout develop && git checkout -b feature/<nombre>`.
- Al regenerar tipos de Supabase (`supabase gen types`), verificar que no se introduzcan **identificadores duplicados** en `lib/supabase/types.ts` antes de commitear.

---

## 12. Documentación relacionada

| Archivo | Contenido |
|---|---|
| [`HISTORIAS_USUARIO.md`](./HISTORIAS_USUARIO.md) | Las 14 historias de usuario con criterios de aceptación, prioridad y SP responsable de cada una. Referencia primaria para entender qué debe hacer el sistema. |
| [`ddl_inventario_ayuda.sql`](./ddl_inventario_ayuda.sql) | DDL completo en 3FN: tablas, constraints, triggers, RLS y datos iniciales de catálogo. |
