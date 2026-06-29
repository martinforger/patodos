# Historias de usuario — Sistema de Inventario de Ayuda Humanitaria

Versión 1.0 · Junio 2026

---

## Contexto

Sistema multi-centro para registrar y controlar el inventario de ayuda humanitaria
post-terremoto en Venezuela. Diseñado para voluntarios con distinto nivel técnico.
El flujo central es: donante entrega insumos → se registra el ingreso → se atiende
una solicitud → se registra el egreso con destino y responsable.

### Actores

| Actor | Descripción |
|---|---|
| `administrador_sistema` | Acceso global a todos los centros. Crea centros y gestiona usuarios. |
| `coordinador_centro` | Administra su centro: usuarios, historial y reportes. |
| `operador_inventario` | Registra ingresos, egresos, solicitudes y personas. |
| Donante | Persona o institución que entrega insumos. Puede ser anónima. |
| Persona contacto | Quien recibe la ayuda o coordina la entrega en el destino. |

---

## Épica 1 — Gestión de centros de acopio

Configuración y administración de los centros que participan en el sistema.

---

### HU-01 · Registro de centro de acopio

**Como** `administrador_sistema`
**quiero** registrar un nuevo centro de acopio con nombre, dirección, municipio, estado y datos de contacto
**para** que múltiples centros puedan operar en la plataforma de forma independiente y centralizada.

**Criterios de aceptación**

1. El formulario incluye: nombre del centro, dirección completa, municipio, estado, teléfono de contacto y responsable principal.
2. El sistema asigna un `id` UUID al centro al momento del registro.
3. No se permite registrar dos centros con el mismo nombre y dirección (`uq_centro_nombre_direccion`).
4. El centro queda activo (`activo = true`) y disponible para operar inmediatamente.

**Prioridad:** Alta · **SP:** `sp_registrar_centro_acopio`

---

### HU-02 · Gestión de usuarios por centro

**Como** `coordinador_centro`
**quiero** agregar y administrar los voluntarios y responsables asociados a mi centro
**para** controlar quién puede registrar ingresos, egresos y solicitudes en nombre del centro.

**Criterios de aceptación**

1. Cada usuario tiene exactamente un rol por centro: `administrador_sistema`, `coordinador_centro` u `operador_inventario`.
2. Un coordinador solo puede gestionar usuarios dentro de su propio centro.
3. Se registran nombre, apellido, teléfono y correo del usuario.
4. Un usuario puede desactivarse (`activo = false`) sin eliminarlo del historial.

**Prioridad:** Alta · **SP:** `sp_asignar_usuario_centro`

---

## Épica 2 — Registro de ingresos (donaciones)

Captura del inventario que entra al centro, identificando donante, insumos y responsable de recepción.

---

### HU-03 · Registrar ingreso de insumos

**Como** `operador_inventario`
**quiero** registrar el ingreso de insumos donados indicando qué se recibió, en qué cantidad y quién lo donó
**para** llevar un control preciso del inventario disponible en el centro.

**Criterios de aceptación**

1. El formulario solicita: insumo (por categoría), cantidad, unidad de medida y fecha de ingreso.
2. Se puede asociar un donante (nombre, apellido, teléfono; cédula opcional) o marcar como anónimo (`donante_anonimo = true`).
3. El sistema registra automáticamente el usuario (`usuario_id`) y la fecha/hora del registro.
4. El stock en `inventario_centro` se actualiza inmediatamente vía trigger `trg_actualizar_stock`.
5. Se puede agregar una observación libre al registro.

**Prioridad:** Alta · **SP:** `sp_registrar_ingreso`

---

### HU-04 · Registrar donante persona natural

**Como** `operador_inventario`
**quiero** registrar los datos de un donante persona natural de forma rápida y sin campos obligatorios excesivos
**para** tener trazabilidad de las fuentes de ayuda sin crear barreras que desmotiven el registro.

**Criterios de aceptación**

1. Campos obligatorios: nombre, apellido y al menos un teléfono de contacto.
2. Campos opcionales: cédula, correo, observaciones.
3. Si el donante ya existe (por nombre + teléfono o cédula), el sistema sugiere reutilizar el registro.
4. Se puede registrar una donación sin asociar donante (modo anónimo).

