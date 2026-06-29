-- ============================================================
-- Migración 01 · Stored Procedures del sistema
-- Ejecutar en Supabase SQL Editor o con Supabase CLI
-- ============================================================

-- -------------------------------------------------------
-- sp_registrar_centro_acopio  (HU-01)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_centro_acopio(
  p_nombre     varchar,
  p_direccion  text,
  p_municipio  varchar,
  p_estado_geo varchar,
  p_telefono   varchar DEFAULT NULL,
  p_correo     varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO centro_acopio(nombre, direccion, municipio, estado_geo, telefono, correo)
  VALUES (p_nombre, p_direccion, p_municipio, p_estado_geo, p_telefono, p_correo)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_centro_acopio(varchar, text, varchar, varchar, varchar, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_centro_acopio(varchar, text, varchar, varchar, varchar, varchar) TO authenticated;

-- -------------------------------------------------------
-- sp_listar_centros  (lectura de admin — sin filtro de centro)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_centros()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(c))
    FROM (
      SELECT id, nombre, municipio, estado_geo, telefono, activo
      FROM centro_acopio
      ORDER BY nombre
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_centros() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_centros() TO authenticated;

-- -------------------------------------------------------
-- sp_asignar_usuario_centro  (HU-02)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_asignar_usuario_centro(
  p_usuario_id uuid,
  p_centro_id  uuid,
  p_rol        rol_usuario
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO usuario_centro(usuario_id, centro_id, rol)
  VALUES (p_usuario_id, p_centro_id, p_rol)
  ON CONFLICT (usuario_id, centro_id)
  DO UPDATE SET rol = EXCLUDED.rol, activo = true
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_asignar_usuario_centro(uuid, uuid, rol_usuario) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_asignar_usuario_centro(uuid, uuid, rol_usuario) TO authenticated;

-- -------------------------------------------------------
-- sp_listar_usuarios_centros  (lectura admin HU-02)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_usuarios_centros()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        uc.id,
        uc.rol,
        uc.activo,
        jsonb_build_object(
          'id', u.id,
          'nombre', u.nombre,
          'apellido', u.apellido,
          'correo', u.correo
        ) AS usuario,
        jsonb_build_object(
          'id', c.id,
          'nombre', c.nombre
        ) AS centro
      FROM usuario_centro uc
      JOIN usuario u ON u.id = uc.usuario_id
      JOIN centro_acopio c ON c.id = uc.centro_id
      ORDER BY uc.activo DESC, u.apellido
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_usuarios_centros() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_usuarios_centros() TO authenticated;

-- -------------------------------------------------------
-- sp_listar_usuarios  (para select en formulario)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_usuarios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(u))
    FROM (
      SELECT id, nombre, apellido, correo
      FROM usuario
      WHERE activo = true
      ORDER BY nombre
    ) u
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_usuarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_usuarios() TO authenticated;

-- -------------------------------------------------------
-- Hook: crear registro en usuario al hacer signup en Supabase Auth
-- SECURITY DEFINER porque escribe desde auth.users → public.usuario
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO usuario(auth_user_id, nombre, apellido, correo, telefono)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'telefono'
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_on_auth_user_created();
