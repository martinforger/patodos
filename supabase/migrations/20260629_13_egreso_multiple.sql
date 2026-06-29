-- =====================================================================
-- 20260629_13_egreso_multiple.sql
-- Egreso multi-insumo (Obs. 2): despachar varios insumos en un mismo
-- egreso (mismo destino, contacto y responsables), con vinculación de
-- solicitud por item, todo en una sola transacción atómica.
-- Conserva sp_registrar_egreso (un insumo) para compatibilidad.
-- =====================================================================

CREATE OR REPLACE FUNCTION sp_registrar_egreso_multiple(
  p_centro_id            uuid,
  p_fecha                date,
  p_destino_id           uuid,
  p_persona_contacto_id  uuid    DEFAULT NULL,
  p_responsables         jsonb   DEFAULT '[]'::jsonb,
  p_observaciones        text    DEFAULT NULL,
  p_items                jsonb   DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id  uuid;
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
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_destino_id IS NULL THEN
    RAISE EXCEPTION 'El egreso requiere un destino';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El egreso requiere al menos un insumo';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_insumo_id := NULLIF(v_item->>'insumo_id', '')::uuid;
    v_cantidad  := (v_item->>'cantidad')::numeric;
    v_solicitud := NULLIF(v_item->>'solicitud_id', '')::uuid;

    IF v_insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada insumo del egreso es obligatorio';
    END IF;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada insumo debe ser mayor a cero';
    END IF;

    -- Validar stock disponible (mensaje amigable antes del trigger)
    SELECT stock INTO v_stock
    FROM inventario_centro
    WHERE centro_id = p_centro_id AND insumo_id = v_insumo_id;

    IF v_stock IS NULL OR v_stock < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para el insumo %: disponible %, solicitado %',
        (SELECT nombre FROM insumo WHERE id = v_insumo_id),
        COALESCE(v_stock, 0), v_cantidad;
    END IF;

    -- movimiento (el trigger descuenta el stock)
    INSERT INTO movimiento(centro_id, insumo_id, tipo, cantidad, fecha_movimiento, usuario_id, observaciones)
    VALUES (p_centro_id, v_insumo_id, 'egreso', v_cantidad, p_fecha, v_usuario_id, p_observaciones)
    RETURNING id INTO v_movimiento;

    -- detalle_egreso
    INSERT INTO detalle_egreso(movimiento_id, destino_id, persona_contacto_id)
    VALUES (v_movimiento, p_destino_id, p_persona_contacto_id)
    RETURNING id INTO v_detalle;

    -- responsables (los mismos para cada insumo del despacho)
    FOR v_resp IN SELECT * FROM jsonb_array_elements(COALESCE(p_responsables, '[]'::jsonb))
    LOOP
      INSERT INTO responsable_entrega(detalle_egreso_id, persona_id, nombre, apellido, telefono)
      VALUES (
        v_detalle,
        NULLIF(v_resp->>'persona_id', '')::uuid,
        NULLIF(v_resp->>'nombre', ''),
        NULLIF(v_resp->>'apellido', ''),
        NULLIF(v_resp->>'telefono', '')
      );
    END LOOP;

    -- Vincular solicitud (atómico; el trigger recalcula el estado por cantidad)
    IF v_solicitud IS NOT NULL THEN
      INSERT INTO solicitud_movimiento(solicitud_id, movimiento_id)
      VALUES (v_solicitud, v_movimiento)
      ON CONFLICT (solicitud_id, movimiento_id) DO NOTHING;
    END IF;

    v_ids := array_append(v_ids, v_movimiento);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids));
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb) TO authenticated;
