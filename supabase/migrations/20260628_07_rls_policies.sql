-- ============================================================
-- Migración 07 · Políticas RLS faltantes + endurecimiento de autorización
-- ------------------------------------------------------------
-- Contexto: RLS estaba habilitado en las 14 tablas pero solo existían
-- políticas en 5 (centro_acopio, usuario, usuario_centro, movimiento,
-- inventario_centro). Las 9 tablas restantes quedaban en deny-all, lo que
-- rompía las Épicas 2–6 en runtime (todos los SP son SECURITY INVOKER).
-- Además, las políticas always-true de centro_acopio y usuario_centro
-- permitían escalada de privilegios (cualquier usuario podía auto-asignarse
-- administrador_sistema).
--
-- Esta migración:
--   1. Crea helpers de autorización (SECURITY DEFINER, solo exponen datos
--      del propio caller; necesarios para evitar recursión RLS).
--   2. Agrega las políticas faltantes (catálogos globales + tablas de
--      detalle scopeadas por el centro del movimiento/solicitud padre).
--   3. Endurece centro_acopio y usuario_centro a solo administrador_sistema.
--   4. Convierte los triggers de sistema a SECURITY DEFINER para que puedan
--      mantener inventario_centro / solicitud sin abrir escritura directa.
--   5. Añade sp_bootstrap_inicial para resolver el arranque (primer admin).
--   6. Limpia advisors de seguridad (search_path, EXECUTE del hook de auth).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers de autorización
-- SECURITY DEFINER: leen la membresía del caller saltando RLS, lo que evita
-- recursión infinita en las políticas de usuario_centro y mantiene las
-- expresiones de política simples. Solo revelan información del propio usuario.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_usuario_actual()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM usuario WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION fn_es_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_centro uc
    JOIN usuario u ON u.id = uc.usuario_id
    WHERE u.auth_user_id = auth.uid()
      AND uc.rol = 'administrador_sistema'
      AND uc.activo = true
  )
$$;

CREATE OR REPLACE FUNCTION fn_centros_del_usuario()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT uc.centro_id FROM usuario_centro uc
  JOIN usuario u ON u.id = uc.usuario_id
  WHERE u.auth_user_id = auth.uid() AND uc.activo = true
$$;

REVOKE ALL ON FUNCTION fn_usuario_actual()        FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_es_admin()              FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_centros_del_usuario()   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_usuario_actual()      TO authenticated;
GRANT EXECUTE ON FUNCTION fn_es_admin()            TO authenticated;
GRANT EXECUTE ON FUNCTION fn_centros_del_usuario() TO authenticated;

-- ------------------------------------------------------------
-- 2. Catálogos y registros globales (compartidos entre centros)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS cat_select    ON categoria_insumo;
CREATE POLICY cat_select    ON categoria_insumo FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS insumo_select ON insumo;
CREATE POLICY insumo_select ON insumo            FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS persona_select ON persona;
DROP POLICY IF EXISTS persona_insert ON persona;
CREATE POLICY persona_select ON persona FOR SELECT TO authenticated USING (true);
CREATE POLICY persona_insert ON persona FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS destino_select ON destino;
DROP POLICY IF EXISTS destino_insert ON destino;
CREATE POLICY destino_select ON destino FOR SELECT TO authenticated USING (true);
CREATE POLICY destino_insert ON destino FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------
-- 3. Tablas de detalle: acceso scopeado por el centro del padre
-- ------------------------------------------------------------
DROP POLICY IF EXISTS detalle_ingreso_acceso ON detalle_ingreso;
CREATE POLICY detalle_ingreso_acceso ON detalle_ingreso FOR ALL TO authenticated
USING (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM movimiento m
    WHERE m.id = movimiento_id AND m.centro_id IN (SELECT fn_centros_del_usuario())
  )
)
WITH CHECK (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM movimiento m
    WHERE m.id = movimiento_id AND m.centro_id IN (SELECT fn_centros_del_usuario())
  )
);

DROP POLICY IF EXISTS detalle_egreso_acceso ON detalle_egreso;
CREATE POLICY detalle_egreso_acceso ON detalle_egreso FOR ALL TO authenticated
USING (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM movimiento m
    WHERE m.id = movimiento_id AND m.centro_id IN (SELECT fn_centros_del_usuario())
  )
)
WITH CHECK (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM movimiento m
    WHERE m.id = movimiento_id AND m.centro_id IN (SELECT fn_centros_del_usuario())
  )
);

DROP POLICY IF EXISTS responsable_acceso ON responsable_entrega;
CREATE POLICY responsable_acceso ON responsable_entrega FOR ALL TO authenticated
USING (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM detalle_egreso de
    JOIN movimiento m ON m.id = de.movimiento_id
    WHERE de.id = detalle_egreso_id AND m.centro_id IN (SELECT fn_centros_del_usuario())
  )
)
WITH CHECK (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM detalle_egreso de
    JOIN movimiento m ON m.id = de.movimiento_id
    WHERE de.id = detalle_egreso_id AND m.centro_id IN (SELECT fn_centros_del_usuario())
  )
);

-- solicitud: tiene centro_id propio
DROP POLICY IF EXISTS solicitud_acceso ON solicitud;
CREATE POLICY solicitud_acceso ON solicitud FOR ALL TO authenticated
USING      (fn_es_admin() OR centro_id IN (SELECT fn_centros_del_usuario()))
WITH CHECK (fn_es_admin() OR centro_id IN (SELECT fn_centros_del_usuario()));

