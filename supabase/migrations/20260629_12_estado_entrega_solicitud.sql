-- =====================================================================
-- 20260629_12_estado_entrega_solicitud.sql
-- Flujo logístico manual de la solicitud (Obs. 1)
-- Estado de entrega independiente del estado automático por cantidad:
--   pendiente -> embalado -> enviado -> entregado
-- =====================================================================

-- 1. Enum de estado de entrega (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_entrega') THEN
    CREATE TYPE estado_entrega AS ENUM ('pendiente', 'embalado', 'enviado', 'entregado');
  END IF;
END$$;

-- 2. Columna en solicitud
ALTER TABLE solicitud
  ADD COLUMN IF NOT EXISTS estado_entrega estado_entrega NOT NULL DEFAULT 'pendiente';

-- 3. SP para cambiar el estado de entrega manualmente
CREATE OR REPLACE FUNCTION sp_actualizar_estado_entrega(
  p_solicitud_id   uuid,
  p_estado_entrega text,
  p_observaciones  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_estado estado_entrega;
BEGIN
  -- Validar valor del enum con mensaje amigable
  BEGIN
    v_estado := p_estado_entrega::estado_entrega;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Estado de entrega inválido: %', p_estado_entrega;
  END;

  -- La política RLS solicitud_acceso acota el UPDATE al centro del usuario.
  UPDATE solicitud
     SET estado_entrega = v_estado,
         observaciones  = COALESCE(NULLIF(p_observaciones, ''), observaciones),
         updated_at     = now()
   WHERE id = p_solicitud_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada o sin acceso';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_actualizar_estado_entrega(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_actualizar_estado_entrega(uuid, text, text) TO authenticated;

-- 4. Redefinir sp_listar_solicitudes para exponer estado_entrega
--    (basado en la definición viva en la BD)
CREATE OR REPLACE FUNCTION sp_listar_solicitudes(
  p_centro_id  uuid,
  p_estado     text DEFAULT NULL,
  p_pagina     int  DEFAULT 1,
  p_por_pagina int  DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
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
      s.estado_entrega,
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
