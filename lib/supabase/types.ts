export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categoria_insumo: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      centro_acopio: {
        Row: {
          activo: boolean
          correo: string | null
          created_at: string
          direccion: string
          estado_geo: string
          id: string
          municipio: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          correo?: string | null
          created_at?: string
          direccion: string
          estado_geo: string
          id?: string
          municipio: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          correo?: string | null
          created_at?: string
          direccion?: string
          estado_geo?: string
          id?: string
          municipio?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      asistencia_voluntario: {
        Row: {
          centro_id: string
          created_at: string
          fecha: string
          hora_checkin: string
          id: string
          voluntario_id: string
        }
        Insert: {
          centro_id: string
          created_at?: string
          fecha?: string
          hora_checkin?: string
          id?: string
          voluntario_id: string
        }
        Update: {
          centro_id?: string
          created_at?: string
          fecha?: string
          hora_checkin?: string
          id?: string
          voluntario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_voluntario_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro_acopio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_voluntario_voluntario_id_fkey"
            columns: ["voluntario_id"]
            isOneToOne: false
            referencedRelation: "voluntario"
            referencedColumns: ["id"]
          },
        ]
      }
      comida_voluntario: {
        Row: {
          asistencia_id: string
          comio: boolean
          id: string
          marcado_at: string
          marcado_por: string | null
          numero_comida: number
          updated_at: string
        }
        Insert: {
          asistencia_id: string
          comio?: boolean
          id?: string
          marcado_at?: string
          marcado_por?: string | null
          numero_comida: number
          updated_at?: string
        }
        Update: {
          asistencia_id?: string
          comio?: boolean
          id?: string
          marcado_at?: string
          marcado_por?: string | null
          numero_comida?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comida_voluntario_asistencia_id_fkey"
            columns: ["asistencia_id"]
            isOneToOne: false
            referencedRelation: "asistencia_voluntario"
            referencedColumns: ["id"]
          },
        ]
      }
      destino: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string
          estado_geo: string
          id: string
          municipio: string
          nombre: string
          referencia: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion: string
          estado_geo: string
          id?: string
          municipio: string
          nombre: string
          referencia?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string
          estado_geo?: string
          id?: string
          municipio?: string
          nombre?: string
          referencia?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      detalle_egreso: {
        Row: {
          destino_id: string
          id: string
          movimiento_id: string
          persona_contacto_id: string
        }
        Insert: {
          destino_id: string
          id?: string
          movimiento_id: string
          persona_contacto_id: string
        }
        Update: {
          destino_id?: string
          id?: string
          movimiento_id?: string
          persona_contacto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_egreso_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "destino"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_egreso_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: true
            referencedRelation: "movimiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_egreso_persona_contacto_id_fkey"
            columns: ["persona_contacto_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
        ]
      }
      detalle_ingreso: {
        Row: {
          donante_anonimo: boolean
          donante_id: string | null
          id: string
          movimiento_id: string
        }
        Insert: {
          donante_anonimo?: boolean
          donante_id?: string | null
          id?: string
          movimiento_id: string
        }
        Update: {
          donante_anonimo?: boolean
          donante_id?: string | null
          id?: string
          movimiento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_ingreso_donante_id_fkey"
            columns: ["donante_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ingreso_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: true
            referencedRelation: "movimiento"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo: {
        Row: {
          activo: boolean
          categoria_id: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_insumo"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_centro: {
        Row: {
          centro_id: string
          id: string
          insumo_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          centro_id: string
          id?: string
          insumo_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          centro_id?: string
          id?: string
          insumo_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_centro_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro_acopio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_centro_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento: {
        Row: {
          anulado: boolean
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          cantidad: number
          centro_id: string
          created_at: string
          fecha_movimiento: string
          id: string
          insumo_id: string
          observaciones: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Insert: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          cantidad: number
          centro_id: string
          created_at?: string
          fecha_movimiento?: string
          id?: string
          insumo_id: string
          observaciones?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string
        }
        Update: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          cantidad?: number
          centro_id?: string
          created_at?: string
          fecha_movimiento?: string
          id?: string
          insumo_id?: string
          observaciones?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro_acopio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      persona: {
        Row: {
          apellido: string
          cedula: string | null
          correo: string | null
          created_at: string
          id: string
          nombre: string
          observaciones: string | null
          telefono: string
          updated_at: string
        }
        Insert: {
          apellido: string
          cedula?: string | null
          correo?: string | null
          created_at?: string
          id?: string
          nombre: string
          observaciones?: string | null
          telefono: string
          updated_at?: string
        }
        Update: {
          apellido?: string
          cedula?: string | null
          correo?: string | null
          created_at?: string
          id?: string
          nombre?: string
          observaciones?: string | null
          telefono?: string
          updated_at?: string
        }
        Relationships: []
      }
      responsable_entrega: {
        Row: {
          apellido: string | null
          created_at: string
          detalle_egreso_id: string
          id: string
          nombre: string | null
          persona_id: string | null
          telefono: string | null
        }
        Insert: {
          apellido?: string | null
          created_at?: string
          detalle_egreso_id: string
          id?: string
          nombre?: string | null
          persona_id?: string | null
          telefono?: string | null
        }
        Update: {
          apellido?: string | null
          created_at?: string
          detalle_egreso_id?: string
          id?: string
          nombre?: string | null
          persona_id?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responsable_entrega_detalle_egreso_id_fkey"
            columns: ["detalle_egreso_id"]
            isOneToOne: false
            referencedRelation: "detalle_egreso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsable_entrega_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud: {
        Row: {
          cantidad_solicitada: number
          centro_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_solicitud"]
          estado_entrega: Database["public"]["Enums"]["estado_entrega"]
          fecha_solicitud: string
          id: string
          insumo_id: string
          observaciones: string | null
          solicitante_id: string
          updated_at: string
          usuario_registro_id: string
        }
        Insert: {
          cantidad_solicitada: number
          centro_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          estado_entrega?: Database["public"]["Enums"]["estado_entrega"]
          fecha_solicitud?: string
          id?: string
          insumo_id: string
          observaciones?: string | null
          solicitante_id: string
          updated_at?: string
          usuario_registro_id: string
        }
        Update: {
          cantidad_solicitada?: number
          centro_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          estado_entrega?: Database["public"]["Enums"]["estado_entrega"]
          fecha_solicitud?: string
          id?: string
          insumo_id?: string
          observaciones?: string | null
          solicitante_id?: string
          updated_at?: string
          usuario_registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro_acopio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_usuario_registro_id_fkey"
            columns: ["usuario_registro_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud_movimiento: {
        Row: {
          created_at: string
          id: string
          movimiento_id: string
          solicitud_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movimiento_id: string
          solicitud_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movimiento_id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_movimiento_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_movimiento_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitud"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario: {
        Row: {
          activo: boolean
          apellido: string
          auth_user_id: string | null
          correo: string
          created_at: string
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellido: string
          auth_user_id?: string | null
          correo: string
          created_at?: string
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellido?: string
          auth_user_id?: string | null
          correo?: string
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      usuario_centro: {
        Row: {
          activo: boolean
          centro_id: string
          created_at: string
          id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          activo?: boolean
          centro_id: string
          created_at?: string
          id?: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          activo?: boolean
          centro_id?: string
          created_at?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_centro_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro_acopio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_centro_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      voluntario: {
        Row: {
          activo: boolean
          apellidos: string
          cedula_numero: string
          centro_id: string
          created_at: string
          fecha_nacimiento: string | null
          id: string
          nacionalidad: string
          nombres: string
          telefono: string
          telefono_emergencia: string | null
          updated_at: string
          zona: string | null
        }
        Insert: {
          activo?: boolean
          apellidos: string
          cedula_numero: string
          centro_id: string
          created_at?: string
          fecha_nacimiento?: string | null
          id?: string
          nacionalidad: string
          nombres: string
          telefono: string
          telefono_emergencia?: string | null
          updated_at?: string
          zona?: string | null
        }
        Update: {
          activo?: boolean
          apellidos?: string
          cedula_numero?: string
          centro_id?: string
          created_at?: string
          fecha_nacimiento?: string | null
          id?: string
          nacionalidad?: string
          nombres?: string
          telefono?: string
          telefono_emergencia?: string | null
          updated_at?: string
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voluntario_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centro_acopio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      sp_centro_nombre_publico: {
        Args: { p_centro_id: string }
        Returns: Json
      }
      sp_listar_voluntarios: {
        Args: { p_centro_id: string }
        Returns: Json
      }
      sp_marcar_comida: {
        Args: { p_asistencia_id: string; p_numero_comida: number; p_comio: boolean }
        Returns: Json
      }
      sp_registrar_asistencia_voluntario: {
        Args: { p_centro_id: string; p_nacionalidad: string; p_cedula_numero: string }
        Returns: Json
      }
      sp_registrar_voluntario: {
        Args: {
          p_nombres: string
          p_apellidos: string
          p_nacionalidad: string
          p_cedula_numero: string
          p_fecha_nacimiento?: string
          p_telefono?: string
          p_telefono_emergencia?: string
          p_zona?: string
        }
        Returns: Json
      }
      fn_centros_del_usuario: { Args: never; Returns: string[] }
      fn_es_admin: { Args: never; Returns: boolean }
      fn_es_coordinador: { Args: { p_centro_id: string }; Returns: boolean }
      sp_actualizar_estado_entrega: {
        Args: {
          p_estado_entrega: string
          p_observaciones?: string
          p_solicitud_id: string
        }
        Returns: Json
      }
      sp_anular_movimiento: {
        Args: { p_motivo: string; p_movimiento_id: string }
        Returns: Json
      }
      sp_asignar_usuario_centro: {
        Args: {
          p_centro_id: string
          p_rol: Database["public"]["Enums"]["rol_usuario"]
          p_usuario_id: string
        }
        Returns: Json
      }
      sp_bootstrap_inicial: {
        Args: {
          p_centro_nombre: string
          p_direccion: string
          p_estado_geo: string
          p_municipio: string
        }
        Returns: Json
      }
      sp_buscar_persona: { Args: { p_termino: string }; Returns: Json }
      sp_cancelar_solicitud: {
        Args: { p_motivo?: string; p_solicitud_id: string }
        Returns: Json
      }
      sp_crear_centro_acopio: {
        Args: {
          p_correo?: string
          p_direccion: string
          p_estado_geo: string
          p_municipio: string
          p_nombre: string
          p_telefono?: string
        }
        Returns: Json
      }
      sp_crear_destino: {
        Args: {
          p_direccion: string
          p_estado_geo: string
          p_municipio: string
          p_nombre: string
          p_referencia?: string
        }
        Returns: Json
      }
      sp_crear_insumo: {
        Args: { p_categoria_id: string; p_nombre: string }
        Returns: Json
      }
      sp_crear_persona: {
        Args: {
          p_apellido: string
          p_cedula?: string
          p_correo?: string
          p_nombre: string
          p_observaciones?: string
          p_telefono: string
        }
        Returns: Json
      }
      sp_historial_movimientos: {
        Args: {
          p_centro_id: string
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_pagina?: number
          p_por_pagina?: number
          p_tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Returns: Json
      }
      sp_inventario_centro: { Args: { p_centro_id: string }; Returns: Json }
      sp_invitar_usuario_centro: {
        Args: {
          p_centro_id: string
          p_correo: string
          p_rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Returns: Json
      }
      sp_listar_categorias_insumos: { Args: never; Returns: Json }
      sp_listar_centros: { Args: never; Returns: Json }
      sp_listar_destinos: { Args: never; Returns: Json }
      sp_listar_egresos: {
        Args: { p_centro_id: string; p_pagina?: number; p_por_pagina?: number }
        Returns: Json
      }
      sp_listar_equipo: { Args: { p_centro_id: string }; Returns: Json }
      sp_listar_ingresos: {
        Args: { p_centro_id: string; p_pagina?: number; p_por_pagina?: number }
        Returns: Json
      }
      sp_listar_insumos: { Args: { p_categoria_id?: string }; Returns: Json }
      sp_listar_solicitudes: {
        Args: {
          p_centro_id: string
          p_estado?: string
          p_pagina?: number
          p_por_pagina?: number
        }
        Returns: Json
      }
      sp_listar_solicitudes_pendientes: {
        Args: { p_centro_id: string; p_insumo_id?: string }
        Returns: Json
      }
      sp_listar_usuarios: { Args: never; Returns: Json }
      sp_listar_usuarios_centros: { Args: never; Returns: Json }
      sp_mi_perfil: { Args: never; Returns: Json }
      sp_mis_centros_coordinados: { Args: never; Returns: Json }
      sp_registrar_centro_acopio: {
        Args: {
          p_correo?: string
          p_direccion: string
          p_estado_geo: string
          p_municipio: string
          p_nombre: string
          p_telefono?: string
        }
        Returns: Json
      }
      sp_registrar_egreso: {
        Args: {
          p_cantidad: number
          p_centro_id: string
          p_destino_id: string
          p_fecha: string
          p_insumo_id: string
          p_observaciones?: string
          p_persona_contacto_id?: string
          p_responsables?: Json
        }
        Returns: Json
      }
      sp_registrar_egreso_multiple: {
        Args: {
          p_centro_id: string
          p_destino_id: string
          p_fecha: string
          p_items?: Json
          p_observaciones?: string
          p_persona_contacto_id?: string
          p_responsables?: Json
        }
        Returns: Json
      }
      sp_registrar_ingreso: {
        Args: {
          p_cantidad: number
          p_centro_id: string
          p_donante_anonimo?: boolean
          p_donante_id?: string
          p_fecha: string
          p_insumo_id: string
          p_observaciones?: string
        }
        Returns: Json
      }
      sp_registrar_solicitud: {
        Args: {
          p_cantidad_solicitada: number
          p_centro_id: string
          p_fecha?: string
          p_insumo_id: string
          p_observaciones?: string
          p_solicitante_id: string
        }
        Returns: Json
      }
      sp_reporte_centro: {
        Args: {
          p_centro_id: string
          p_fecha_desde?: string
          p_fecha_hasta?: string
        }
        Returns: Json
      }
      sp_resumen_panel: { Args: never; Returns: Json }
      sp_vincular_solicitud_egreso: {
        Args: { p_movimiento_id: string; p_solicitud_id: string }
        Returns: Json
      }
    }
    Enums: {
      estado_entrega: "pendiente" | "embalado" | "enviado" | "entregado"
      estado_solicitud:
        | "pendiente"
        | "parcialmente_atendida"
        | "completada"
        | "cancelada"
      rol_usuario:
        | "administrador_sistema"
        | "coordinador_centro"
        | "operador_inventario"
      tipo_movimiento: "ingreso" | "egreso"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_entrega: ["pendiente", "embalado", "enviado", "entregado"],
      estado_solicitud: [
        "pendiente",
        "parcialmente_atendida",
        "completada",
        "cancelada",
      ],
      rol_usuario: [
        "administrador_sistema",
        "coordinador_centro",
        "operador_inventario",
      ],
      tipo_movimiento: ["ingreso", "egreso"],
    },
  },
} as const
