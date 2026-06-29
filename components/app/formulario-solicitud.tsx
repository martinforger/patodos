'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { solicitudSchema, type SolicitudData } from '@/lib/validations/solicitudes'
import { personaSchema, type PersonaData } from '@/lib/validations/ingresos'
import { createClient } from '@/lib/supabase/client'

type Insumo = { id: string; nombre: string; categoria: string }
type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }

const inputCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'text-sm font-medium'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

async function buscarPersona(termino: string): Promise<Persona[]> {
  if (termino.length < 2) return []
  const supabase = createClient()
  const { data } = await supabase.rpc('sp_buscar_persona', { p_termino: termino })
  return (data as Persona[]) ?? []
}

type Props = {
  centroId: string
  categorias: Categoria[]
  insumos: Insumo[]
}

export function FormularioSolicitud({ centroId, categorias, insumos }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')

  const [busquedaSolicitante, setBusquedaSolicitante] = useState('')
  const [resultadosSolicitante, setResultadosSolicitante] = useState<Persona[]>([])
  const [solicitanteSeleccionado, setSolicitanteSeleccionado] = useState<Persona | null>(null)

  const router = useRouter()

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<SolicitudData>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      fecha: new Date().toISOString().slice(0, 10),
      solicitante_modo: 'existente',
    },
  })

  const {
    register: regSol, reset: resetSol, trigger: triggerSol,
    getValues: getValuesSol, formState: { errors: errorsSol },
  } = useForm<PersonaData>({ resolver: zodResolver(personaSchema) })

  const solicitanteModo = watch('solicitante_modo')

  const insumosFiltrados = categoriaSeleccionada
    ? insumos.filter((i) => i.categoria === categorias.find((c) => c.id === categoriaSeleccionada)?.nombre)
    : insumos

  async function crearPersona(data: PersonaData): Promise<string | null> {
    const supabase = createClient()
    const { data: res, error } = await supabase.rpc('sp_crear_persona', {
      p_nombre: data.nombre,
      p_apellido: data.apellido,
      p_telefono: data.telefono,
      p_cedula: data.cedula || undefined,
      p_correo: data.correo || undefined,
      p_observaciones: data.observaciones || undefined,
    })
    if (error) return null
    return (res as { id: string }).id
  }

  async function onSubmit(data: SolicitudData) {
    setError(null)
    const supabase = createClient()

    let solicitanteId: string | null = null
    if (data.solicitante_modo === 'existente') {
      if (!solicitanteSeleccionado) { setError('Seleccione un solicitante'); return }
      solicitanteId = solicitanteSeleccionado.id
    } else {
      const valid = await triggerSol()
      if (!valid) { setError('Complete los datos del solicitante'); return }
      const parsed = personaSchema.safeParse(getValuesSol())
      if (!parsed.success) { setError('Datos del solicitante inválidos'); return }
      solicitanteId = await crearPersona(parsed.data)
      if (!solicitanteId) { setError('Error al registrar el solicitante'); return }
    }

    const { error: rpcError } = await supabase.rpc('sp_registrar_solicitud', {
      p_centro_id: centroId,
      p_insumo_id: data.insumo_id,
      p_cantidad_solicitada: data.cantidad_solicitada,
      p_solicitante_id: solicitanteId ?? undefined,
      p_fecha: data.fecha,
      p_observaciones: data.observaciones || undefined,
    })

    if (rpcError) { setError(rpcError.message); return }

    cerrar()
    router.refresh()
  }

  function cerrar() {
    setAbierto(false)
    reset()
    resetSol()
    setSolicitanteSeleccionado(null)
    setBusquedaSolicitante('')
    setResultadosSolicitante([])
    setCategoriaSeleccionada('')
    setError(null)
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Registrar solicitud
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-lg p-6 my-4">
        <h2 className="text-lg font-semibold mb-4">Registrar solicitud de ayuda</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Categoría (filtro local) */}
          <Field label="Categoría de insumo">
            <select
              className={inputCls}
              value={categoriaSeleccionada}
              onChange={(e) => { setCategoriaSeleccionada(e.target.value); setValue('insumo_id', '') }}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Field>

          <Field label="Insumo solicitado *" error={errors.insumo_id?.message}>
            <select className={inputCls} {...register('insumo_id')}>
              <option value="">Seleccione un insumo…</option>
              {insumosFiltrados.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad *" error={errors.cantidad_solicitada?.message}>
              <input className={inputCls} type="number" step="0.01" min="0.01" {...register('cantidad_solicitada', { valueAsNumber: true })} />
            </Field>
            <Field label="Fecha *" error={errors.fecha?.message}>
              <input className={inputCls} type="date" {...register('fecha')} />
            </Field>
          </div>

          {/* Solicitante */}
          <div className="space-y-2">
            <label className={labelCls}>Solicitante *</label>
            <div className="flex gap-3">
              {(['existente', 'nuevo'] as const).map((modo) => (
                <label key={modo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" value={modo} {...register('solicitante_modo')} className="accent-primary" />
                  {modo === 'existente' ? 'Buscar existente' : 'Nueva persona'}
                </label>
              ))}
            </div>
          </div>

          {solicitanteModo === 'existente' && (
            <div className="space-y-2 rounded-md bg-muted/40 p-3">
              {solicitanteSeleccionado ? (
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{solicitanteSeleccionado.nombre} {solicitanteSeleccionado.apellido}</p>
                    <p className="text-xs text-muted-foreground">{solicitanteSeleccionado.telefono}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSolicitanteSeleccionado(null); setBusquedaSolicitante(''); setResultadosSolicitante([]) }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className={inputCls}
                    placeholder="Buscar por nombre, teléfono o cédula…"
                    value={busquedaSolicitante}
                    onChange={async (e) => {
                      setBusquedaSolicitante(e.target.value)
                      setResultadosSolicitante(await buscarPersona(e.target.value))
                    }}
                  />
                  {resultadosSolicitante.length > 0 && (
                    <ul className="divide-y rounded-md border bg-background text-sm max-h-40 overflow-y-auto">
                      {resultadosSolicitante.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => { setSolicitanteSeleccionado(p); setResultadosSolicitante([]) }}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50"
                          >
                            <span className="font-medium">{p.nombre} {p.apellido}</span>
                            <span className="ml-2 text-muted-foreground">{p.telefono}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {solicitanteModo === 'nuevo' && (
            <div className="space-y-3 rounded-md bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Datos del solicitante</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre *" error={errorsSol.nombre?.message}>
                  <input className={inputCls} {...regSol('nombre')} />
                </Field>
                <Field label="Apellido *" error={errorsSol.apellido?.message}>
                  <input className={inputCls} {...regSol('apellido')} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono *" error={errorsSol.telefono?.message}>
                  <input className={inputCls} type="tel" {...regSol('telefono')} />
                </Field>
                <Field label="Cédula (opcional)" error={errorsSol.cedula?.message}>
                  <input className={inputCls} {...regSol('cedula')} />
                </Field>
              </div>
            </div>
          )}

          <Field label="Observaciones (opcional)" error={errors.observaciones?.message}>
            <textarea className={inputCls} rows={2} {...register('observaciones')} />
          </Field>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrar} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando…' : 'Registrar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
