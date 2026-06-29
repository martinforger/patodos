-- ============================================================
-- Migración 03 · Épica 3 — Egresos y despachos (HU-05, HU-06, HU-07)
-- ============================================================

-- -------------------------------------------------------
-- sp_listar_destinos  (catálogo de destinos activos)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_destinos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.nombre), '[]'::jsonb)
    FROM (
      SELECT id, nombre, direccion, municipio, estado_geo, referencia
      FROM destino
      WHERE activo = true
      ORDER BY nombre
    ) d
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_destinos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_destinos() TO authenticated;

-- -------------------------------------------------------
-- sp_crear_destino  (HU-06, crea destino nuevo y retorna id)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_crear_destino(
  p_nombre      varchar,
  p_direccion   text,
  p_municipio   varchar,
  p_estado_geo  varchar,
  p_referencia  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO destino(nombre, direccion, municipio, estado_geo, referencia)
  VALUES (p_nombre, p_direccion, p_municipio, p_estado_geo, p_referencia)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_destino(varchar, text, varchar, varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_destino(varchar, text, varchar, varchar, text) TO authenticated;

-- -------------------------------------------------------
-- sp_registrar_egreso  (HU-05, HU-06, HU-07)
-- Inserta movimiento + detalle_egreso + responsable_entrega en una transacción.
-- Valida stock suficiente antes de insertar (el trigger trg_actualizar_stock
-- también lo enforza, pero acá damos un mensaje claro).
--
-- p_responsables: jsonb array de objetos. Cada uno puede ser:
--   { "persona_id": "<uuid>" }  ó  { "nombre": "...", "apellido": "...", "telefono": "..." }
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_egreso(
  p_centro_id            uuid,
  p_insumo_id            uuid,
  p_cantidad             numeric,
  p_fecha                date,
  p_destino_id           uuid,
  p_persona_contacto_id  uuid    DEFAULT NULL,
  p_responsables         jsonb   DEFAULT '[]'::jsonb,
  p_observaciones        text    DEFAULT NULL
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
BEGIN
  -- Resolver usuario_id a partir del JWT
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_destino_id IS NULL THEN
    RAISE EXCEPTION 'El egreso requiere un destino';
  END IF;

  -- Validar stock disponible (mensaje amigable antes del trigger)
  SELECT stock INTO v_stock
  FROM inventario_centro
  WHERE centro_id = p_centro_id AND insumo_id = p_insumo_id;

  IF v_stock IS NULL OR v_stock < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente: disponible %, solicitado %',
      COALESCE(v_stock, 0), p_cantidad;
  END IF;

  -- Insertar movimiento (el trigger descuenta el stock)
  INSERT INTO movimiento(centro_id, insumo_id, tipo, cantidad, fecha_movimiento, usuario_id, observaciones)
  VALUES (p_centro_id, p_insumo_id, 'egreso', p_cantidad, p_fecha, v_usuario_id, p_observaciones)
  RETURNING id INTO v_movimiento;

  -- Insertar detalle_egreso
  INSERT INTO detalle_egreso(movimiento_id, destino_id, persona_contacto_id)
  VALUES (v_movimiento, p_destino_id, p_persona_contacto_id)
  RETURNING id INTO v_detalle;

  -- Insertar responsables de entrega (0..N)
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

  RETURN jsonb_build_object('id', v_movimiento, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_egreso(uuid, uuid, numeric, date, uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_egreso(uuid, uuid, numeric, date, uuid, uuid, jsonb, text) TO authenticated;

-- -------------------------------------------------------
-- sp_listar_egresos  (listado para la vista)
-- -------------------------------------------------------
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
      i.unidad_medida,
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
