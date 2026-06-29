# patodos — Sistema de Inventario de Ayuda Humanitaria

Plataforma web de código abierto para gestionar el inventario de ayuda humanitaria
post-terremoto en Venezuela. Permite que **múltiples centros de acopio** registren
ingresos de donaciones, despachen egresos hacia destinos, gestionen solicitudes de
ayuda y mantengan trazabilidad de responsables y personas.

Está pensado para ser usado por **voluntarios con distinto nivel técnico**, por lo que
la prioridad es una experiencia simple, directa y en español.

---

## ✨ Características

- **Multi-centro con control de acceso.** Cada centro opera de forma independiente;
  un operador del centro A no puede ver ni modificar datos del centro B (Row Level
  Security en PostgreSQL).
- **Registro de ingresos** de donaciones, con donante identificado o anónimo.
- **Registro de egresos** hacia destinos, con persona de contacto y uno o varios
  responsables de entrega. Soporta egresos de múltiples insumos en un solo despacho.
- **Solicitudes de ayuda** que se vinculan a los egresos y cambian de estado
  automáticamente (pendiente → parcialmente atendida → completada).
- **Inventario en tiempo real** por centro, actualizado automáticamente por triggers
  de base de datos al registrar o anular movimientos.
- **Historial auditable.** Los movimientos son inmutables: no se editan ni se borran,
  solo se anulan con motivo y responsable (soft delete).
- **Reportes exportables** (CSV / impresión a PDF) por centro y rango de fechas.
- **Panel multi-centro** para administradores con KPIs globales.
- **Onboarding self-service** y tour guiado de producto para nuevos voluntarios.

---

## 🧱 Stack tecnológico

| Capa       | Tecnología                                           |
| ---------- | ---------------------------------------------------- |
| Frontend   | Next.js 16 (App Router, React 19, Server Components) |
| UI         | shadcn/ui + Tailwind CSS                             |
| Backend    | Supabase — PostgreSQL 17, Auth, Storage, RLS         |
| Cliente BD | `@supabase/supabase-js` v2 + `@supabase/ssr`         |
| Lenguaje   | TypeScript estricto (`strict: true`, sin `any`)      |
| Validación | Zod + React Hook Form                                |
| Tour       | Onborda                                              |

---

## 🏛️ Arquitectura

El principio central del proyecto:

> **Ninguna consulta a datos de dominio se hace directamente desde el cliente.**
> Toda lectura o escritura pasa por un **stored procedure** de PostgreSQL invocado con
> `supabase.rpc('sp_...')`, ejecutado bajo las políticas RLS del usuario autenticado.

Esto garantiza:

- **Aislamiento por centro** mediante RLS, validado dentro de cada SP vía `auth.uid()`.
- **Atomicidad** de operaciones multi-tabla (ingreso = `movimiento` + `detalle_ingreso`
  en una sola transacción).
- Una **capa de contrato explícita** entre el frontend y el esquema de base de datos.

El inventario (`inventario_centro`) **nunca se escribe a mano**: lo recalculan triggers
(`trg_actualizar_stock`, `trg_estado_solicitud`) al insertar o anular movimientos.

```
app/
├── (auth)/          Rutas públicas: login, registro, recuperación de contraseña
├── (dashboard)/     Rutas protegidas: inventario, ingresos, egresos, solicitudes,
│                    personas, destinos, historial, reportes, equipo, admin
└── bienvenida/      Onboarding para usuarios sin centro asignado
components/
├── ui/              Componentes shadcn/ui (sin modificar)
└── app/             Componentes propios del sistema
lib/
├── supabase/        Clientes browser/server + tipos generados
└── validations/     Schemas Zod por dominio
supabase/migrations/ Migraciones SQL: tablas, SPs, triggers y políticas RLS
```

La descripción completa de la arquitectura, el esquema de base de datos y las
convenciones está en [`AGENTS.md`](./AGENTS.md). Las historias de usuario con sus
criterios de aceptación están en [`HISTORIAS_USUARIO.md`](./HISTORIAS_USUARIO.md).

---

## 🚀 Puesta en marcha

