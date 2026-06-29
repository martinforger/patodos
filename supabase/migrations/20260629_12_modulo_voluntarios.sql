-- ============================================================
-- Migración 12 · Módulo de Voluntarios
-- ------------------------------------------------------------
-- Tablas: voluntario, asistencia_voluntario, comida_voluntario
-- RLS: scopeado por centro (fn_centros_del_usuario)
-- SPs autenticados: sp_registrar_voluntario, sp_listar_voluntarios, sp_marcar_comida
-- SPs públicos (SECURITY DEFINER, grant a anon):
--   sp_centro_nombre_publico, sp_registrar_asistencia_voluntario
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- TABLAS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voluntario (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id           uuid NOT NULL REFERENCES centro_acopio(id),
  nombres             varchar(150) NOT NULL,
  apellidos           varchar(150) NOT NULL,
  nacionalidad        char(1) NOT NULL CHECK (nacionalidad IN ('V', 'E')),
  cedula_numero       varchar(20) NOT NULL,
  fecha_nacimiento    date,
  telefono            varchar(20) NOT NULL,
  telefono_emergencia varchar(20),
  zona                varchar(150),
  activo              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_voluntario_cedula UNIQUE (centro_id, nacionalidad, cedula_numero)
);

CREATE TABLE IF NOT EXISTS asistencia_voluntario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voluntario_id  uuid NOT NULL REFERENCES voluntario(id),
  centro_id      uuid NOT NULL REFERENCES centro_acopio(id),
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  hora_checkin   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_asistencia_dia UNIQUE (voluntario_id, fecha)
);

CREATE TABLE IF NOT EXISTS comida_voluntario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asistencia_id  uuid NOT NULL REFERENCES asistencia_voluntario(id),
  numero_comida  smallint NOT NULL CHECK (numero_comida BETWEEN 1 AND 3),
  comio          boolean NOT NULL DEFAULT true,
  marcado_por    uuid REFERENCES usuario(id),
  marcado_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_comida_asistencia UNIQUE (asistencia_id, numero_comida)
);

-- ──────────────────────────────────────────────────────────────
-- ÍNDICES
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_voluntario_centro    ON voluntario (centro_id);
CREATE INDEX IF NOT EXISTS idx_voluntario_cedula    ON voluntario (nacionalidad, cedula_numero);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha     ON asistencia_voluntario (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencia_voluntario ON asistencia_voluntario (voluntario_id);
CREATE INDEX IF NOT EXISTS idx_comida_asistencia    ON comida_voluntario (asistencia_id);

-- ──────────────────────────────────────────────────────────────
-- TRIGGERS updated_at
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER trg_updated_at_voluntario
  BEFORE UPDATE ON voluntario
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_updated_at();

CREATE TRIGGER trg_updated_at_comida_voluntario
  BEFORE UPDATE ON comida_voluntario
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_updated_at();

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE voluntario          ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_voluntario ENABLE ROW LEVEL SECURITY;
ALTER TABLE comida_voluntario   ENABLE ROW LEVEL SECURITY;

-- voluntario
CREATE POLICY voluntario_select ON voluntario FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY voluntario_insert ON voluntario FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY voluntario_update ON voluntario FOR UPDATE TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin())
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- asistencia_voluntario
CREATE POLICY asistencia_select ON asistencia_voluntario FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- Las inserciones de asistencia pública entran por SP SECURITY DEFINER (no por esta política).
-- Esta política cubre a operadores autenticados que pudieran consultar.
CREATE POLICY asistencia_insert ON asistencia_voluntario FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- comida_voluntario (scopeado vía join a asistencia → centro)
CREATE POLICY comida_select ON comida_voluntario FOR SELECT TO authenticated
  USING (
    asistencia_id IN (
      SELECT id FROM asistencia_voluntario
      WHERE centro_id IN (SELECT fn_centros_del_usuario())
    )
    OR fn_es_admin()
  );

CREATE POLICY comida_insert ON comida_voluntario FOR INSERT TO authenticated
  WITH CHECK (
    asistencia_id IN (
      SELECT id FROM asistencia_voluntario
      WHERE centro_id IN (SELECT fn_centros_del_usuario())
    )
    OR fn_es_admin()
  );