-- solicitud_movimiento: scopeado por el centro de la solicitud padre
DROP POLICY IF EXISTS solicitud_mov_acceso ON solicitud_movimiento;
CREATE POLICY solicitud_mov_acceso ON solicitud_movimiento FOR ALL TO authenticated
USING (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM solicitud s
    WHERE s.id = solicitud_id AND s.centro_id IN (SELECT fn_centros_del_usuario())
  )
)
WITH CHECK (
  fn_es_admin() OR EXISTS (
    SELECT 1 FROM solicitud s
    WHERE s.id = solicitud_id AND s.centro_id IN (SELECT fn_centros_del_usuario())
  )
);

-- ------------------------------------------------------------
-- 4. Endurecer inventario_centro (lectura solo del propio centro)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS inventario_select ON inventario_centro;
CREATE POLICY inventario_select ON inventario_centro FOR SELECT TO authenticated
USING (fn_es_admin() OR centro_id IN (SELECT fn_centros_del_usuario()));

-- ------------------------------------------------------------
-- 5. Endurecer centro_acopio y usuario_centro a solo administrador_sistema
-- (reemplaza las políticas WITH CHECK(true) que permitían escalada)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS centros_insert_authenticated ON centro_acopio;
DROP POLICY IF EXISTS centros_update_authenticated ON centro_acopio;
CREATE POLICY centros_insert_admin ON centro_acopio FOR INSERT TO authenticated WITH CHECK (fn_es_admin());
CREATE POLICY centros_update_admin ON centro_acopio FOR UPDATE TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS usuario_centro_insert ON usuario_centro;
DROP POLICY IF EXISTS usuario_centro_update ON usuario_centro;
CREATE POLICY usuario_centro_insert_admin ON usuario_centro FOR INSERT TO authenticated WITH CHECK (fn_es_admin());
CREATE POLICY usuario_centro_update_admin ON usuario_centro FOR UPDATE TO authenticated USING (fn_es_admin()) WITH CHECK (fn_es_admin());

-- ------------------------------------------------------------
-- 6. Triggers de sistema → SECURITY DEFINER
-- inventario_centro y solicitud no tienen políticas de escritura para usuarios
-- (por diseño: AGENTS.md §10). Los triggers deben poder mantenerlas igualmente.
-- ------------------------------------------------------------
ALTER FUNCTION fn_actualizar_stock()            SECURITY DEFINER SET search_path = public;
ALTER FUNCTION fn_actualizar_estado_solicitud() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION fn_actualizar_updated_at()                        SET search_path = public;

-- ------------------------------------------------------------
-- 7. Endurecer SP admin-only con verificación de rol (errores claros,
-- defensa en profundidad sobre las nuevas políticas RLS)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_centro_acopio(
  p_nombre     varchar,
  p_direccion  text,
  p_municipio  varchar,
  p_estado_geo varchar,
  p_telefono   varchar DEFAULT NULL,
  p_correo     varchar DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede crear centros de acopio';
  END IF;

  INSERT INTO centro_acopio(nombre, direccion, municipio, estado_geo, telefono, correo)
  VALUES (p_nombre, p_direccion, p_municipio, p_estado_geo, p_telefono, p_correo)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION sp_asignar_usuario_centro(
  p_usuario_id uuid,
  p_centro_id  uuid,
  p_rol        rol_usuario
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'Solo un administrador del sistema puede asignar usuarios a centros';
  END IF;

  INSERT INTO usuario_centro(usuario_id, centro_id, rol)
  VALUES (p_usuario_id, p_centro_id, p_rol)
  ON CONFLICT (usuario_id, centro_id)
  DO UPDATE SET rol = EXCLUDED.rol, activo = true
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

-- ------------------------------------------------------------
-- 8. sp_bootstrap_inicial: resuelve el arranque (chicken-and-egg).
-- Crea el primer centro y asigna al usuario actual como administrador_sistema.
-- SECURITY DEFINER porque debe escribir bajo las políticas restrictivas.
-- Se auto-deshabilita en cuanto exista cualquier admin activo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_bootstrap_inicial(
  p_centro_nombre varchar,
  p_direccion     text,
  p_municipio     varchar,
  p_estado_geo    varchar
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario_id uuid;
  v_centro_id  uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM usuario_centro WHERE rol = 'administrador_sistema' AND activo = true) THEN
    RAISE EXCEPTION 'El sistema ya tiene un administrador. Bootstrap deshabilitado.';
  END IF;

  SELECT id INTO v_usuario_id FROM usuario WHERE auth_user_id = auth.uid();
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  INSERT INTO centro_acopio(nombre, direccion, municipio, estado_geo)
  VALUES (p_centro_nombre, p_direccion, p_municipio, p_estado_geo)
  RETURNING id INTO v_centro_id;

  INSERT INTO usuario_centro(usuario_id, centro_id, rol)
  VALUES (v_usuario_id, v_centro_id, 'administrador_sistema');

  RETURN jsonb_build_object('ok', true, 'centro_id', v_centro_id, 'usuario_id', v_usuario_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_bootstrap_inicial(varchar, text, varchar, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_bootstrap_inicial(varchar, text, varchar, varchar) TO authenticated;

-- ------------------------------------------------------------
-- 9. El hook de auth no debe ser invocable vía REST (solo lo dispara el trigger)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION fn_on_auth_user_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_on_auth_user_created() FROM anon, authenticated;