### Requisitos

- Node.js 20+
- Un proyecto de [Supabase](https://supabase.com) (gratuito sirve para empezar)

### 1. Clonar e instalar

```bash
git clone <url-del-repositorio>
cd patodos
npm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz con las credenciales de tu proyecto Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

> La `anon key` es pública y va al cliente. **No** commitees `.env.local` ni uses la
> `service_role` key fuera de scripts de servidor controlados.

### 3. Preparar la base de datos

Aplica el esquema y las migraciones en tu proyecto Supabase:

1. Ejecuta el DDL base [`ddl_inventario_ayuda.sql`](./ddl_inventario_ayuda.sql)
   (tablas, constraints, triggers, RLS y catálogos iniciales).
2. Aplica las migraciones de [`supabase/migrations/`](./supabase/migrations) en orden
   cronológico (crean los stored procedures, políticas RLS y funciones de negocio).

Puedes usar la CLI de Supabase (`supabase db push`) o el editor SQL del dashboard.

### 4. Regenerar tipos (opcional, al cambiar el esquema)

```bash
supabase gen types typescript --project-id <tu-project-id> > lib/supabase/types.ts
```

> Nota: `supabase gen types` puede generar el archivo en UTF-16; conviértelo a UTF-8
> para evitar el error de compilación TS1127.

### 5. Levantar el entorno de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El primer usuario que se registra
puede crear el centro inicial y queda como `administrador_sistema` mediante el flujo de
bienvenida.

### Scripts disponibles

| Comando         | Acción                 |
| --------------- | ---------------------- |
| `npm run dev`   | Servidor de desarrollo |
| `npm run build` | Build de producción    |
| `npm run start` | Servidor de producción |
| `npm run lint`  | ESLint                 |

---

## 👥 Roles y permisos

| Acción                                | operador | coordinador | administrador |
| ------------------------------------- | :------: | :---------: | :-----------: |
| Registrar ingreso / egreso            |    ✓     |      ✓      |       ✓       |
| Ver inventario e historial del centro |    ✓     |      ✓      |       ✓       |
| Registrar solicitudes y personas      |    ✓     |      ✓      |       ✓       |
| Anular movimientos                    |    —     |      ✓      |       ✓       |
| Gestionar usuarios del centro         |    —     |      ✓      |       ✓       |
| Generar reportes                      |    —     |      ✓      |       ✓       |
| Panel multi-centro y crear centros    |    —     |      —      |       ✓       |

---

## 🔄 Flujos principales

- **Ingreso:** se elige insumo y cantidad, opcionalmente un donante (existente o nuevo),
  y al guardar se inserta el movimiento y se incrementa el stock automáticamente.
- **Egreso:** se eligen insumos, destino, persona contacto y responsables; el sistema
  valida que haya stock suficiente antes de descontar (si no, hace rollback).
- **Solicitud:** se registra el pedido; al vincularla con egresos, su estado se recalcula
  solo según lo despachado.
- **Anulación:** coordinador o admin anulan un movimiento con motivo; el stock se revierte.

---

## 🤝 Contribuir

Este es un proyecto de código abierto con un fin humanitario, y las contribuciones son
bienvenidas. Antes de abrir un PR:

1. Lee [`AGENTS.md`](./AGENTS.md) — las decisiones de arquitectura ya están tomadas;
   la idea es implementar dentro de ellas (especialmente la regla de SPs + RLS).
2. Respeta las convenciones: TypeScript estricto sin `any`, Server Components por
   defecto, componentes propios en `components/app/`, validación con Zod.
3. Asegúrate de que `npm run build` y `npm run lint` pasen en verde.

---

## 👨‍💻 Colaboradores

### Desarrolladores / Colaboradores

- **Luis Martin** (@martinforger)
- **Devony Ramirez** (@DevonyRamirez)
- **Matias Silveira** (@hetairoii)

### Probadores

_Por agregar..._

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta el archivo [`LICENSE`](./LICENSE) para
más detalles.

---

Hecho con 💛 para apoyar la respuesta humanitaria en Venezuela.
