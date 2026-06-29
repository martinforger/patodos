'use client'

type FilaMovimiento = {
  tipo: 'ingreso' | 'egreso'
  cantidad: number
  fecha_movimiento: string
  insumo: string
  unidad_medida: string
  categoria: string
  registrado_por: string
  destino: string | null
  donante: string | null
  observaciones: string | null
}

type Props = {
  movimientos: FilaMovimiento[]
  centro: string
  fechaDesde: string | null
  fechaHasta: string | null
}

export function ExportarReporte({ movimientos, centro, fechaDesde, fechaHasta }: Props) {
  function descargarCSV() {
    const encabezado = ['Fecha', 'Tipo', 'Categoría', 'Insumo', 'Cantidad', 'Unidad', 'Destino/Donante', 'Registrado por', 'Observaciones']
    const filas = movimientos.map((m) => [
      m.fecha_movimiento,
      m.tipo,
      m.categoria,
      m.insumo,
      m.cantidad.toString().replace('.', ','),
      m.unidad_medida,
      m.tipo === 'egreso' ? (m.destino ?? '') : (m.donante ?? 'Anónimo'),
      m.registrado_por,
      m.observaciones ?? '',
    ])

    const csv = [encabezado, ...filas]
      .map((fila) => fila.map((celda) => `"${celda.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const periodo = fechaDesde && fechaHasta ? `_${fechaDesde}_${fechaHasta}` : ''
    link.href     = url
    link.download = `reporte_${centro.replace(/\s+/g, '_')}${periodo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button
        onClick={descargarCSV}
        className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
      >
        Exportar CSV
      </button>
      <button
        onClick={() => window.print()}
        className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
      >
        Imprimir / PDF
      </button>
    </div>
  )
}