CREATE POLICY comida_update ON comida_voluntario FOR UPDATE TO authenticated
  USING (
    asistencia_id IN (
      SELECT id FROM asistencia_voluntario
      WHERE centro_id IN (SELECT fn_centros_del_usuario())
    )
    OR fn_es_admin()
  )
  WITH CHECK (
    asistencia_id IN (
      SELECT id FROM asistencia_voluntario
      WHERE centro_id IN (SELECT fn_centros_del_usuario())
    )
    OR fn_es_admin()
  );

-- ──────────────────────────────────────────────────────────────
-- SP: sp_registrar_voluntario
-- Autenticado. Resuelve centro_id del caller.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_registrar_voluntario(
  p_nombres             text,
  p_apellidos           text,
  p_nacionalidad        text,
  p_cedula_numero       text,
  p_fecha_nacimiento    date DEFAULT NULL,
  p_telefono            text DEFAULT NULL,
  p_telefono_emergencia text DEFAULT NULL,
  p_zona                text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_centro_id uuid;
  v_usuario_id uuid;
  v_nuevo_id   uuid;
BEGIN
  -- Resolver usuario y centro del caller
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado');
  END IF;

  SELECT uc.centro_id INTO v_centro_id
  FROM usuario_centro uc
  WHERE uc.usuario_id = v_usuario_id AND uc.activo = true
  LIMIT 1;

  IF v_centro_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No estás asignado a ningún centro');
  END IF;

  -- Validar que la cédula no exista ya en este centro
  IF EXISTS (
    SELECT 1 FROM voluntario
    WHERE centro_id = v_centro_id
      AND nacionalidad = p_nacionalidad
      AND cedula_numero = p_cedula_numero
      AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya existe un voluntario con esa cédula en este centro');
  END IF;

  INSERT INTO voluntario (
    centro_id, nombres, apellidos, nacionalidad, cedula_numero,
    fecha_nacimiento, telefono, telefono_emergencia, zona
  )
  VALUES (
    v_centro_id, p_nombres, p_apellidos, p_nacionalidad, p_cedula_numero,
    p_fecha_nacimiento, p_telefono, p_telefono_emergencia, p_zona
  )
  RETURNING id INTO v_nuevo_id;

  RETURN jsonb_build_object('ok', true, 'id', v_nuevo_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_voluntario(text,text,text,text,date,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_voluntario(text,text,text,text,date,text,text,text) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- SP: sp_listar_voluntarios
-- Retorna voluntarios del centro con asistencia de hoy y comidas.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_listar_voluntarios(
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',           v.id,
      'nombres',      v.nombres,
      'apellidos',    v.apellidos,
      'nacionalidad', v.nacionalidad,
      'cedula_numero',v.cedula_numero,
      'telefono',     v.telefono,
      'zona',         v.zona,
      'activo',       v.activo,
      'asistencia_hoy', CASE
        WHEN a.id IS NOT NULL THEN jsonb_build_object(
          'id',           a.id,
          'hora_checkin', a.hora_checkin,
          'comidas', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'numero',         n.num,
                'elegible_desde', a.hora_checkin + ((n.num - 1) * interval '4 hours'),
                'elegible',       now() >= a.hora_checkin + ((n.num - 1) * interval '4 hours'),
                'comio',          COALESCE(
                  (SELECT cv.comio FROM comida_voluntario cv
                   WHERE cv.asistencia_id = a.id AND cv.numero_comida = n.num),
                  false
                ),
                'marcado',        EXISTS (
                  SELECT 1 FROM comida_voluntario cv
                  WHERE cv.asistencia_id = a.id AND cv.numero_comida = n.num
                )
              ) ORDER BY n.num
            )
            FROM (SELECT generate_series(1,3) AS num) n
          )
        )
        ELSE NULL
      END
    ) ORDER BY v.apellidos, v.nombres
  )
  INTO v_resultado
  FROM voluntario v
  LEFT JOIN asistencia_voluntario a
    ON a.voluntario_id = v.id AND a.fecha = CURRENT_DATE
  WHERE v.centro_id = p_centro_id
    AND v.activo = true;

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_voluntarios(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_voluntarios(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- SP: sp_marcar_comida
-- Upsert en comida_voluntario. Revalida elegibilidad.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_marcar_comida(
  p_asistencia_id  uuid,
  p_numero_comida  integer,
  p_comio          boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hora_checkin timestamptz;
  v_elegible_desde timestamptz;
  v_usuario_id uuid;
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado');
  END IF;

  SELECT hora_checkin INTO v_hora_checkin
  FROM asistencia_voluntario WHERE id = p_asistencia_id;

  IF v_hora_checkin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Asistencia no encontrada');
  END IF;

  v_elegible_desde := v_hora_checkin + ((p_numero_comida - 1) * interval '4 hours');

  IF now() < v_elegible_desde THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Aún no es elegible para esta comida',
      'elegible_desde', v_elegible_desde
    );
  END IF;

  INSERT INTO comida_voluntario (asistencia_id, numero_comida, comio, marcado_por, marcado_at)
  VALUES (p_asistencia_id, p_numero_comida, p_comio, v_usuario_id, now())
  ON CONFLICT (asistencia_id, numero_comida)
  DO UPDATE SET
    comio      = EXCLUDED.comio,
    marcado_por = EXCLUDED.marcado_por,
    marcado_at  = EXCLUDED.marcado_at;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_marcar_comida(uuid, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_marcar_comida(uuid, integer, boolean) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- SP: sp_centro_nombre_publico (PÚBLICO)
-- Retorna solo el nombre del centro para validar el QR.
-- SECURITY DEFINER justificado: endpoint público sin login.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_centro_nombre_publico(
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
BEGIN
  SELECT nombre INTO v_nombre
  FROM centro_acopio
  WHERE id = p_centro_id AND activo = true;

  IF v_nombre IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('nombre', v_nombre);
END;
$$;

REVOKE ALL ON FUNCTION sp_centro_nombre_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_centro_nombre_publico(uuid) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- SP: sp_registrar_asistencia_voluntario (PÚBLICO)
-- Página QR: busca voluntario por cédula y graba asistencia.
-- SECURITY DEFINER justificado: endpoint público sin login.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_registrar_asistencia_voluntario(
  p_centro_id    uuid,
  p_nacionalidad text,
  p_cedula_numero text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voluntario_id uuid;
  v_nombre_completo text;
  v_hora timestamptz;
  v_existia boolean := false;
BEGIN
  SELECT id, nombres || ' ' || apellidos
  INTO v_voluntario_id, v_nombre_completo
  FROM voluntario
  WHERE centro_id    = p_centro_id
    AND nacionalidad  = p_nacionalidad
    AND cedula_numero = p_cedula_numero
    AND activo        = true;

  IF v_voluntario_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'estado', 'no_encontrado');
  END IF;

  -- Verificar si ya hay asistencia hoy
  IF EXISTS (
    SELECT 1 FROM asistencia_voluntario
    WHERE voluntario_id = v_voluntario_id AND fecha = CURRENT_DATE
  ) THEN
    SELECT hora_checkin INTO v_hora
    FROM asistencia_voluntario
    WHERE voluntario_id = v_voluntario_id AND fecha = CURRENT_DATE;

    RETURN jsonb_build_object(
      'ok',     true,
      'estado', 'ya_registrado',
      'nombre', v_nombre_completo,
      'hora',   v_hora
    );
  END IF;

  -- Registrar asistencia
  INSERT INTO asistencia_voluntario (voluntario_id, centro_id, fecha, hora_checkin)
  VALUES (v_voluntario_id, p_centro_id, CURRENT_DATE, now())
  RETURNING hora_checkin INTO v_hora;

  RETURN jsonb_build_object(
    'ok',     true,
    'estado', 'registrado',
    'nombre', v_nombre_completo,
    'hora',   v_hora
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_asistencia_voluntario(uuid, char, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_asistencia_voluntario(uuid, char, text) TO anon, authenticated;
