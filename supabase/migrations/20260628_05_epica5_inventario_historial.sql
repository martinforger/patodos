-- =============================================================
-- Épica 5: Consulta e Inventario
-- HU-10: sp_inventario_centro
-- HU-11: sp_historial_movimientos, sp_anular_movimiento
-- HU-12: sp_buscar_persona (ya existe en 02; este archivo es no-op para ese SP)
-- =============================================================

-- ------------------------------------------------------------
-- sp_inventario_centro
-- Retorna el stock actual del centro, con categoría y unidad.
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
      i.unidad_medida,
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
-- sp_historial_movimientos
-- Historial paginado con filtros opcionales de tipo y fechas.
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
      i.unidad_medida,
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
-- sp_anular_movimiento
-- Solo coordinador_centro o administrador_sistema puede anular.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_anular_movimiento(
  p_movimiento_id uuid,
  p_motivo        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_centro_id  uuid;
  v_rol        text;
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  SELECT m.centro_id INTO v_centro_id
  FROM movimiento m
  WHERE m.id = p_movimiento_id;

  IF v_centro_id IS NULL THEN
    RAISE EXCEPTION 'Movimiento no encontrado';
  END IF;

  SELECT uc.rol::text INTO v_rol
  FROM usuario_centro uc
  WHERE uc.usuario_id = v_usuario_id
    AND uc.centro_id  = v_centro_id
    AND uc.activo     = true;

  IF v_rol NOT IN ('coordinador_centro', 'administrador_sistema') THEN
    RAISE EXCEPTION 'Sin permiso para anular movimientos';
  END IF;

  UPDATE movimiento SET
    anulado        = true,
    anulado_por    = v_usuario_id,
    anulado_motivo = p_motivo,
    anulado_at     = now()
  WHERE id = p_movimiento_id AND anulado = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El movimiento ya está anulado o no existe';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_anular_movimiento(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_anular_movimiento(uuid, text) TO authenticated;
