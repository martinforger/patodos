'use client'

import { inputCls } from '@/components/app/form'
import type { IntegranteData } from '@/lib/validations/familias'

type Props = {
  integrantes: IntegranteData[]
  onChange: (index: number, patch: Partial<IntegranteData>) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

/**
 * Editor de integrantes ligeros de una familia (nombre + parentesco +
 * fecha de nacimiento + marcas menor/bebé). Reutilizado al crear y editar.
 */
export function IntegrantesEditor({ integrantes, onChange, onAdd, onRemove }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Integrantes{' '}
        <span className="font-normal text-muted-foreground">(sin contar al representante)</span>
      </p>

      {integrantes.map((it, idx) => (
        <div key={idx} className="space-y-2 rounded-md bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputCls}
              placeholder="Nombre *"
              value={it.nombre}
              onChange={(e) => onChange(idx, { nombre: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Parentesco (ej. hijo)"
              value={it.parentesco ?? ''}
              onChange={(e) => onChange(idx, { parentesco: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Nacimiento
              <input
                className={`${inputCls} w-auto`}
                type="date"
                value={it.fecha_nacimiento ?? ''}
                onChange={(e) => onChange(idx, { fecha_nacimiento: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={it.es_menor}
                onChange={(e) => onChange(idx, { es_menor: e.target.checked })}
              />
              Menor de edad
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={it.es_bebe}
                onChange={(e) =>
                  onChange(idx, { es_bebe: e.target.checked, es_menor: e.target.checked ? true : it.es_menor })
                }
              />
              Bebé
            </label>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="ml-auto text-xs text-destructive hover:underline"
            >
              Quitar
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
      >
        + Agregar integrante
      </button>
    </div>
  )
}

export const integranteVacio: IntegranteData = {
  nombre: '',
  parentesco: '',
  fecha_nacimiento: '',
  es_menor: false,
  es_bebe: false,
}
