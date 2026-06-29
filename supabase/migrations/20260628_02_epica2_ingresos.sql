-- ============================================================
-- Migración 02 · Épica 2 — Ingresos (HU-03, HU-04)
-- ============================================================

-- -------------------------------------------------------
-- sp_listar_categorias_insumos
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_categorias_insumos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(c) ORDER BY c.nombre)
    FROM (
      SELECT id, nombre
      FROM categoria_insumo
      WHERE activo = true
      ORDER BY nombre
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_categorias_insumos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_categorias_insumos() TO authenticated;

-- -------------------------------------------------------
-- sp_listar_insumos  (opcionalmente filtra por categoría)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_insumos(
  p_categoria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(i) ORDER BY i.nombre)
    FROM (
      SELECT i.id, i.nombre, i.unidad_medida, i.descripcion,
             c.nombre AS categoria
      FROM insumo i
      JOIN categoria_insumo c ON c.id = i.categoria_id
      WHERE i.activo = true
        AND (p_categoria_id IS NULL OR i.categoria_id = p_categoria_id)
      ORDER BY i.nombre
    ) i
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_insumos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_insumos(uuid) TO authenticated;

-- -------------------------------------------------------
-- sp_buscar_persona  (HU-04, HU-12)
-- Búsqueda por nombre, apellido, teléfono o cédula
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_buscar_persona(
  p_termino text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_term text := '%' || lower(trim(p_termino)) || '%';
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(p) ORDER BY p.nombre, p.apellido)
    FROM (
      SELECT id, nombre, apellido, cedula, telefono, correo
      FROM persona
      WHERE lower(nombre)    LIKE v_term
         OR lower(apellido)  LIKE v_term
         OR lower(telefono)  LIKE v_term
         OR lower(cedula)    LIKE v_term
      LIMIT 20
    ) p
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_buscar_persona(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_buscar_persona(text) TO authenticated;

-- -------------------------------------------------------
-- sp_crear_persona  (crea nueva persona y retorna id)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_crear_persona(
  p_nombre       varchar,
  p_apellido     varchar,
  p_telefono     varchar,
  p_cedula       varchar DEFAULT NULL,
  p_correo       varchar DEFAULT NULL,
  p_observaciones text   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO persona(nombre, apellido, telefono, cedula, correo, observaciones)
  VALUES (p_nombre, p_apellido, p_telefono, p_cedula, p_correo, p_observaciones)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_persona(varchar, varchar, varchar, varchar, varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_persona(varchar, varchar, varchar, varchar, varchar, text) TO authenticated;

-- -------------------------------------------------------
-- sp_registrar_ingreso  (HU-03)
-- Inserta movimiento + detalle_ingreso en una transacción
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_ingreso(
  p_centro_id        uuid,
  p_insumo_id        uuid,
  p_cantidad         numeric,
  p_fecha            date,
  p_donante_id       uuid    DEFAULT NULL,
  p_donante_anonimo  boolean DEFAULT false,
  p_observaciones    text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id  uuid;
  v_movimiento  uuid;
BEGIN
  -- Resolver usuario_id a partir del JWT
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  -- Validar consistencia donante
  IF p_donante_anonimo = true AND p_donante_id IS NOT NULL THEN
    RAISE EXCEPTION 'No puede haber donante_id si la donación es anónima';
  END IF;
  IF p_donante_anonimo = false AND p_donante_id IS NULL THEN
    RAISE EXCEPTION 'Debe indicar donante_id o marcar como anónimo';
  END IF;

  -- Insertar movimiento
  INSERT INTO movimiento(centro_id, insumo_id, tipo, cantidad, fecha_movimiento, usuario_id, observaciones)
  VALUES (p_centro_id, p_insumo_id, 'ingreso', p_cantidad, p_fecha, v_usuario_id, p_observaciones)
  RETURNING id INTO v_movimiento;

  -- Insertar detalle_ingreso
  INSERT INTO detalle_ingreso(movimiento_id, donante_id, donante_anonimo)
  VALUES (v_movimiento, p_donante_id, p_donante_anonimo);

  RETURN jsonb_build_object('id', v_movimiento, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_ingreso(uuid, uuid, numeric, date, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_ingreso(uuid, uuid, numeric, date, uuid, boolean, text) TO authenticated;

-- -------------------------------------------------------
-- sp_listar_ingresos  (listado para la vista)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_ingresos(
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
    AND m.tipo = 'ingreso'
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
      CASE
        WHEN di.donante_anonimo THEN 'Anónimo'
        WHEN p.id IS NOT NULL   THEN p.nombre || ' ' || p.apellido
        ELSE '—'
      END AS donante
    FROM movimiento m
    JOIN insumo          i  ON i.id  = m.insumo_id
    JOIN usuario         u  ON u.id  = m.usuario_id
    JOIN detalle_ingreso di ON di.movimiento_id = m.id
    LEFT JOIN persona    p  ON p.id  = di.donante_id
    WHERE m.centro_id = p_centro_id
      AND m.tipo = 'ingreso'
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

REVOKE ALL ON FUNCTION sp_listar_ingresos(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_ingresos(uuid, int, int) TO authenticated;

-- -------------------------------------------------------
-- sp_mi_perfil  (retorna datos del usuario autenticado + su centro activo)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_mi_perfil()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_perfil jsonb;
BEGIN
  SELECT jsonb_build_object(
    'usuario_id', u.id,
    'nombre',     u.nombre,
    'apellido',   u.apellido,
    'correo',     u.correo,
    'centro_id',  uc.centro_id,
    'centro',     ca.nombre,
    'rol',        uc.rol
  ) INTO v_perfil
  FROM usuario u
  JOIN usuario_centro uc ON uc.usuario_id = u.id AND uc.activo = true
  JOIN centro_acopio  ca ON ca.id = uc.centro_id AND ca.activo = true
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  RETURN v_perfil;
END;
$$;

REVOKE ALL ON FUNCTION sp_mi_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mi_perfil() TO authenticated;
