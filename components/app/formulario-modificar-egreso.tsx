'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Field, LeyendaObligatoria, inputCls } from '@/components/app/form'
import { BuscadorPersonaInline } from '@/components/app/buscador-persona-inline'
import { BuscadorFamiliaInline, type Familia } from '@/components/app/buscador-familia-inline'
import { BuscadorDestinoInline, type Destino } from '@/components/app/buscador-destino-inline'
import { type Insumo } from '@/components/app/buscador-insumo-inline'
import { FilaInsumoEgreso, type ItemEgreso } from '@/components/app/fila-insumo-egreso'
import { Button } from '@/components/ui/button'

type Categoria = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string; telefono: string; cedula: string | null }
type Responsable = { persona_id: string | null; nombre: string; apellido: string; telefono: string }

type Props = {
  originalId: string      // lote_id o movimiento_id original
  esLote: boolean
  centroId: string
  categorias: Categoria[]
  insumos: Insumo[]
  inventario: { insumo_id: string; insumo: string; stock: number }[]
  onClose: () => void
}

type PayloadEdicion = {
  fecha: string
  destino: Destino
  contacto: Persona
  grupo_familiar: Familia | null
  observaciones: string | null
  afecta_inventario: boolean
  items: { insumo_id: string; cantidad: number; solicitud_id: string | null }[]
  responsables: Responsable[]
}

