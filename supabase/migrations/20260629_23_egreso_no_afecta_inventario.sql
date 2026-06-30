-- ============================================================
-- Migración 23 · Egreso que no afecta el inventario
-- ------------------------------------------------------------
-- Contexto: a veces se necesita registrar un egreso (para que quede
-- en el historial/reportes) sin que descuente ni valide stock del
-- centro — por ejemplo, insumos que llegan y salen directo sin pasar
-- por el inventario formal. El checkbox aplica a TODO el egreso, no
-- insumo por insumo.
--
-- Cambios:
--   1. movimiento.afecta_inventario boolean NOT NULL DEFAULT true.
--   2. fn_actualizar_stock (trigger AFTER INSERT/UPDATE en movimiento,
--      definición confirmada en vivo vía pg_get_functiondef antes de
--      escribir esta migración) ahora se salta el UPDATE/INSERT sobre
--      inventario_centro cuando afecta_inventario = false, tanto al
--      insertar el movimiento como al anularlo.
--   3. sp_registrar_egreso_multiple recibe p_afecta_inventario
--      (default true): si es false, omite la validación de stock
--      disponible y marca cada movimiento creado como tal.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna afecta_inventario en movimiento
-- ------------------------------------------------------------
ALTER TABLE movimiento
  ADD COLUMN IF NOT EXISTS afecta_inventario boolean NOT NULL DEFAULT true;

-- ------------------------------------------------------------
-- 2. Trigger fn_actualizar_stock — saltar inventario cuando aplica
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_actualizar_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.anulado = TRUE AND OLD.anulado = FALSE THEN
        IF OLD.afecta_inventario = FALSE THEN
            RETURN NEW;
        END IF;

        IF OLD.tipo = 'ingreso' THEN
            UPDATE inventario_centro
               SET stock = stock - OLD.cantidad, updated_at = NOW()
             WHERE centro_id = OLD.centro_id AND insumo_id = OLD.insumo_id;
        ELSE
            UPDATE inventario_centro
               SET stock = stock + OLD.cantidad, updated_at = NOW()
             WHERE centro_id = OLD.centro_id AND insumo_id = OLD.insumo_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.afecta_inventario = FALSE THEN
            RETURN NEW;
        END IF;

        INSERT INTO inventario_centro (centro_id, insumo_id, stock)
             VALUES (NEW.centro_id, NEW.insumo_id, 0)
        ON CONFLICT (centro_id, insumo_id) DO NOTHING;

        IF NEW.tipo = 'ingreso' THEN
            UPDATE inventario_centro
               SET stock = stock + NEW.cantidad, updated_at = NOW()
             WHERE centro_id = NEW.centro_id AND insumo_id = NEW.insumo_id;
        ELSE
            IF (SELECT stock FROM inventario_centro
                 WHERE centro_id = NEW.centro_id AND insumo_id = NEW.insumo_id) < NEW.cantidad THEN
                RAISE EXCEPTION 'Stock insuficiente para el egreso solicitado.';
            END IF;
            UPDATE inventario_centro
               SET stock = stock - NEW.cantidad, updated_at = NOW()
             WHERE centro_id = NEW.centro_id AND insumo_id = NEW.insumo_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 3. sp_registrar_egreso_multiple — nuevo parámetro p_afecta_inventario
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb);

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

    -- Validar stock disponible (mensaje amigable antes del trigger),
    -- solo cuando el egreso sí afecta inventario.
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

    -- movimiento (el trigger descuenta el stock, salvo que afecta_inventario sea false)
    INSERT INTO movimiento(centro_id, insumo_id, tipo, cantidad, fecha_movimiento, usuario_id, observaciones, afecta_inventario)
    VALUES (p_centro_id, v_insumo_id, 'egreso', v_cantidad, p_fecha, v_usuario_id, p_observaciones, p_afecta_inventario)
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

REVOKE ALL ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean) TO authenticated;
