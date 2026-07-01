-- ============================================================
-- Módulo Voluntarios — campos UCAB
-- Elimina fecha_nacimiento y zona; agrega turno, laptop,
-- vehículo, vínculo UCAB y carrera. Recrea SPs afectados.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Eliminar columnas obsoletas
-- ──────────────────────────────────────────────────────────────
ALTER TABLE voluntario DROP COLUMN IF EXISTS fecha_nacimiento;
ALTER TABLE voluntario DROP COLUMN IF EXISTS zona;

-- ──────────────────────────────────────────────────────────────
-- 2. Agregar columnas nuevas
-- ──────────────────────────────────────────────────────────────
ALTER TABLE voluntario
  ADD COLUMN IF NOT EXISTS turno text
    CHECK (turno IN ('completo', 'manana', 'tarde'));

ALTER TABLE voluntario
  ADD COLUMN IF NOT EXISTS tiene_laptop boolean NOT NULL DEFAULT false;

ALTER TABLE voluntario
  ADD COLUMN IF NOT EXISTS tiene_vehiculo boolean NOT NULL DEFAULT false;

ALTER TABLE voluntario
  ADD COLUMN IF NOT EXISTS vinculo_ucab text
    CHECK (vinculo_ucab IN ('estudiante', 'egresado', 'profesor_empleado', 'externo'));

ALTER TABLE voluntario
  ADD COLUMN IF NOT EXISTS carrera text;

-- ──────────────────────────────────────────────────────────────
-- 3. Recrear sp_registrar_voluntario con la nueva firma
-- ──────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS sp_registrar_voluntario(uuid,text,text,char,text,date,text,text,text);

CREATE OR REPLACE FUNCTION sp_registrar_voluntario(
  p_centro_id           uuid,
  p_nombres             text,
  p_apellidos           text,
  p_nacionalidad        char,
  p_cedula_numero       text,
  p_telefono            text    DEFAULT NULL,
  p_telefono_emergencia text    DEFAULT NULL,
  p_turno               text    DEFAULT NULL,
  p_tiene_laptop        boolean DEFAULT false,
  p_tiene_vehiculo      boolean DEFAULT false,
  p_vinculo_ucab        text    DEFAULT NULL,
  p_carrera             text    DEFAULT NULL
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
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM usuario_centro
    WHERE usuario_id = v_usuario_id
      AND centro_id  = p_centro_id
      AND activo     = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No estás asignado a ese centro');
  END IF;

  IF p_nacionalidad NOT IN ('V', 'E') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nacionalidad debe ser V o E');
  END IF;

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
    telefono, telefono_emergencia,
    turno, tiene_laptop, tiene_vehiculo, vinculo_ucab, carrera
  )
  VALUES (
    p_centro_id, p_nombres, p_apellidos, p_nacionalidad, p_cedula_numero,
    p_telefono, p_telefono_emergencia,
    p_turno, p_tiene_laptop, p_tiene_vehiculo, p_vinculo_ucab, p_carrera
  )
  RETURNING id INTO v_nuevo_id;

  RETURN jsonb_build_object('ok', true, 'id', v_nuevo_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_voluntario(uuid,text,text,char,text,text,text,text,boolean,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_voluntario(uuid,text,text,char,text,text,text,text,boolean,boolean,text,text) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 4. Actualizar sp_listar_voluntarios — incluir campos nuevos
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
      'id',              v.id,
      'nombres',         v.nombres,
      'apellidos',       v.apellidos,
      'nacionalidad',    v.nacionalidad,
      'cedula_numero',   v.cedula_numero,
      'telefono',        v.telefono,
      'activo',          v.activo,
      'turno',           v.turno,
      'tiene_laptop',    v.tiene_laptop,
      'tiene_vehiculo',  v.tiene_vehiculo,
      'vinculo_ucab',    v.vinculo_ucab,
      'carrera',         v.carrera,
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
                'comio', COALESCE(
                  (SELECT cv.comio FROM comida_voluntario cv
                   WHERE cv.asistencia_id = a.id AND cv.numero_comida = n.num),
                  false
                ),
                'marcado', EXISTS (
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

NOTIFY pgrst, 'reload schema';