**Prioridad:** Media · **SP:** `sp_buscar_persona` + inserción en `persona`

---

## Épica 3 — Registro de egresos y despachos

Captura de la salida de insumos con destino, persona contacto y responsable de entrega.

---

### HU-05 · Registrar egreso de insumos

**Como** `operador_inventario`
**quiero** registrar la salida de insumos indicando qué sale, en qué cantidad y a qué destino va
**para** descontar el inventario correctamente y tener trazabilidad de hacia dónde fue la ayuda.

**Criterios de aceptación**

1. El formulario solicita: insumo, cantidad, fecha de egreso y destino.
2. No se puede registrar una cantidad mayor al stock disponible (el SP / trigger lanza excepción y hace rollback).
3. El sistema registra automáticamente el operador que ejecutó el egreso.
4. El stock se actualiza de inmediato vía trigger `trg_actualizar_stock`.
5. Se puede agregar una observación libre al egreso.

**Prioridad:** Alta · **SP:** `sp_registrar_egreso`

---

### HU-06 · Registrar destino y persona contacto

**Como** `operador_inventario`
**quiero** registrar el destino de los insumos con dirección y una persona contacto responsable de recibirlos
**para** poder comunicarme con esa persona al momento de la entrega y tener registro de quién recibió la ayuda.

**Criterios de aceptación**

1. El destino incluye: nombre referencial (ej. "Casa profe Ana Karina"), dirección, municipio y estado.
2. La persona contacto incluye: nombre, apellido y teléfono (obligatorios); cédula opcional.
3. Se puede reutilizar un destino o persona contacto registrado anteriormente.
4. Si la persona ya existe, se puede buscar y asociar sin duplicar el registro.

**Prioridad:** Alta · **SP:** `sp_registrar_egreso` (incluye destino y contacto)

---

### HU-07 · Asignar responsable de entrega

**Como** `coordinador_centro`
**quiero** indicar qué voluntario o responsable llevará físicamente los insumos al destino
**para** saber en todo momento quién está a cargo de cada despacho.

**Criterios de aceptación**

1. El responsable se selecciona de la lista de personas del sistema o se ingresa manualmente (nombre + teléfono mínimo).
2. Puede haber más de un responsable por despacho (tabla `responsable_entrega`).
3. El responsable queda vinculado al `detalle_egreso` del movimiento.

**Prioridad:** Media · **SP:** `sp_registrar_egreso` (incluye responsables)

---

## Épica 4 — Gestión de solicitudes de ayuda

Registro de pedidos de insumos por parte de comunidades, instituciones o personas afectadas.

---

### HU-08 · Registrar solicitud de insumos

**Como** `operador_inventario`
**quiero** registrar una solicitud de ayuda indicando qué se necesita, en qué cantidad y para quién
**para** gestionar las necesidades recibidas y priorizarlas al momento de despachar.

**Criterios de aceptación**

1. La solicitud incluye: insumo, cantidad estimada, descripción libre y fecha en que se recibió.
2. Se asocia a una persona contacto solicitante (nombre, apellido, teléfono; cédula opcional).
3. La solicitud nace con estado `pendiente`.
4. Los estados posibles son: `pendiente`, `parcialmente_atendida`, `completada`, `cancelada`.

**Prioridad:** Media · **SP:** `sp_registrar_solicitud`

---

### HU-09 · Vincular solicitud a egreso

**Como** `operador_inventario`
**quiero** vincular una solicitud registrada con uno o más egresos realizados
**para** cerrar el ciclo y saber cuáles solicitudes ya fueron atendidas total o parcialmente.

**Criterios de aceptación**

1. Al registrar un egreso se puede buscar y vincular una solicitud existente.
2. El estado de la solicitud se recalcula automáticamente vía trigger `trg_estado_solicitud`:
   - despachado = 0 → `pendiente`
   - despachado < solicitado → `parcialmente_atendida`
   - despachado ≥ solicitado → `completada`
3. Una solicitud puede atenderse con múltiples egresos parciales.
4. El historial de la solicitud muestra todos los egresos vinculados.

**Prioridad:** Media · **SP:** `sp_vincular_solicitud_egreso`

---

## Épica 5 — Consulta e inventario

Visualización del inventario en tiempo real y consulta del historial de movimientos.

---

### HU-10 · Consultar inventario actual

