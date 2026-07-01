'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatFecha } from '@/lib/utils'
import { inputCls } from '@/components/app/form'
import { IntegrantesEditor } from '@/components/app/integrantes-editor'
import type { IntegranteData } from '@/lib/validations/familias'

export type FilaFamilia = {
  id: string
  nombre_familia: string
  observaciones: string | null
  representante_id: string
  representante: string
  representante_telefono: string | null
  total_integrantes: number
  bebes: number
  menores: number
  adultos: number
}

type IntegranteDetalle = {
  id: string
  nombre: string
  parentesco: string | null
  fecha_nacimiento: string | null
  es_menor: boolean
  es_bebe: boolean
}

type DetalleFamilia = {
  id: string
  nombre_familia: string
  observaciones: string | null
  representante: string
  representante_telefono: string | null
  integrantes: IntegranteDetalle[]
}

type Entrega = {
  id: string
  fecha_movimiento: string
  cantidad: number
  afecta_inventario: boolean
  insumo: string
  recibido_por: string
}

type Props = { familia: FilaFamilia; centroId: string }

export function DetalleFamiliaDialog({ familia, centroId }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [detalle, setDetalle] = useState<DetalleFamilia | null>(null)
  const [entregas, setEntregas] = useState<Entrega[] | null>(null)
  const [vista, setVista] = useState<'datos' | 'entregas'>('datos')
  const [editando, setEditando] = useState(false)
  const [nombreEdit, setNombreEdit] = useState('')
  const [obsEdit, setObsEdit] = useState('')
  const [integrantesEdit, setIntegrantesEdit] = useState<IntegranteData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const router = useRouter()

  async function abrir() {
    setAbierto(true)
    setVista('datos')
    setEditando(false)
    const supabase = createClient()
    const { data } = await supabase.rpc('sp_detalle_grupo_familiar', { p_grupo_id: familia.id })
    setDetalle(data as unknown as DetalleFamilia)
  }

  async function cargarEntregas() {
    setVista('entregas')
    if (entregas) return
    const supabase = createClient()
    const { data } = await supabase.rpc('sp_historial_entregas_familia', {
      p_grupo_familiar_id: familia.id, p_centro_id: centroId,
    })
    setEntregas((data as unknown as Entrega[]) ?? [])
  }

  function iniciarEdicion() {
    if (!detalle) return
    setNombreEdit(detalle.nombre_familia)
    setObsEdit(detalle.observaciones ?? '')
    setIntegrantesEdit(detalle.integrantes.map(i => ({
      nombre: i.nombre,
      parentesco: i.parentesco ?? '',
      fecha_nacimiento: i.fecha_nacimiento ?? '',
      es_menor: i.es_menor,
      es_bebe: i.es_bebe,
    })))
    setEditando(true)
    setError(null)
  }

  async function guardar() {
    setError(null)
    if (!nombreEdit.trim()) { setError('El nombre de la familia es obligatorio'); return }
    setGuardando(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('sp_editar_grupo_familiar', {
      p_grupo_id: familia.id,
      p_nombre_familia: nombreEdit,
      p_observaciones: obsEdit || undefined,
      p_integrantes: integrantesEdit.filter(it => it.nombre.trim()),
    })
    setGuardando(false)
    if (rpcError) { setError(rpcError.message); return }
    setEditando(false)
    setAbierto(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={abrir} className="text-sm text-primary hover:underline">
        Ver / editar
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{familia.nombre_familia}</DialogTitle>
          </DialogHeader>

          {/* Pestañas */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setVista('datos')}
              className={`px-3 py-1.5 text-sm border-b-2 ${vista === 'datos' ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
            >
              Datos
            </button>
            <button
              onClick={cargarEntregas}
              className={`px-3 py-1.5 text-sm border-b-2 ${vista === 'entregas' ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
            >
              Entregas del grupo
            </button>
          </div>

          {vista === 'datos' && (
            <div className="space-y-3">
              {!detalle && <p className="text-sm text-muted-foreground">Cargando…</p>}

              {detalle && !editando && (
                <>
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs">Representante</p>
                    <p className="font-medium">{detalle.representante}</p>
                    {detalle.representante_telefono && (
                      <p className="text-xs text-muted-foreground">{detalle.representante_telefono}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Integrantes ({detalle.integrantes.length})
                    </p>
                    {detalle.integrantes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin integrantes registrados.</p>
                    ) : (
                      <ul className="space-y-1">
                        {detalle.integrantes.map(i => (
                          <li key={i.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                            <span className="font-medium">{i.nombre}</span>
                            {i.parentesco && <span className="text-muted-foreground">· {i.parentesco}</span>}
                            {i.es_bebe && <span className="ml-auto rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-300">Bebé</span>}
                            {i.es_menor && !i.es_bebe && <span className="ml-auto rounded bg-blue-100 dark:bg-blue-950/40 px-1.5 py-0.5 text-xs text-blue-800 dark:text-blue-300">Menor</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {detalle.observaciones && (
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Observaciones</p>
                      <p>{detalle.observaciones}</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button onClick={iniciarEdicion} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
                      Editar
                    </button>
                  </div>
                </>
              )}

              {detalle && editando && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Nombre de la familia *</label>
                    <input className={inputCls} value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} />
                  </div>

                  <IntegrantesEditor
                    integrantes={integrantesEdit}
                    onChange={(i, patch) => setIntegrantesEdit(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))}
                    onAdd={() => setIntegrantesEdit(prev => [...prev, { nombre: '', parentesco: '', fecha_nacimiento: '', es_menor: false, es_bebe: false }])}
                    onRemove={(i) => setIntegrantesEdit(prev => prev.filter((_, idx) => idx !== i))}
                  />

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Observaciones</label>
                    <textarea className={inputCls} rows={2} value={obsEdit} onChange={(e) => setObsEdit(e.target.value)} />
                  </div>

                  {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setEditando(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
                      Cancelar
                    </button>
                    <button
                      onClick={guardar}
                      disabled={guardando}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {guardando ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {vista === 'entregas' && (
            <div className="space-y-2">
              {entregas === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
              {entregas && entregas.length === 0 && (
                <p className="text-sm text-muted-foreground">Este grupo aún no ha recibido entregas.</p>
              )}
              {entregas && entregas.length > 0 && (
                <ul className="divide-y rounded-md border text-sm">
                  {entregas.map(e => (
                    <li key={e.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="font-medium">{e.insumo}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFecha(e.fecha_movimiento)} · recibió {e.recibido_por}
                          {!e.afecta_inventario && ' · no afectó inventario'}
                        </p>
                      </div>
                      <span className="font-medium">{e.cantidad.toLocaleString('es-VE')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
