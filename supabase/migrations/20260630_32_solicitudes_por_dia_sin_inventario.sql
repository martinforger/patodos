-- ============================================================
-- Migración 31 · Solicitudes por día: diferenciar atención sin inventario
-- ------------------------------------------------------------
-- sp_reporte_solicitudes_por_dia ahora expone cuántas solicitudes
-- completadas/parcialmente atendidas de cada día fueron cubiertas con al
-- menos un egreso que no afectó el inventario (movimiento.afecta_inventario
-- = false), para diferenciarlas en el reporte de "Solicitudes por día".
-- ============================================================

CREATE OR REPLACE FUNCTION sp_reporte_solicitudes_por_dia(
  p_centro_id uuid,
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
      COUNT(*) FILTER (WHERE s.estado = 'cancelada')                 AS canceladas,
      COUNT(*) FILTER (
        WHERE s.estado IN ('completada', 'parcialmente_atendida')
          AND EXISTS (
            SELECT 1
            FROM solicitud_movimiento sm
            JOIN movimiento m ON m.id = sm.movimiento_id
            WHERE sm.solicitud_id = s.id
              AND m.anulado = false
              AND m.afecta_inventario = false
          )
      )                                                               AS atendidas_sin_inventario
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
