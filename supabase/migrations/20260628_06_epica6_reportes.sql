-- ============================================================
-- Épica 6 — Reportes y trazabilidad
-- HU-13: sp_reporte_centro
-- HU-14: sp_resumen_panel
-- ============================================================

-- -----------------------------------------------------------
-- sp_reporte_centro
-- Retorna movimientos + resumen por insumo + totales globales
-- para un centro en un rango de fechas.
-- Acceso: coordinador_centro o administrador_sistema del centro.
-- -----------------------------------------------------------
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
  -- Solo coordinador o admin del centro puede generar reportes
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

  -- Movimientos detallados (solo activos)
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
      i.unidad_medida,
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

  -- Resumen por insumo
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_resumen
  FROM (
    SELECT
      i.nombre        AS insumo,
      i.unidad_medida,
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
    GROUP BY i.id, i.nombre, i.unidad_medida, ci.nombre, ic.stock
    ORDER BY ci.nombre, i.nombre
  ) t;

  -- Totales globales del período
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

-- -----------------------------------------------------------
-- sp_resumen_panel
-- KPIs globales + actividad por centro.
-- Acceso: solo administrador_sistema.
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_resumen_panel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_kpis    jsonb;
  v_centros jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM usuario_centro uc
    JOIN usuario u ON u.id = uc.usuario_id
    WHERE u.auth_user_id = auth.uid()
      AND uc.rol     = 'administrador_sistema'
      AND uc.activo  = true
  ) THEN
    RAISE EXCEPTION 'Solo el administrador del sistema puede acceder al panel general';
  END IF;

  SELECT jsonb_build_object(
    'centros_activos',       (SELECT COUNT(*)                FROM centro_acopio  WHERE activo = true),
    'ingresos_hoy',          (SELECT COUNT(*)                FROM movimiento     WHERE tipo = 'ingreso' AND fecha_movimiento = CURRENT_DATE AND anulado = false),
    'egresos_hoy',           (SELECT COUNT(*)                FROM movimiento     WHERE tipo = 'egreso'  AND fecha_movimiento = CURRENT_DATE AND anulado = false),
    'solicitudes_pendientes',(SELECT COUNT(*)                FROM solicitud      WHERE estado = 'pendiente'),
    'ingresos_semana',       (SELECT COUNT(*)                FROM movimiento     WHERE tipo = 'ingreso' AND fecha_movimiento >= CURRENT_DATE - 7 AND anulado = false),
    'egresos_semana',        (SELECT COUNT(*)                FROM movimiento     WHERE tipo = 'egreso'  AND fecha_movimiento >= CURRENT_DATE - 7 AND anulado = false)
  ) INTO v_kpis;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_centros
  FROM (
    SELECT
      ca.id,
      ca.nombre,
      ca.municipio,
      ca.estado_geo,
      (SELECT COUNT(*) FROM movimiento m WHERE m.centro_id = ca.id AND m.tipo = 'ingreso' AND m.fecha_movimiento >= CURRENT_DATE - 7 AND m.anulado = false) AS ingresos_semana,
      (SELECT COUNT(*) FROM movimiento m WHERE m.centro_id = ca.id AND m.tipo = 'egreso'  AND m.fecha_movimiento >= CURRENT_DATE - 7 AND m.anulado = false) AS egresos_semana,
      (SELECT COUNT(*) FROM solicitud  s WHERE s.centro_id = ca.id AND s.estado = 'pendiente')    AS solicitudes_pendientes,
      (SELECT COUNT(*) FROM inventario_centro ic WHERE ic.centro_id = ca.id AND ic.stock > 0)     AS insumos_con_stock
    FROM centro_acopio ca
    WHERE ca.activo = true
    ORDER BY ca.nombre
  ) t;

  RETURN jsonb_build_object(
    'kpis',    v_kpis,
    'centros', v_centros
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_resumen_panel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_resumen_panel() TO authenticated;
