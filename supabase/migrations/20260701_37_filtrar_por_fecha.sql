-- ============================================================
-- Migración 37 · Filtro por día o rango de días (fechas)
-- ------------------------------------------------------------
-- Añade parámetros de filtro de fecha (p_fecha_desde y p_fecha_hasta)
-- a sp_listar_ingresos, sp_listar_egresos y sp_listar_solicitudes.
-- ============================================================

-- 1. Eliminar funciones antiguas para evitar conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.sp_listar_ingresos(uuid, int, int);
DROP FUNCTION IF EXISTS public.sp_listar_egresos(uuid, int, int);
DROP FUNCTION IF EXISTS public.sp_listar_solicitudes(uuid, text, int, int);

-- 2. sp_listar_ingresos — con agrupación por lote y filtro de fechas
CREATE OR REPLACE FUNCTION public.sp_listar_ingresos(
  p_centro_id    uuid,
  p_fecha_desde  date DEFAULT NULL,
  p_fecha_hasta  date DEFAULT NULL,
  p_pagina       int  DEFAULT 1,
  p_por_pagina   int  DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_offset int := (p_pagina - 1) * p_por_pagina;
  v_total  int;
  v_rows   jsonb;
BEGIN
  -- Contar grupos aplicando el filtro de fechas
  SELECT COUNT(DISTINCT COALESCE(m.lote_id, m.id)) INTO v_total
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND m.tipo = 'ingreso'
    AND (m.lote_id IS NOT NULL OR NOT m.anulado)
    AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta);

  WITH base AS (
    SELECT
      m.id,
      m.lote_id,
      COALESCE(m.lote_id, m.id) AS grp,
      m.fecha_movimiento,
      m.cantidad,
      m.anulado,
      m.observaciones,
      m.created_at,
      trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo_nombre,
      CASE
        WHEN di.donante_anonimo THEN 'Anónimo'
        WHEN p.id IS NOT NULL   THEN p.nombre || ' ' || p.apellido
        ELSE '—'
      END AS donante_nombre,
      u.nombre || ' ' || u.apellido AS registrado_por
    FROM movimiento m
    JOIN insumo          i  ON i.id  = m.insumo_id
    JOIN usuario         u  ON u.id  = m.usuario_id
    JOIN detalle_ingreso di ON di.movimiento_id = m.id
    LEFT JOIN persona    p  ON p.id  = di.donante_id
    WHERE m.centro_id = p_centro_id
      AND m.tipo = 'ingreso'
      AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta)
  ),
  agrupado AS (
    SELECT
      grp                                      AS id,
      CASE WHEN bool_or(lote_id IS NOT NULL) THEN grp ELSE NULL END AS lote_id,
      bool_or(lote_id IS NOT NULL)             AS es_lote,
      COUNT(*)::int                            AS num_insumos,
      MAX(fecha_movimiento)                    AS fecha_movimiento,
      SUM(cantidad)                            AS cantidad,
      CASE WHEN COUNT(*) = 1 THEN MAX(insumo_nombre) ELSE NULL END AS insumo,
      BOOL_AND(anulado)                        AS anulado,
      MAX(donante_nombre)                      AS donante,
      MAX(registrado_por)                      AS registrado_por,
      MAX(observaciones)                       AS observaciones,
      MAX(created_at)                          AS created_at,
      grp
    FROM base
    GROUP BY grp
  )
  SELECT jsonb_agg(row_to_json(a) ORDER BY a.fecha_movimiento DESC, a.created_at DESC)
  INTO v_rows
  FROM (
    SELECT id, lote_id, es_lote, num_insumos, fecha_movimiento, cantidad, insumo,
           anulado, donante, registrado_por, observaciones, created_at
    FROM agrupado
    ORDER BY fecha_movimiento DESC, created_at DESC
    LIMIT p_por_pagina OFFSET v_offset
  ) a;

  RETURN jsonb_build_object(
    'total',  v_total,
    'pagina', p_pagina,
    'datos',  COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_listar_ingresos(uuid, date, date, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_listar_ingresos(uuid, date, date, int, int) TO authenticated;


-- 3. sp_listar_egresos — con agrupación por lote y filtro de fechas
CREATE OR REPLACE FUNCTION public.sp_listar_egresos(
  p_centro_id    uuid,
  p_fecha_desde  date DEFAULT NULL,
  p_fecha_hasta  date DEFAULT NULL,
  p_pagina       int  DEFAULT 1,
  p_por_pagina   int  DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_offset int := (p_pagina - 1) * p_por_pagina;
  v_total  int;
  v_rows   jsonb;
BEGIN
  -- Contar grupos aplicando el filtro de fechas
  SELECT COUNT(DISTINCT COALESCE(m.lote_id, m.id)) INTO v_total
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND m.tipo = 'egreso'
    AND (m.lote_id IS NOT NULL OR NOT m.anulado)
    AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta);

  WITH base AS (
    SELECT
      m.id,
      m.lote_id,
      COALESCE(m.lote_id, m.id) AS grp,
      m.fecha_movimiento,
      m.cantidad,
      m.anulado,
      m.observaciones,
      m.created_at,
      trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo_nombre,
      u.nombre || ' ' || u.apellido AS registrado_por,
      dst.nombre AS destino_nombre,
      CASE
        WHEN pc.id IS NOT NULL THEN pc.nombre || ' ' || pc.apellido
        ELSE '—'
      END AS persona_contacto_nombre,
      de.id AS detalle_egreso_id
    FROM movimiento m
    JOIN insumo         i   ON i.id  = m.insumo_id
    JOIN usuario        u   ON u.id  = m.usuario_id
    JOIN detalle_egreso de  ON de.movimiento_id = m.id
    JOIN destino        dst ON dst.id = de.destino_id
    LEFT JOIN persona   pc  ON pc.id = de.persona_contacto_id
    WHERE m.centro_id = p_centro_id
      AND m.tipo = 'egreso'
      AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta)
  ),
  agrupado AS (
    SELECT
      grp                                      AS id,
      CASE WHEN bool_or(lote_id IS NOT NULL) THEN grp ELSE NULL END AS lote_id,
      bool_or(lote_id IS NOT NULL)             AS es_lote,
      COUNT(*)::int                            AS num_insumos,
      MAX(fecha_movimiento)                    AS fecha_movimiento,
      SUM(cantidad)                            AS cantidad,
      CASE WHEN COUNT(*) = 1 THEN MAX(insumo_nombre) ELSE NULL END AS insumo,
      BOOL_AND(anulado)                        AS anulado,
      MAX(registrado_por)                      AS registrado_por,
      MAX(destino_nombre)                      AS destino,
      MAX(persona_contacto_nombre)              AS persona_contacto,
      MAX(observaciones)                       AS observaciones,
      MAX(created_at)                          AS created_at,
      (array_agg(detalle_egreso_id))[1]        AS sample_detalle_id,
      grp
    FROM base
    GROUP BY grp
  )
  SELECT jsonb_agg(row_to_json(a) ORDER BY a.fecha_movimiento DESC, a.created_at DESC)
  INTO v_rows
  FROM (
    SELECT
      ag.id, ag.lote_id, ag.es_lote, ag.num_insumos, ag.fecha_movimiento,
      ag.cantidad, ag.insumo, ag.anulado, ag.registrado_por,
      ag.destino, ag.persona_contacto, ag.observaciones, ag.created_at,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT
          CASE
            WHEN rp.id IS NOT NULL THEN rp.nombre || ' ' || rp.apellido
            ELSE re.nombre || ' ' || COALESCE(re.apellido, '')
          END
        ), '[]'::jsonb)
        FROM responsable_entrega re
        LEFT JOIN persona rp ON rp.id = re.persona_id
        WHERE re.detalle_egreso_id = ag.sample_detalle_id
      ) AS responsables
    FROM agrupado ag
    ORDER BY ag.fecha_movimiento DESC, ag.created_at DESC
    LIMIT p_por_pagina OFFSET v_offset
  ) a;

  RETURN jsonb_build_object(
    'total',  v_total,
    'pagina', p_pagina,
    'datos',  COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_listar_egresos(uuid, date, date, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_listar_egresos(uuid, date, date, int, int) TO authenticated;


-- 4. sp_listar_solicitudes — con agrupación por lote, filtro de estado y filtro de fechas
CREATE OR REPLACE FUNCTION public.sp_listar_solicitudes(
  p_centro_id    uuid,
  p_estado       text DEFAULT NULL,
  p_fecha_desde  date DEFAULT NULL,
  p_fecha_hasta  date DEFAULT NULL,
  p_pagina       int  DEFAULT 1,
  p_por_pagina   int  DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_offset int := (p_pagina - 1) * p_por_pagina;
  v_total  int;
  v_rows   jsonb;
BEGIN
  -- Contar grupos aplicando el filtro de estado y de fechas
  SELECT COUNT(DISTINCT COALESCE(s.lote_id, s.id)) INTO v_total
  FROM solicitud s
  WHERE s.centro_id = p_centro_id
    AND (p_estado IS NULL OR s.estado::text = p_estado)
    AND (p_fecha_desde IS NULL OR s.fecha_solicitud >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR s.fecha_solicitud <= p_fecha_hasta);

  WITH base AS (
    SELECT
      s.id,
      s.lote_id,
      COALESCE(s.lote_id, s.id) AS grp,
      s.fecha_solicitud,
      s.cantidad_solicitada,
      s.estado::text             AS estado,
      s.estado_entrega::text     AS estado_entrega,
      s.observaciones,
      s.created_at,
      trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo_nombre,
      p.nombre || ' ' || p.apellido AS solicitante_nombre,
      p.telefono AS solicitante_telefono,
      u.nombre || ' ' || u.apellido AS registrado_por,
      COALESCE(
        (SELECT SUM(m2.cantidad)
         FROM solicitud_movimiento sm
         JOIN movimiento m2 ON m2.id = sm.movimiento_id
         WHERE sm.solicitud_id = s.id AND m2.anulado = false),
        0
      ) AS cantidad_despachada,
      CASE s.estado_entrega::text
        WHEN 'pendiente'  THEN 1
        WHEN 'embalado'   THEN 2
        WHEN 'enviado'    THEN 3
        WHEN 'entregado'  THEN 4
        ELSE 0
      END AS entrega_orden
    FROM solicitud s
    JOIN insumo  i ON i.id = s.insumo_id
    JOIN persona p ON p.id = s.solicitante_id
    JOIN usuario u ON u.id = s.usuario_registro_id
    WHERE s.centro_id = p_centro_id
      AND (p_estado IS NULL OR s.estado::text = p_estado)
      AND (p_fecha_desde IS NULL OR s.fecha_solicitud >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR s.fecha_solicitud <= p_fecha_hasta)
  ),
  agrupado AS (
    SELECT
      grp                                      AS id,
      CASE WHEN bool_or(lote_id IS NOT NULL) THEN grp ELSE NULL END AS lote_id,
      bool_or(lote_id IS NOT NULL)             AS es_lote,
      COUNT(*)::int                            AS num_insumos,
      MAX(fecha_solicitud)                     AS fecha_solicitud,
      SUM(cantidad_solicitada)                 AS cantidad_solicitada,
      SUM(cantidad_despachada)                 AS cantidad_despachada,
      CASE WHEN COUNT(*) = 1 THEN MAX(insumo_nombre) ELSE NULL END AS insumo,
      CASE
        WHEN BOOL_AND(estado = 'completada')                             THEN 'completada'
        WHEN BOOL_AND(estado = 'cancelada')                              THEN 'cancelada'
        WHEN BOOL_OR(estado IN ('completada', 'parcialmente_atendida'))  THEN 'parcialmente_atendida'
        ELSE 'pendiente'
      END AS estado,
      CASE MIN(entrega_orden)
        WHEN 1 THEN 'pendiente'
        WHEN 2 THEN 'embalado'
        WHEN 3 THEN 'enviado'
        WHEN 4 THEN 'entregado'
        ELSE 'pendiente'
      END AS estado_entrega,
      MAX(solicitante_nombre)                  AS solicitante,
      MAX(solicitante_telefono)                AS solicitante_telefono,
      MAX(registrado_por)                      AS registrado_por,
      MAX(observaciones)                       AS observaciones,
      MAX(created_at)                          AS created_at,
      grp
    FROM base
    GROUP BY grp
  )
  SELECT jsonb_agg(row_to_json(a) ORDER BY a.fecha_solicitud DESC, a.created_at DESC)
  INTO v_rows
  FROM (
    SELECT id, lote_id, es_lote, num_insumos, fecha_solicitud,
           cantidad_solicitada, cantidad_despachada, insumo, estado, estado_entrega,
           solicitante, solicitante_telefono, registrado_por, observaciones, created_at
    FROM agrupado
    ORDER BY fecha_solicitud DESC, created_at DESC
    LIMIT p_por_pagina OFFSET v_offset
  ) a;

  RETURN jsonb_build_object(
    'total',  v_total,
    'pagina', p_pagina,
    'datos',  COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_listar_solicitudes(uuid, text, date, date, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_listar_solicitudes(uuid, text, date, date, int, int) TO authenticated;
