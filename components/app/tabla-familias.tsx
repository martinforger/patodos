'use client'

import { DetalleFamiliaDialog, type FilaFamilia } from '@/components/app/detalle-familia-dialog'

export function TablaFamilias({ filas, centroId }: { filas: FilaFamilia[]; centroId: string }) {
  if (filas.length === 0) {
    return (
      <p className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
        No hay grupos familiares registrados en este centro.
      </p>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Familia</th>
            <th className="px-4 py-3 text-left font-medium">Representante</th>
            <th className="px-4 py-3 text-left font-medium">Composición</th>
            <th className="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f) => (
            <tr key={f.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">{f.nombre_familia}</td>
              <td className="px-4 py-3">
                <span>{f.representante}</span>
                {f.representante_telefono && (
                  <span className="ml-2 text-xs text-muted-foreground">{f.representante_telefono}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded bg-muted px-1.5 py-0.5">{f.adultos} adultos</span>
                  {f.menores > 0 && (
                    <span className="rounded bg-blue-100 dark:bg-blue-950/40 px-1.5 py-0.5 text-blue-800 dark:text-blue-300">
                      {f.menores} menores
                    </span>
                  )}
                  {f.bebes > 0 && (
                    <span className="rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-amber-800 dark:text-amber-300">
                      {f.bebes} bebés
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <DetalleFamiliaDialog familia={f} centroId={centroId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