**Como** `operador_inventario` o `coordinador_centro`
**quiero** ver el inventario disponible en mi centro de forma clara y actualizada
**para** tomar decisiones rápidas sobre qué hay disponible para despachar o qué falta.

**Criterios de aceptación**

1. El inventario muestra: nombre del insumo, categoría, stock disponible y unidad de medida.
2. Se puede filtrar por categoría de insumo.
3. El inventario refleja los movimientos en tiempo real (lee de `inventario_centro`).
4. Se indica visualmente si algún insumo tiene stock en cero.

**Prioridad:** Alta · **SP:** `sp_inventario_centro`

---

### HU-11 · Consultar historial de movimientos

**Como** `coordinador_centro`
**quiero** ver el historial completo de ingresos y egresos con fecha, responsable y detalles
**para** auditar los movimientos, generar reportes y rendir cuentas.

**Criterios de aceptación**

1. El historial muestra: fecha, tipo (ingreso/egreso), insumo, cantidad, usuario que registró y destino/donante.
2. Se puede filtrar por rango de fechas, tipo de movimiento y usuario.
3. Se puede exportar en CSV o PDF.
4. El historial no permite edición directa; solo un `coordinador_centro` o `administrador_sistema` puede anular un registro con justificación.

**Prioridad:** Alta · **SP:** `sp_historial_movimientos`

---

### HU-12 · Buscar persona en el sistema

**Como** `operador_inventario`
**quiero** buscar si una persona ya está registrada antes de crearla de nuevo
**para** evitar duplicados y mantener un registro limpio de donantes, solicitantes y responsables.

**Criterios de aceptación**

1. La búsqueda acepta: nombre, apellido, teléfono o cédula.
2. Los resultados muestran nombre completo, teléfono y contexto previo (donante, solicitante, etc.).
3. Si no se encuentra, se ofrece crear el registro directamente desde la búsqueda.
4. La búsqueda es tolerante a variaciones menores (mayúsculas, espacios).

**Prioridad:** Media · **SP:** `sp_buscar_persona`

---

## Épica 6 — Reportes y trazabilidad

Generación de reportes consolidados para coordinación, transparencia y rendición de cuentas.

---

### HU-13 · Generar reporte de movimientos por centro

**Como** `coordinador_centro` o `administrador_sistema`
**quiero** generar un reporte de todos los movimientos de un centro en un período determinado
**para** presentar información consolidada a organizaciones humanitarias o comunidades que lo soliciten.

**Criterios de aceptación**

1. El reporte incluye: totales de ingreso y egreso por insumo, fechas, responsables y destinos.
2. Se filtra por centro, fecha de inicio y fecha de fin.
3. Exportable en PDF y CSV.
4. Incluye un resumen ejecutivo con totales globales del período.

**Prioridad:** Media · **SP:** `sp_reporte_centro`

---

### HU-14 · Ver panel general (multi-centro)

**Como** `administrador_sistema`
**quiero** ver un panel con el resumen de actividad de todos los centros registrados
**para** tener visibilidad global de la operación y detectar centros con poco movimiento o inconsistencias.

**Criterios de aceptación**

1. El panel muestra: centros activos, movimientos del día/semana, insumos más donados y más despachados.
2. Se puede hacer clic en cada centro para ver su inventario y actividad.
3. Solo el rol `administrador_sistema` tiene acceso a esta vista.

**Prioridad:** Baja · **SP:** `sp_resumen_panel`

---

## Mapa de SPs por historia

| Historia | SP(s) involucrados |
|---|---|
| HU-01 | `sp_registrar_centro_acopio` |
| HU-02 | `sp_asignar_usuario_centro` |
| HU-03 | `sp_registrar_ingreso` |
| HU-04 | `sp_buscar_persona` |
| HU-05 | `sp_registrar_egreso` |
| HU-06 | `sp_registrar_egreso` |
| HU-07 | `sp_registrar_egreso` |
| HU-08 | `sp_registrar_solicitud` |
| HU-09 | `sp_vincular_solicitud_egreso` |
| HU-10 | `sp_inventario_centro` |
| HU-11 | `sp_historial_movimientos` |
| HU-12 | `sp_buscar_persona` |
| HU-13 | `sp_reporte_centro` |
| HU-14 | `sp_resumen_panel` |
