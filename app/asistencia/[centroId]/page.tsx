import { createClient } from '@/lib/supabase/server'
import { FormularioAsistencia } from './formulario-asistencia'

type Props = {
  params: Promise<{ centroId: string }>
}

export default async function AsistenciaPage({ params }: Props) {
  const { centroId } = await params
  const supabase = await createClient()

  const { data: centroRaw } = await supabase.rpc('sp_centro_nombre_publico', {
    p_centro_id: centroId,
  })

  const centro = centroRaw as { nombre: string } | null

  if (!centro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-3">
          <p className="text-4xl">❌</p>
          <h1 className="text-xl font-bold">QR inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este código QR no corresponde a un centro de acopio activo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ayuda Humanitaria · Venezuela
          </p>
          <h1 className="text-2xl font-bold">Registro de asistencia</h1>
          <p className="text-sm text-muted-foreground">{centro.nombre}</p>
        </div>

        <FormularioAsistencia centroId={centroId} />
      </div>
    </div>
  )
}
