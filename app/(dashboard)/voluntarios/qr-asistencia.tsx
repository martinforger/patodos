'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type Props = {
  centroId: string
}

export function QrAsistencia({ centroId }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl(`${window.location.origin}/asistencia/${centroId}`)
  }, [centroId])

  async function copiarEnlace() {
    await navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        Ver QR de asistencia
      </button>

      {abierto && url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card border shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">QR de asistencia</h2>
              <button
                onClick={() => setAbierto(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Los voluntarios escanean este QR para registrar su asistencia del día.
            </p>

            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={url} size={200} />
            </div>

            <p className="text-xs text-muted-foreground text-center break-all">{url}</p>

            <div className="flex gap-2">
              <button
                onClick={copiarEnlace}
                className="flex-1 rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                {copiado ? '¡Copiado!' : 'Copiar enlace'}
              </button>
              <button
                onClick={() => setAbierto(false)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
