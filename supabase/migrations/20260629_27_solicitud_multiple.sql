-- ============================================================
-- Migración 27 · Solicitud multi-insumo + destino opcional
-- ------------------------------------------------------------
-- Contexto: el formulario de solicitud permitía un solo insumo por
-- envío. Se rediseña para permitir varios insumos en una misma
-- solicitud (como ya pasa con egreso multi-insumo) y agregar un
-- destino opcional que, al vincular la solicitud a un egreso, se
-- usa para autocompletar el destino del egreso.
--
-- No se convierte solicitud en tabla padre/hijo: sp_registrar_
-- solicitud_multiple crea una fila `solicitud` POR CADA insumo,
-- todas compartiendo centro_id/solicitante_id/destino_id/fecha/
-- observaciones — mismo patrón que sp_registrar_egreso_multiple
-- crea un `movimiento` por insumo compartiendo destino/contacto.
-- sp_registrar_solicitud (un insumo) se deja intacta por si algún
-- otro caller la usa.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna destino_id en solicitud (opcional)
-- ------------------------------------------------------------
ALTER TABLE solicitud
  ADD COLUMN IF NOT EXISTS destino_id uuid REFERENCES destino(id);

-- ------------------------------------------------------------
-- 2. sp_registrar_solicitud_multiple
-- ------------------------------------------------------------
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
  v_item       jsonb;
  v_insumo_id  uuid;
  v_cantidad   numeric;
  v_id         uuid;
  v_ids        uuid[] := '{}';
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La solicitud requiere al menos un insumo';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
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
      usuario_registro_id, estado
    )
    VALUES (
      p_centro_id, v_insumo_id, v_cantidad,
      p_solicitante_id, p_fecha, p_destino_id, p_observaciones,
      v_usuario_id, 'pendiente'
    )
    RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- 3. sp_listar_solicitudes_pendientes — incluir destino
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_listar_solicitudes_pendientes(uuid, uuid);

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
        s.insumo_id,
        trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo,
        i.unidad_medida,
        p.nombre || ' ' || p.apellido AS solicitante,
        s.destino_id,
        d.nombre      AS destino,
        d.municipio   AS destino_municipio,
        d.estado_geo  AS destino_estado_geo
      FROM solicitud s
      JOIN insumo  i ON i.id = s.insumo_id
      JOIN persona p ON p.id = s.solicitante_id
      LEFT JOIN destino d ON d.id = s.destino_id
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
