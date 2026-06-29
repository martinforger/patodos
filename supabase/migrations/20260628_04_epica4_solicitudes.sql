-- ============================================================
-- Migración 04 · Épica 4 — Solicitudes de ayuda (HU-08, HU-09)
-- ============================================================

-- -------------------------------------------------------
-- sp_registrar_solicitud  (HU-08)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_solicitud(
  p_centro_id           uuid,
  p_insumo_id           uuid,
  p_cantidad_solicitada numeric,
  p_solicitante_id      uuid,
  p_fecha               date    DEFAULT CURRENT_DATE,
  p_observaciones       text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_id         uuid;
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  INSERT INTO solicitud(
    centro_id, insumo_id, cantidad_solicitada,
    solicitante_id, fecha_solicitud, observaciones,
    usuario_registro_id, estado
  )
  VALUES (
    p_centro_id, p_insumo_id, p_cantidad_solicitada,
    p_solicitante_id, p_fecha, p_observaciones,
    v_usuario_id, 'pendiente'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_solicitud(uuid, uuid, numeric, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_solicitud(uuid, uuid, numeric, uuid, date, text) TO authenticated;

-- -------------------------------------------------------
-- sp_listar_solicitudes  (listado para la vista)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_solicitudes(
  p_centro_id  uuid,
  p_estado     text    DEFAULT NULL,
  p_pagina     int     DEFAULT 1,
  p_por_pagina int     DEFAULT 50
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
      i.unidad_medida,
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

-- -------------------------------------------------------
-- sp_vincular_solicitud_egreso  (HU-09)
-- El trigger trg_estado_solicitud recalcula el estado automáticamente.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_vincular_solicitud_egreso(
  p_solicitud_id  uuid,
  p_movimiento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO solicitud_movimiento(solicitud_id, movimiento_id)
  VALUES (p_solicitud_id, p_movimiento_id)
  ON CONFLICT (solicitud_id, movimiento_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_vincular_solicitud_egreso(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_vincular_solicitud_egreso(uuid, uuid) TO authenticated;

-- -------------------------------------------------------
-- sp_cancelar_solicitud  (coordinador / admin)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_cancelar_solicitud(
  p_solicitud_id uuid,
  p_motivo       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  UPDATE solicitud
  SET estado      = 'cancelada',
      observaciones = CASE
        WHEN p_motivo IS NOT NULL THEN COALESCE(observaciones || E'\n', '') || 'Cancelada: ' || p_motivo
        ELSE observaciones
      END,
      updated_at  = now()
  WHERE id = p_solicitud_id
    AND estado NOT IN ('completada', 'cancelada');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada o ya finalizada';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_cancelar_solicitud(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_cancelar_solicitud(uuid, text) TO authenticated;

-- -------------------------------------------------------
-- sp_listar_solicitudes_pendientes  (para el formulario de egreso)
-- Retorna solo id, insumo, cantidad_solicitada, solicitante
-- para poblar el selector de solicitudes al registrar un egreso.
-- -------------------------------------------------------
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
        i.unidad_medida,
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
