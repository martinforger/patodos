-- ============================================================
-- Migración 28 · Agrupación multi-insumo (lote_id)
-- ------------------------------------------------------------
-- Contexto: sp_registrar_egreso_multiple y sp_registrar_solicitud_multiple
-- ya aceptan varios insumos pero crean una fila independiente por cada uno.
-- Esta migración agrega lote_id para agrupar registros de la misma
-- transacción, actualiza los SPs de listado para mostrar grupos y
-- crea SPs de detalle por lote.
--
-- Retrocompatibilidad: registros con lote_id = NULL se muestran
-- igual que antes. Solo los nuevos (lote_id NOT NULL) se agrupan.
-- ============================================================

-- ============================================================
-- 1. Columnas lote_id
-- ============================================================
ALTER TABLE movimiento ADD COLUMN IF NOT EXISTS lote_id uuid DEFAULT NULL;
ALTER TABLE solicitud  ADD COLUMN IF NOT EXISTS lote_id uuid DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_movimiento_lote ON movimiento(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_solicitud_lote  ON solicitud(lote_id)  WHERE lote_id IS NOT NULL;

-- ============================================================
-- 2. sp_registrar_ingreso_multiple  (NUEVO)
-- ============================================================
CREATE OR REPLACE FUNCTION sp_registrar_ingreso_multiple(
  p_centro_id       uuid,
  p_fecha           date,
  p_donante_id      uuid    DEFAULT NULL,
  p_donante_anonimo boolean DEFAULT false,
  p_observaciones   text    DEFAULT NULL,
  p_items           jsonb   DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id  uuid;
  v_lote_id     uuid;
  v_movimiento  uuid;
  v_item        jsonb;
  v_insumo_id   uuid;
  v_cantidad    numeric;
  v_ids         uuid[] := '{}';
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_donante_anonimo = true AND p_donante_id IS NOT NULL THEN
    RAISE EXCEPTION 'No puede haber donante_id si la donación es anónima';
  END IF;
  IF p_donante_anonimo = false AND p_donante_id IS NULL THEN
    RAISE EXCEPTION 'Debe indicar donante_id o marcar como anónimo';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El ingreso requiere al menos un insumo';
  END IF;

  v_lote_id := gen_random_uuid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_insumo_id := NULLIF(v_item->>'insumo_id', '')::uuid;
    v_cantidad  := (v_item->>'cantidad')::numeric;

    IF v_insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada insumo del ingreso es obligatorio';
    END IF;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada insumo debe ser mayor a cero';
    END IF;

    INSERT INTO movimiento(centro_id, insumo_id, tipo, cantidad, fecha_movimiento,
                           usuario_id, observaciones, lote_id)
    VALUES (p_centro_id, v_insumo_id, 'ingreso', v_cantidad, p_fecha,
            v_usuario_id, p_observaciones, v_lote_id)
    RETURNING id INTO v_movimiento;

    INSERT INTO detalle_ingreso(movimiento_id, donante_id, donante_anonimo)
    VALUES (v_movimiento, p_donante_id, p_donante_anonimo);

    v_ids := array_append(v_ids, v_movimiento);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'lote_id', v_lote_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_ingreso_multiple(uuid, date, uuid, boolean, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_ingreso_multiple(uuid, date, uuid, boolean, text, jsonb) TO authenticated;

-- ============================================================
-- 3. sp_registrar_egreso_multiple — agregar lote_id
-- ============================================================
DROP FUNCTION IF EXISTS sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean);

CREATE OR REPLACE FUNCTION sp_registrar_egreso_multiple(
  p_centro_id            uuid,
  p_fecha                date,
  p_destino_id           uuid,
  p_persona_contacto_id  uuid    DEFAULT NULL,
  p_responsables         jsonb   DEFAULT '[]'::jsonb,
  p_observaciones        text    DEFAULT NULL,
  p_items                jsonb   DEFAULT '[]'::jsonb,
  p_afecta_inventario    boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id  uuid;
  v_lote_id     uuid;
  v_movimiento  uuid;
  v_detalle     uuid;
  v_stock       numeric;
  v_resp        jsonb;
  v_item        jsonb;
  v_insumo_id   uuid;
  v_cantidad    numeric;
  v_solicitud   uuid;
  v_ids         uuid[] := '{}';
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_destino_id IS NULL THEN
    RAISE EXCEPTION 'El egreso requiere un destino';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El egreso requiere al menos un insumo';
  END IF;

  v_lote_id := gen_random_uuid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_insumo_id := NULLIF(v_item->>'insumo_id', '')::uuid;
    v_cantidad  := (v_item->>'cantidad')::numeric;
    v_solicitud := NULLIF(v_item->>'solicitud_id', '')::uuid;

    IF v_insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada insumo del egreso es obligatorio';
    END IF;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada insumo debe ser mayor a cero';
    END IF;

    IF p_afecta_inventario THEN
      SELECT stock INTO v_stock
      FROM inventario_centro
      WHERE centro_id = p_centro_id AND insumo_id = v_insumo_id;

      IF v_stock IS NULL OR v_stock < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el insumo %: disponible %, solicitado %',
          (SELECT nombre FROM insumo WHERE id = v_insumo_id),
          COALESCE(v_stock, 0), v_cantidad;
      END IF;
    END IF;

    INSERT INTO movimiento(centro_id, insumo_id, tipo, cantidad, fecha_movimiento,
                           usuario_id, observaciones, afecta_inventario, lote_id)
    VALUES (p_centro_id, v_insumo_id, 'egreso', v_cantidad, p_fecha,
            v_usuario_id, p_observaciones, p_afecta_inventario, v_lote_id)
    RETURNING id INTO v_movimiento;

    INSERT INTO detalle_egreso(movimiento_id, destino_id, persona_contacto_id)
    VALUES (v_movimiento, p_destino_id, p_persona_contacto_id)
    RETURNING id INTO v_detalle;

    FOR v_resp IN SELECT * FROM jsonb_array_elements(COALESCE(p_responsables, '[]'::jsonb)) LOOP
      INSERT INTO responsable_entrega(detalle_egreso_id, persona_id, nombre, apellido, telefono)
      VALUES (
        v_detalle,
        NULLIF(v_resp->>'persona_id', '')::uuid,
        NULLIF(v_resp->>'nombre', ''),
        NULLIF(v_resp->>'apellido', ''),
        NULLIF(v_resp->>'telefono', '')
      );
    END LOOP;

    IF v_solicitud IS NOT NULL THEN
      INSERT INTO solicitud_movimiento(solicitud_id, movimiento_id)
      VALUES (v_solicitud, v_movimiento)
      ON CONFLICT (solicitud_id, movimiento_id) DO NOTHING;
    END IF;

    v_ids := array_append(v_ids, v_movimiento);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'lote_id', v_lote_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean) TO authenticated;

-- ============================================================
-- 4. sp_registrar_solicitud_multiple — agregar lote_id
-- ============================================================
DROP FUNCTION IF EXISTS sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION sp_registrar_solicitud_multiple(
  p_centro_id      uuid,
  p_solicitante_id uuid,
  p_fecha          date    DEFAULT CURRENT_DATE,
  p_destino_id     uuid    DEFAULT NULL,
  p_observaciones  text    DEFAULT NULL,
  p_items          jsonb   DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_lote_id    uuid;
  v_item       jsonb;
  v_insumo_id  uuid;
  v_cantidad   numeric;
  v_id         uuid;
  v_ids        uuid[] := '{}';
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La solicitud requiere al menos un insumo';
  END IF;

  v_lote_id := gen_random_uuid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_insumo_id := NULLIF(v_item->>'insumo_id', '')::uuid;
    v_cantidad  := (v_item->>'cantidad')::numeric;

    IF v_insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada insumo de la solicitud es obligatorio';
    END IF;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada insumo debe ser mayor a cero';
    END IF;

    INSERT INTO solicitud(
      centro_id, insumo_id, cantidad_solicitada,
      solicitante_id, fecha_solicitud, destino_id, observaciones,
      usuario_registro_id, estado, lote_id
    )
    VALUES (
      p_centro_id, v_insumo_id, v_cantidad,
      p_solicitante_id, p_fecha, p_destino_id, p_observaciones,
      v_usuario_id, 'pendiente', v_lote_id
    )
    RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'lote_id', v_lote_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb) TO authenticated;

-- ============================================================
-- 5. sp_listar_ingresos — con agrupación por lote
-- ============================================================
CREATE OR REPLACE FUNCTION sp_listar_ingresos(
  p_centro_id  uuid,
  p_pagina     int DEFAULT 1,
  p_por_pagina int DEFAULT 20
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
  -- Contar grupos: individuales no-anulados + todos los lotes
  SELECT COUNT(DISTINCT COALESCE(m.lote_id, m.id)) INTO v_total
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND m.tipo = 'ingreso'
    AND (m.lote_id IS NOT NULL OR NOT m.anulado);

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

REVOKE ALL ON FUNCTION sp_listar_ingresos(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_ingresos(uuid, int, int) TO authenticated;

-- ============================================================
-- 6. sp_listar_egresos — con agrupación por lote
-- ============================================================
CREATE OR REPLACE FUNCTION sp_listar_egresos(
  p_centro_id  uuid,
  p_pagina     int DEFAULT 1,
  p_por_pagina int DEFAULT 20
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
  SELECT COUNT(DISTINCT COALESCE(m.lote_id, m.id)) INTO v_total
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND m.tipo = 'egreso'
    AND (m.lote_id IS NOT NULL OR NOT m.anulado);

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

REVOKE ALL ON FUNCTION sp_listar_egresos(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_egresos(uuid, int, int) TO authenticated;

-- ============================================================
-- 7. sp_listar_solicitudes — con agrupación por lote
-- ============================================================
CREATE OR REPLACE FUNCTION sp_listar_solicitudes(
  p_centro_id  uuid,
  p_estado     text DEFAULT NULL,
  p_pagina     int  DEFAULT 1,
  p_por_pagina int  DEFAULT 20
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
  SELECT COUNT(DISTINCT COALESCE(s.lote_id, s.id)) INTO v_total
  FROM solicitud s
  WHERE s.centro_id = p_centro_id
    AND (p_estado IS NULL OR s.estado::text = p_estado);

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

REVOKE ALL ON FUNCTION sp_listar_solicitudes(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_solicitudes(uuid, text, int, int) TO authenticated;

-- ============================================================
-- 8. sp_detalle_lote_ingresos  (NUEVO)
-- ============================================================
CREATE OR REPLACE FUNCTION sp_detalle_lote_ingresos(
  p_lote_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cab  jsonb;
  v_items jsonb;
BEGIN
  SELECT jsonb_build_object(
    'lote_id',         MAX(m.lote_id),
    'fecha',           MAX(m.fecha_movimiento),
    'registrado_por',  MAX(u.nombre || ' ' || u.apellido),
    'donante_anonimo', bool_and(di.donante_anonimo),
    'donante',
      CASE
        WHEN bool_and(di.donante_anonimo) THEN 'Anónimo'
        WHEN MAX(p.id::text) IS NOT NULL   THEN MAX(p.nombre || ' ' || p.apellido)
        ELSE '—'
      END,
    'observaciones', MAX(m.observaciones)
  ) INTO v_cab
  FROM movimiento m
  JOIN usuario         u  ON u.id  = m.usuario_id
  JOIN detalle_ingreso di ON di.movimiento_id = m.id
  LEFT JOIN persona    p  ON p.id  = di.donante_id
  WHERE m.lote_id = p_lote_id AND m.tipo = 'ingreso';

  IF v_cab IS NULL OR v_cab->>'lote_id' IS NULL THEN
    RAISE EXCEPTION 'Lote no encontrado: %', p_lote_id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id',             m.id,
    'insumo',         trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')),
    'cantidad',       m.cantidad,
    'anulado',        m.anulado,
    'anulado_motivo', m.anulado_motivo
  ) ORDER BY m.created_at)
  INTO v_items
  FROM movimiento m
  JOIN insumo i ON i.id = m.insumo_id
  WHERE m.lote_id = p_lote_id AND m.tipo = 'ingreso';

  RETURN v_cab || jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION sp_detalle_lote_ingresos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_detalle_lote_ingresos(uuid) TO authenticated;

-- ============================================================
-- 9. sp_detalle_lote_egresos  (NUEVO)
-- ============================================================
CREATE OR REPLACE FUNCTION sp_detalle_lote_egresos(
  p_lote_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cab  jsonb;
  v_resp jsonb;
  v_items jsonb;
BEGIN
  SELECT jsonb_build_object(
    'lote_id',           MAX(m.lote_id),
    'fecha',             MAX(m.fecha_movimiento),
    'registrado_por',    MAX(u.nombre || ' ' || u.apellido),
    'destino',           MAX(dst.nombre),
    'destino_municipio', MAX(dst.municipio),
    'persona_contacto',
      CASE WHEN MAX(pc.id::text) IS NOT NULL
           THEN MAX(pc.nombre || ' ' || pc.apellido)
           ELSE '—' END,
    'observaciones',     MAX(m.observaciones),
    'afecta_inventario', bool_and(m.afecta_inventario)
  ) INTO v_cab
  FROM movimiento m
  JOIN usuario        u   ON u.id   = m.usuario_id
  JOIN detalle_egreso de  ON de.movimiento_id = m.id
  JOIN destino        dst ON dst.id = de.destino_id
  LEFT JOIN persona   pc  ON pc.id  = de.persona_contacto_id
  WHERE m.lote_id = p_lote_id AND m.tipo = 'egreso';

  IF v_cab IS NULL OR v_cab->>'lote_id' IS NULL THEN
    RAISE EXCEPTION 'Lote no encontrado: %', p_lote_id;
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT
    CASE WHEN rp.id IS NOT NULL THEN rp.nombre || ' ' || rp.apellido
         ELSE re.nombre || ' ' || COALESCE(re.apellido, '')
    END
  ), '[]'::jsonb)
  INTO v_resp
  FROM movimiento m2
  JOIN detalle_egreso     de2 ON de2.movimiento_id = m2.id
  JOIN responsable_entrega re ON re.detalle_egreso_id = de2.id
  LEFT JOIN persona        rp ON rp.id = re.persona_id
  WHERE m2.lote_id = p_lote_id AND m2.tipo = 'egreso';

  SELECT jsonb_agg(jsonb_build_object(
    'id',             m.id,
    'insumo',         trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')),
    'cantidad',       m.cantidad,
    'anulado',        m.anulado,
    'anulado_motivo', m.anulado_motivo
  ) ORDER BY m.created_at)
  INTO v_items
  FROM movimiento m
  JOIN insumo i ON i.id = m.insumo_id
  WHERE m.lote_id = p_lote_id AND m.tipo = 'egreso';

  RETURN v_cab
    || jsonb_build_object('responsables', COALESCE(v_resp, '[]'::jsonb))
    || jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION sp_detalle_lote_egresos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_detalle_lote_egresos(uuid) TO authenticated;

-- ============================================================
-- 10. sp_detalle_lote_solicitudes  (NUEVO)
-- ============================================================
CREATE OR REPLACE FUNCTION sp_detalle_lote_solicitudes(
  p_lote_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cab   jsonb;
  v_items jsonb;
BEGIN
  SELECT jsonb_build_object(
    'lote_id',              MAX(s.lote_id),
    'fecha',                MAX(s.fecha_solicitud),
    'registrado_por',       MAX(u.nombre || ' ' || u.apellido),
    'solicitante',          MAX(p.nombre || ' ' || p.apellido),
    'solicitante_telefono', MAX(p.telefono),
    'destino',              MAX(d.nombre),
    'observaciones',        MAX(s.observaciones)
  ) INTO v_cab
  FROM solicitud s
  JOIN usuario u ON u.id = s.usuario_registro_id
  JOIN persona p ON p.id = s.solicitante_id
  LEFT JOIN destino d ON d.id = s.destino_id
  WHERE s.lote_id = p_lote_id;

  IF v_cab IS NULL OR v_cab->>'lote_id' IS NULL THEN
    RAISE EXCEPTION 'Lote no encontrado: %', p_lote_id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id',                  s.id,
    'insumo',              trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')),
    'cantidad_solicitada', s.cantidad_solicitada,
    'cantidad_despachada', COALESCE(
      (SELECT SUM(m2.cantidad)
       FROM solicitud_movimiento sm
       JOIN movimiento m2 ON m2.id = sm.movimiento_id
       WHERE sm.solicitud_id = s.id AND m2.anulado = false),
      0
    ),
    'estado',              s.estado,
    'estado_entrega',      s.estado_entrega
  ) ORDER BY s.created_at)
  INTO v_items
  FROM solicitud s
  JOIN insumo i ON i.id = s.insumo_id
  WHERE s.lote_id = p_lote_id;

  RETURN v_cab || jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION sp_detalle_lote_solicitudes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_detalle_lote_solicitudes(uuid) TO authenticated;
