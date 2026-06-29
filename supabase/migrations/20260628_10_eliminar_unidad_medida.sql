-- ============================================================
-- Migración 10 · Eliminar unidad_medida de insumo
-- ------------------------------------------------------------
-- Decisión de producto: el nombre del insumo describe todo
-- (ej. "Agua 1L", "Agua Minalba 5L"). Se elimina la columna
-- unidad_medida de la tabla insumo, se cambia el UNIQUE a
-- (nombre) y se recrean todos los SP que la proyectaban.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Esquema: constraint + columna
-- ------------------------------------------------------------
ALTER TABLE insumo DROP CONSTRAINT IF EXISTS uq_insumo_nombre_unidad;
ALTER TABLE insumo ADD CONSTRAINT uq_insumo_nombre UNIQUE (nombre);
ALTER TABLE insumo DROP COLUMN IF EXISTS unidad_medida;

-- ------------------------------------------------------------
-- 2. sp_crear_insumo  (sin unidad_medida)
-- SECURITY DEFINER: insumo es catálogo global sin política INSERT.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_crear_insumo(text, text, uuid);

CREATE OR REPLACE FUNCTION sp_crear_insumo(
  p_nombre       text,
  p_categoria_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categoria_nombre text;
  v_id               uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT nombre INTO v_categoria_nombre
  FROM categoria_insumo
  WHERE id = p_categoria_id AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no encontrada o inactiva';
  END IF;

  INSERT INTO insumo (categoria_id, nombre)
  VALUES (p_categoria_id, trim(p_nombre))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',        v_id,
    'nombre',    trim(p_nombre),
    'categoria', v_categoria_nombre
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_insumo(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_insumo(text, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 3. sp_listar_insumos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_insumos(
  p_categoria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(i) ORDER BY i.nombre)
    FROM (
      SELECT i.id, i.nombre, i.descripcion,
             c.nombre AS categoria
      FROM insumo i
      JOIN categoria_insumo c ON c.id = i.categoria_id
      WHERE i.activo = true
        AND (p_categoria_id IS NULL OR i.categoria_id = p_categoria_id)
      ORDER BY i.nombre
    ) i
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_insumos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_insumos(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4. sp_listar_ingresos
-- ------------------------------------------------------------
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
  SELECT count(*) INTO v_total
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND m.tipo = 'ingreso'
    AND m.anulado = false;

  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT
      m.id,
      m.fecha_movimiento,
      m.cantidad,
      m.observaciones,
      m.anulado,
      i.nombre   AS insumo,
      u.nombre   || ' ' || u.apellido AS registrado_por,
      CASE
        WHEN di.donante_anonimo THEN 'Anónimo'
        WHEN p.id IS NOT NULL   THEN p.nombre || ' ' || p.apellido
        ELSE '—'
      END AS donante
    FROM movimiento m
    JOIN insumo          i  ON i.id  = m.insumo_id
    JOIN usuario         u  ON u.id  = m.usuario_id
    JOIN detalle_ingreso di ON di.movimiento_id = m.id
    LEFT JOIN persona    p  ON p.id  = di.donante_id
    WHERE m.centro_id = p_centro_id
      AND m.tipo = 'ingreso'
    ORDER BY m.fecha_movimiento DESC, m.created_at DESC
    LIMIT p_por_pagina OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'pagina', p_pagina,
    'datos', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_ingresos(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_ingresos(uuid, int, int) TO authenticated;

-- ------------------------------------------------------------
-- 5. sp_listar_egresos
-- ------------------------------------------------------------
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
  SELECT count(*) INTO v_total
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND m.tipo = 'egreso'
    AND m.anulado = false;

  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT
      m.id,
      m.fecha_movimiento,
      m.cantidad,
      m.observaciones,
      m.anulado,
      i.nombre   AS insumo,
      u.nombre   || ' ' || u.apellido AS registrado_por,
      dst.nombre AS destino,
      CASE
        WHEN pc.id IS NOT NULL THEN pc.nombre || ' ' || pc.apellido
        ELSE '—'
      END AS persona_contacto,
      (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN rp.id IS NOT NULL THEN rp.nombre || ' ' || rp.apellido
            ELSE re.nombre || ' ' || COALESCE(re.apellido, '')
          END
        ), '[]'::jsonb)
        FROM responsable_entrega re
        LEFT JOIN persona rp ON rp.id = re.persona_id
        WHERE re.detalle_egreso_id = de.id
      ) AS responsables
    FROM movimiento m
    JOIN insumo         i   ON i.id  = m.insumo_id
    JOIN usuario        u   ON u.id  = m.usuario_id
    JOIN detalle_egreso de  ON de.movimiento_id = m.id
    JOIN destino        dst ON dst.id = de.destino_id
    LEFT JOIN persona   pc  ON pc.id = de.persona_contacto_id
    WHERE m.centro_id = p_centro_id
      AND m.tipo = 'egreso'
    ORDER BY m.fecha_movimiento DESC, m.created_at DESC
    LIMIT p_por_pagina OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'pagina', p_pagina,
    'datos', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_egresos(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_egresos(uuid, int, int) TO authenticated;

-- ------------------------------------------------------------
-- 6. sp_listar_solicitudes
-- ------------------------------------------------------------
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
  SELECT count(*) INTO v_total
  FROM solicitud s
  WHERE s.centro_id = p_centro_id
    AND (p_estado IS NULL OR s.estado = p_estado::estado_solicitud);

  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.fecha_solicitud,
      s.cantidad_solicitada,
      s.estado,
      s.observaciones,
      i.nombre        AS insumo,
      p.nombre || ' ' || p.apellido AS solicitante,
      p.telefono      AS solicitante_telefono,
      u.nombre || ' ' || u.apellido AS registrado_por,
      COALESCE(
        (SELECT SUM(m2.cantidad)
         FROM solicitud_movimiento sm
         JOIN movimiento m2 ON m2.id = sm.movimiento_id
         WHERE sm.solicitud_id = s.id AND m2.anulado = false),
        0
      ) AS cantidad_despachada
    FROM solicitud s
    JOIN insumo  i ON i.id = s.insumo_id
    JOIN persona p ON p.id = s.solicitante_id
    JOIN usuario u ON u.id = s.usuario_registro_id
    WHERE s.centro_id = p_centro_id
      AND (p_estado IS NULL OR s.estado = p_estado::estado_solicitud)
    ORDER BY s.fecha_solicitud DESC, s.created_at DESC
    LIMIT p_por_pagina OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'pagina', p_pagina,
    'datos', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_solicitudes(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_solicitudes(uuid, text, int, int) TO authenticated;

-- ------------------------------------------------------------
-- 7. sp_listar_solicitudes_pendientes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_solicitudes_pendientes(
  p_centro_id uuid,
  p_insumo_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.fecha_solicitud), '[]'::jsonb)
    FROM (
      SELECT
        s.id,
        s.fecha_solicitud,
        s.cantidad_solicitada,
        s.estado,
        i.nombre        AS insumo,
        p.nombre || ' ' || p.apellido AS solicitante
      FROM solicitud s
      JOIN insumo  i ON i.id = s.insumo_id
      JOIN persona p ON p.id = s.solicitante_id
      WHERE s.centro_id = p_centro_id
        AND s.estado IN ('pendiente', 'parcialmente_atendida')
        AND (p_insumo_id IS NULL OR s.insumo_id = p_insumo_id)
      ORDER BY s.fecha_solicitud
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_solicitudes_pendientes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_solicitudes_pendientes(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 8. sp_inventario_centro
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_inventario_centro(
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.categoria, t.insumo)
  INTO v_resultado
  FROM (
    SELECT
      ic.id,
      ic.insumo_id,
      i.nombre        AS insumo,
      ci.id           AS categoria_id,
      ci.nombre       AS categoria,
      ic.stock,
      ic.updated_at
    FROM inventario_centro ic
    JOIN insumo          i  ON i.id  = ic.insumo_id
    JOIN categoria_insumo ci ON ci.id = i.categoria_id
    WHERE ic.centro_id = p_centro_id
      AND i.activo     = true
    ORDER BY ci.nombre, i.nombre
  ) t;

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION sp_inventario_centro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_inventario_centro(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 9. sp_historial_movimientos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_historial_movimientos(
  p_centro_id  uuid,
  p_tipo       tipo_movimiento DEFAULT NULL,
  p_fecha_desde date           DEFAULT NULL,
  p_fecha_hasta date           DEFAULT NULL,
  p_pagina     int             DEFAULT 1,
  p_por_pagina int             DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total  int;
  v_datos  jsonb;
  v_offset int;
BEGIN
  v_offset := (p_pagina - 1) * p_por_pagina;

  SELECT COUNT(*) INTO v_total
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND (p_tipo        IS NULL OR m.tipo            = p_tipo)
    AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta);

  SELECT jsonb_agg(row_to_json(t))
  INTO v_datos
  FROM (
    SELECT
      m.id,
      m.tipo,
      m.cantidad,
      m.fecha_movimiento,
      m.observaciones,
      m.anulado,
      m.anulado_motivo,
      m.anulado_at,
      i.nombre        AS insumo,
      ci.nombre       AS categoria,
      u.nombre || ' ' || u.apellido AS registrado_por,
      CASE WHEN m.tipo = 'egreso'  THEN d.nombre   ELSE NULL END AS destino,
      CASE
        WHEN m.tipo = 'ingreso' AND di.donante_anonimo = true THEN 'Anónimo'
        WHEN m.tipo = 'ingreso' AND p_don.id IS NOT NULL
          THEN p_don.nombre || ' ' || p_don.apellido
        ELSE NULL
      END AS donante
    FROM movimiento m
    JOIN insumo           i    ON i.id    = m.insumo_id
    JOIN categoria_insumo ci   ON ci.id   = i.categoria_id
    JOIN usuario          u    ON u.id    = m.usuario_id
    LEFT JOIN detalle_ingreso di   ON di.movimiento_id = m.id
    LEFT JOIN persona         p_don ON p_don.id        = di.donante_id
    LEFT JOIN detalle_egreso  de   ON de.movimiento_id  = m.id
    LEFT JOIN destino          d   ON d.id              = de.destino_id
    WHERE m.centro_id = p_centro_id
      AND (p_tipo        IS NULL OR m.tipo             = p_tipo)
      AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta)
    ORDER BY m.fecha_movimiento DESC, m.created_at DESC
    LIMIT p_por_pagina OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'total',  v_total,
    'pagina', p_pagina,
    'datos',  COALESCE(v_datos, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_historial_movimientos(uuid, tipo_movimiento, date, date, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_historial_movimientos(uuid, tipo_movimiento, date, date, int, int) TO authenticated;

-- ------------------------------------------------------------
-- 10. sp_reporte_centro
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_reporte_centro(
  p_centro_id   uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_centro_nombre varchar;
  v_movimientos   jsonb;
  v_resumen       jsonb;
  v_totales       jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM usuario_centro uc
    JOIN usuario u ON u.id = uc.usuario_id
    WHERE u.auth_user_id = auth.uid()
      AND uc.activo = true
      AND (
        (uc.centro_id = p_centro_id AND uc.rol IN ('coordinador_centro', 'administrador_sistema'))
        OR uc.rol = 'administrador_sistema'
      )
  ) THEN
    RAISE EXCEPTION 'Sin permisos para generar reportes de este centro';
  END IF;

  SELECT nombre INTO v_centro_nombre
  FROM centro_acopio
  WHERE id = p_centro_id;

  IF v_centro_nombre IS NULL THEN
    RAISE EXCEPTION 'Centro no encontrado';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'fecha_movimiento') DESC), '[]'::jsonb)
  INTO v_movimientos
  FROM (
    SELECT
      m.id,
      m.tipo,
      m.cantidad,
      m.fecha_movimiento::text,
      m.observaciones,
      i.nombre        AS insumo,
      ci.nombre       AS categoria,
      u.nombre || ' ' || u.apellido AS registrado_por,
      d.nombre        AS destino,
      CASE
        WHEN di.donante_anonimo = true THEN 'Anónimo'
        WHEN p_don.id IS NOT NULL      THEN p_don.nombre || ' ' || p_don.apellido
        ELSE NULL
      END             AS donante
    FROM movimiento m
    JOIN insumo i           ON i.id  = m.insumo_id
    JOIN categoria_insumo ci ON ci.id = i.categoria_id
    JOIN usuario u           ON u.id  = m.usuario_id
    LEFT JOIN detalle_egreso  de    ON de.movimiento_id  = m.id
    LEFT JOIN destino          d     ON d.id              = de.destino_id
    LEFT JOIN detalle_ingreso  di    ON di.movimiento_id  = m.id
    LEFT JOIN persona          p_don ON p_don.id          = di.donante_id
    WHERE m.centro_id = p_centro_id
      AND m.anulado   = false
      AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta)
    ORDER BY m.fecha_movimiento DESC, m.created_at DESC
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_resumen
  FROM (
    SELECT
      i.nombre        AS insumo,
      ci.nombre       AS categoria,
      COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE 0 END), 0) AS total_ingreso,
      COALESCE(SUM(CASE WHEN m.tipo = 'egreso'  THEN m.cantidad ELSE 0 END), 0) AS total_egreso,
      COALESCE(ic.stock, 0) AS stock_actual
    FROM movimiento m
    JOIN insumo i            ON i.id  = m.insumo_id
    JOIN categoria_insumo ci ON ci.id = i.categoria_id
    LEFT JOIN inventario_centro ic ON ic.insumo_id = i.id AND ic.centro_id = p_centro_id
    WHERE m.centro_id = p_centro_id
      AND m.anulado   = false
      AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta)
    GROUP BY i.id, i.nombre, ci.nombre, ic.stock
    ORDER BY ci.nombre, i.nombre
  ) t;

  SELECT jsonb_build_object(
    'num_ingresos',    COUNT(CASE WHEN m.tipo = 'ingreso' THEN 1 END),
    'num_egresos',     COUNT(CASE WHEN m.tipo = 'egreso'  THEN 1 END),
    'total_ingresos',  COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE 0 END), 0),
    'total_egresos',   COALESCE(SUM(CASE WHEN m.tipo = 'egreso'  THEN m.cantidad ELSE 0 END), 0)
  )
  INTO v_totales
  FROM movimiento m
  WHERE m.centro_id = p_centro_id
    AND m.anulado   = false
    AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta);

  RETURN jsonb_build_object(
    'centro',          v_centro_nombre,
    'centro_id',       p_centro_id,
    'fecha_desde',     p_fecha_desde,
    'fecha_hasta',     p_fecha_hasta,
    'totales',         v_totales,
    'resumen_insumos', v_resumen,
    'movimientos',     v_movimientos
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_reporte_centro(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_reporte_centro(uuid, date, date) TO authenticated;