export function FormularioModificarEgreso({
  originalId,
  esLote,
  centroId,
  categorias,
  insumos,
  inventario,
  onClose,
}: Props) {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estados del Formulario
  const [fecha, setFecha] = useState('')
  const [afectaInventario, setAfectaInventario] = useState(true)
  const [observaciones, setObservaciones] = useState('')
  const [destinoSeleccionado, setDestinoSeleccionado] = useState<Destino | null>(null)
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Persona | null>(null)
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState<Familia | null>(null)
  const [items, setItems] = useState<ItemEgreso[]>([])
  const [responsables, setResponsables] = useState<Responsable[]>([])

  // Responsables manuales
  const [respManual, setRespManual] = useState({ nombre: '', apellido: '', telefono: '' })
  const [busquedaResp, setBusquedaResp] = useState('')
  const [resultadosResp, setResultadosResp] = useState<Persona[]>([])
  const [buscandoResp, setBuscandoResp] = useState(false)

  const stockMap = Object.fromEntries(inventario.map(i => [i.insumo_id, i.stock]))

  // Cargar datos originales del egreso
  useEffect(() => {
    async function cargarDetalles() {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('sp_detalle_egreso_edicion', {
        p_id: originalId,
        p_es_lote: esLote,
      })

      if (error) {
        setError(error.message)
        setCargando(false)
        return
      }

      const payload = data as PayloadEdicion
      setFecha(payload.fecha)
      setAfectaInventario(payload.afecta_inventario)
      setObservaciones(payload.observaciones ?? '')
      setDestinoSeleccionado(payload.destino)
      setContactoSeleccionado(payload.contacto)
      
      if (payload.grupo_familiar) {
        setFamiliaSeleccionada(payload.grupo_familiar)
      }

      setItems(payload.items.map(it => ({
        insumo_id: it.insumo_id,
        cantidad: it.cantidad,
        solicitud_id: it.solicitud_id ?? '',
      })))

      setResponsables(payload.responsables.map(r => ({
        persona_id: r.persona_id,
        nombre: r.nombre,
        apellido: r.apellido ?? '',
        telefono: r.telefono,
      })))

      setCargando(false)
    }

    cargarDetalles()
  }, [originalId, esLote])

  // Debounce para búsqueda de responsables
  useEffect(() => {
    let cancelado = false
    const timer = setTimeout(async () => {
      if (busquedaResp.length < 2) { setResultadosResp([]); setBuscandoResp(false); return }
      setBuscandoResp(true)
      const supabase = createClient()
      const { data } = await supabase.rpc('sp_buscar_persona', { p_termino: busquedaResp, p_centro_id: centroId })
      if (!cancelado) {
        setResultadosResp((data as Persona[]) ?? [])
        setBuscandoResp(false)
      }
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [busquedaResp, centroId])

  // Helpers de items
  function actualizarItem(index: number, patch: Partial<ItemEgreso>) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  function agregarItem() {
    setItems(prev => [...prev, { insumo_id: '', cantidad: '', solicitud_id: '' }])
  }
  function quitarItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Helpers de responsables
  function agregarResponsablePersona(p: Persona) {
    setResponsables(prev => [...prev, { persona_id: p.id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono }])
    setBusquedaResp('')
    setResultadosResp([])
  }
  function agregarResponsableManual() {
    if (!respManual.nombre.trim() || !respManual.telefono.trim()) {
      setError('El responsable manual requiere nombre y teléfono')
      return
    }
    setResponsables(prev => [...prev, { persona_id: null, ...respManual }])
    setRespManual({ nombre: '', apellido: '', telefono: '' })
    setError(null)
  }
  function quitarResponsable(idx: number) {
    setResponsables(prev => prev.filter((_, i) => i !== idx))
  }

  function seleccionarFamilia(f: Familia) {
    setFamiliaSeleccionada(f)
    setContactoSeleccionado({
      id: f.representante_id,
      nombre: f.representante_nombre,
      apellido: f.representante_apellido,
      telefono: f.representante_telefono ?? '',
      cedula: f.representante_cedula,
    })
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validaciones básicas
    const itemsValidos = items.filter(it => it.insumo_id && it.cantidad !== '' && Number(it.cantidad) > 0)
    if (itemsValidos.length === 0) {
      setError('Agregue al menos un insumo con cantidad mayor a cero.')
      return
    }
    if (new Set(itemsValidos.map(it => it.insumo_id)).size !== itemsValidos.length) {
      setError('Hay insumos repetidos. Use un solo renglón por insumo.')
      return
    }
    if (!destinoSeleccionado) {
      setError('Seleccione un destino')
      return
    }
    if (!contactoSeleccionado) {
      setError('Seleccione la persona de contacto que recibe')
      return
    }

    setGuardando(true)

    const supabase = createClient()
    const itemsPayload = itemsValidos.map(it => ({
      insumo_id: it.insumo_id,
      cantidad: Number(it.cantidad),
      solicitud_id: it.solicitud_id || undefined,
    }))

    const { error: rpcError } = await supabase.rpc('sp_modificar_egreso', {
      p_id: originalId,
      p_es_lote: esLote,
      p_items: itemsPayload,
      p_destino_id: destinoSeleccionado.id,
      p_contacto_id: contactoSeleccionado.id,
      p_responsables: responsables,
      p_fecha: fecha,
      p_observaciones: observaciones || undefined,
      p_afecta_inventario: afectaInventario,
      p_grupo_familiar_id: familiaSeleccionada?.id ?? undefined,
    })

    setGuardando(false)

    if (rpcError) {
      if (/stock|inventario|insuficiente|cantidad/i.test(rpcError.message)) {
        setError('No hay stock suficiente de uno o más insumos para registrar esta modificación.')
      } else {
        setError(rpcError.message)
      }
      return
    }

    onClose()
    router.refresh()
  }

  if (cargando) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Cargando datos del egreso...</p>
  }

  return (
    <form onSubmit={handleEnviar} className="space-y-4 pt-2">
      <LeyendaObligatoria />

      {/* No afecta inventario */}
      <label className="flex items-center gap-2 text-sm cursor-pointer rounded-md border bg-muted/30 px-3 py-2">
        <input
          type="checkbox"
          checked={!afectaInventario}
          onChange={(e) => setAfectaInventario(!e.target.checked)}
          className="accent-primary"
        />
        Este egreso no afecta el inventario (no descuenta ni valida stock)
      </label>

      {/* Insumos a despachar */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Insumos a despachar *</p>
        {items.map((it, idx) => (
          <FilaInsumoEgreso
            key={idx}
            item={it}
            index={idx}
            centroId={centroId}
            categorias={categorias}
            insumos={insumos}
            solicitudesPendientes={[]}
            stockMap={stockMap}
            mostrarStock={afectaInventario}
            onChange={actualizarItem}
            onRemove={quitarItem}
            removable={items.length > 1}
          />
        ))}
        <button
          type="button"
          onClick={agregarItem}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          + Agregar insumo
        </button>
      </div>

      {/* Fecha */}
      <Field label="Fecha *">
        <input className={inputCls} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </Field>

      {/* Destino */}
      <div className="space-y-1">
        <p className="text-sm font-medium">Destino *</p>
        <BuscadorDestinoInline
          centroId={centroId}
          seleccionado={destinoSeleccionado}
          onSelect={(d) => setDestinoSeleccionado(d)}
          onCambiar={() => setDestinoSeleccionado(null)}
          mensajeSinResultados='Sin resultados.'
        />
      </div>

      {/* Grupo familiar (opcional) */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Grupo familiar <span className="font-normal text-muted-foreground">(opcional)</span>
        </p>
        <div className="rounded-md bg-muted/40 p-3">
          <BuscadorFamiliaInline
            centroId={centroId}
            seleccionada={familiaSeleccionada}
            onSelect={seleccionarFamilia}
            onCambiar={() => setFamiliaSeleccionada(null)}
          />
          {familiaSeleccionada && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              El representante quedó como persona de contacto que recibe.
            </p>
          )}
        </div>
      </div>

      {/* Persona contacto */}
      <div className="space-y-1">
        <p className="text-sm font-medium">Persona contacto (recibe) *</p>
        <BuscadorPersonaInline
          centroId={centroId}
          seleccionado={contactoSeleccionado}
          onSelect={(p) => setContactoSeleccionado(p)}
          onCambiar={() => setContactoSeleccionado(null)}
          mensajeSinResultados='Sin resultados.'
        />
      </div>

      {/* Responsables de entrega */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Responsables de entrega <span className="font-normal text-muted-foreground">(opcional)</span>
        </p>

        {responsables.length > 0 && (
          <ul className="space-y-1">
            {responsables.map((r, idx) => (
              <li key={idx} className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm">
                <span>
                  {r.nombre} {r.apellido}
                  <span className="ml-2 text-muted-foreground">{r.telefono}</span>
                  {r.persona_id && (
                    <span className="ml-2 text-xs text-muted-foreground">(registrado)</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => quitarResponsable(idx)}
                  className="text-xs text-destructive hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-md bg-muted/40 p-3">
          <div className="space-y-1.5">
            <input
              className={inputCls}
              placeholder="Buscar responsable registrado…"
              value={busquedaResp}
              onChange={(e) => setBusquedaResp(e.target.value)}
              autoComplete="off"
            />
            {buscandoResp && <p className="text-xs text-muted-foreground">Buscando…</p>}
            {!buscandoResp && resultadosResp.length > 0 && (
              <ul className="divide-y rounded-md border bg-background text-sm max-h-32 overflow-y-auto">
                {resultadosResp.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => agregarResponsablePersona(p)}
                      className="w-full px-3 py-2 text-left hover:bg-muted/50"
                    >
                      <span className="font-medium">{p.nombre} {p.apellido}</span>
                      <span className="ml-2 text-muted-foreground">{p.telefono}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">O ingrese uno manualmente:</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              className={inputCls}
              placeholder="Nombre *"
              value={respManual.nombre}
              onChange={(e) => setRespManual(s => ({ ...s, nombre: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Apellido"
              value={respManual.apellido}
              onChange={(e) => setRespManual(s => ({ ...s, apellido: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Teléfono *"
              value={respManual.telefono}
              onChange={(e) => setRespManual(s => ({ ...s, telefono: e.target.value }))}
            />
          </div>
          <button
            type="button"
            onClick={agregarResponsableManual}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            + Agregar responsable
          </button>
        </div>
      </div>

      {/* Observaciones */}
      <Field label="Observaciones (opcional)">
        <textarea className={inputCls} rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </Field>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive font-medium">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Modificar Egreso'}
        </Button>
      </div>
    </form>
  )
}
