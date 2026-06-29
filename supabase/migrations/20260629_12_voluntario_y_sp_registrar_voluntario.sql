-- ============================================================
-- Tabla voluntario
-- ============================================================
CREATE TABLE IF NOT EXISTS voluntario (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id            uuid NOT NULL REFERENCES centro_acopio(id),
  nombres              varchar(100) NOT NULL,
  apellidos            varchar(100) NOT NULL,
  nacionalidad         char(1)      NOT NULL CHECK (nacionalidad IN ('V','E')),
  cedula_numero        varchar(20)  NOT NULL,
  fecha_nacimiento     date,
  telefono             varchar(20),
  telefono_emergencia  varchar(20),
  zona                 text,
  activo               boolean      NOT NULL DEFAULT true,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (centro_id, nacionalidad, cedula_numero)
);

-- Trigger updated_at
CREATE TRIGGER trg_updated_at_voluntario
  BEFORE UPDATE ON voluntario
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_updated_at();

-- RLS
ALTER TABLE voluntario ENABLE ROW LEVEL SECURITY;

-- Operadores solo ven voluntarios de sus centros activos
CREATE POLICY voluntario_select ON voluntario
  FOR SELECT TO authenticated
  USING (
    centro_id IN (
      SELECT uc.centro_id
      FROM usuario_centro uc
      JOIN usuario u ON u.id = uc.usuario_id
      WHERE u.auth_user_id = auth.uid() AND uc.activo = true
    )
  );

CREATE POLICY voluntario_insert ON voluntario
  FOR INSERT TO authenticated
  WITH CHECK (
    centro_id IN (
      SELECT uc.centro_id
      FROM usuario_centro uc
      JOIN usuario u ON u.id = uc.usuario_id
      WHERE u.auth_user_id = auth.uid() AND uc.activo = true
    )
  );

CREATE POLICY voluntario_update ON voluntario
  FOR UPDATE TO authenticated
  USING (
    centro_id IN (
      SELECT uc.centro_id
      FROM usuario_centro uc
      JOIN usuario u ON u.id = uc.usuario_id
      WHERE u.auth_user_id = auth.uid() AND uc.activo = true
    )
  );


-- ============================================================
-- SP sp_registrar_voluntario
-- Corrección respecto al original: recibe p_centro_id para
-- evitar selección no-determinista cuando el usuario pertenece
-- a múltiples centros activos.
-- ============================================================
CREATE OR REPLACE FUNCTION sp_registrar_voluntario(
  p_centro_id           uuid,
  p_nombres             text,
  p_apellidos           text,
  p_nacionalidad        char,
  p_cedula_numero       text,
  p_fecha_nacimiento    date    DEFAULT NULL,
  p_telefono            text    DEFAULT NULL,
  p_telefono_emergencia text    DEFAULT NULL,
  p_zona                text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_nuevo_id   uuid;
BEGIN
  -- Resolver usuario autenticado
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado');
  END IF;

  -- Verificar que el usuario pertenece al centro indicado
  IF NOT EXISTS (
    SELECT 1 FROM usuario_centro
    WHERE usuario_id = v_usuario_id
      AND centro_id  = p_centro_id
      AND activo     = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No estás asignado a ese centro');
  END IF;

  -- Validar nacionalidad
  IF p_nacionalidad NOT IN ('V', 'E') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nacionalidad debe ser V o E');
  END IF;

  -- Duplicado por cédula en el mismo centro
  IF EXISTS (
    SELECT 1 FROM voluntario
    WHERE centro_id      = p_centro_id
      AND nacionalidad   = p_nacionalidad
      AND cedula_numero  = p_cedula_numero
      AND activo         = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya existe un voluntario con esa cédula en este centro');
  END IF;

  INSERT INTO voluntario (
    centro_id, nombres, apellidos, nacionalidad, cedula_numero,
    fecha_nacimiento, telefono, telefono_emergencia, zona
  )
  VALUES (
    p_centro_id, p_nombres, p_apellidos, p_nacionalidad, p_cedula_numero,
    p_fecha_nacimiento, p_telefono, p_telefono_emergencia, p_zona
  )
  RETURNING id INTO v_nuevo_id;

  RETURN jsonb_build_object('ok', true, 'id', v_nuevo_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_voluntario(uuid,text,text,char,text,date,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_voluntario(uuid,text,text,char,text,date,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
