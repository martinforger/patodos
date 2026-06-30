-- ============================================================
-- Migración 25 · Reportes: solicitudes por día y egresos por
-- categoría de destino
-- ------------------------------------------------------------
-- Dos SPs nuevos para la pestaña Reportes, mismo patrón de
-- permisos (coordinador_centro/administrador_sistema del centro)
-- y mismos parámetros de rango de fecha que sp_reporte_centro.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_reporte_solicitudes_por_dia(
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
  v_resultado jsonb;
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

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.fecha DESC), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT
      s.fecha_solicitud::text AS fecha,
      COUNT(*)                                                       AS total,
      COUNT(*) FILTER (WHERE s.estado = 'pendiente')                 AS pendientes,
      COUNT(*) FILTER (WHERE s.estado = 'parcialmente_atendida')     AS parcialmente_atendidas,
      COUNT(*) FILTER (WHERE s.estado = 'completada')                AS completadas,
      COUNT(*) FILTER (WHERE s.estado = 'cancelada')                 AS canceladas
    FROM solicitud s
    WHERE s.centro_id = p_centro_id
      AND (p_fecha_desde IS NULL OR s.fecha_solicitud >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR s.fecha_solicitud <= p_fecha_hasta)
    GROUP BY s.fecha_solicitud
  ) t;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION sp_reporte_solicitudes_por_dia(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_reporte_solicitudes_por_dia(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION sp_reporte_egresos_por_categoria_destino(
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
  v_resultado jsonb;
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

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.unidades DESC), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT
      COALESCE(cd.nombre, 'Sin categoría') AS categoria,
      COUNT(DISTINCT m.id)                 AS num_egresos,
      COALESCE(SUM(m.cantidad), 0)         AS unidades
    FROM movimiento m
    JOIN detalle_egreso de ON de.movimiento_id = m.id
    JOIN destino d         ON d.id = de.destino_id
    LEFT JOIN categoria_destino cd ON cd.id = d.categoria_id
    WHERE m.centro_id = p_centro_id
      AND m.tipo = 'egreso'
      AND m.anulado = false
      AND (p_fecha_desde IS NULL OR m.fecha_movimiento >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR m.fecha_movimiento <= p_fecha_hasta)
    GROUP BY cd.nombre
  ) t;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION sp_reporte_egresos_por_categoria_destino(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_reporte_egresos_por_categoria_destino(uuid, date, date) TO authenticated;
