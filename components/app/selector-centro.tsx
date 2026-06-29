'use client'

import { Building2, ChevronDown } from 'lucide-react'
import { cambiarCentro } from '@/lib/actions/centro'
import type { CentroResumen } from '@/lib/supabase/perfil'

interface SelectorCentroProps {
  centros: CentroResumen[]
  centroActivo: string
}

const ETIQUETAS_ROL: Record<string, string> = {
  administrador_sistema: 'Admin',
  coordinador_centro: 'Coordinador',
  operador_inventario: 'Operador',
}

export function SelectorCentro({ centros, centroActivo }: SelectorCentroProps) {
  if (centros.length <= 1) return null

  const actual = centros.find((c) => c.centro_id === centroActivo) ?? centros[0]

  return (
    <div className="px-3 py-2.5">
      {/* Etiqueta */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80 mb-1.5 flex items-center gap-1">
        <Building2 className="h-3 w-3" />
        Centro activo
      </p>

      {/* Selector visual */}
      <form action={cambiarCentro}>
        <div className="relative">
          <select
            name="centro_id"
            defaultValue={centroActivo}
            onChange={(e) => {
              const form = e.currentTarget.form
              if (form) form.requestSubmit()
            }}
            className={[
              'w-full appearance-none rounded-lg px-3 py-2 pr-8',
              'text-sm font-bold text-white',
              'bg-gradient-to-r from-amber-500 to-orange-500',
              'border-2 border-amber-400/60',
              'shadow-[0_0_12px_rgba(251,191,36,0.35)]',
              'cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300',
              'transition-all duration-200',
              'hover:shadow-[0_0_18px_rgba(251,191,36,0.5)] hover:border-amber-300',
            ].join(' ')}
            aria-label="Seleccionar centro activo"
          >
            {centros.map((c) => (
              <option
                key={c.centro_id}
                value={c.centro_id}
                className="bg-gray-900 text-white font-normal"
              >
                {c.centro} · {ETIQUETAS_ROL[c.rol] ?? c.rol}
              </option>
            ))}
          </select>

          {/* Ícono flecha */}
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70" />
        </div>

        {/* Indicador del rol en el centro activo */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
            {ETIQUETAS_ROL[actual.rol] ?? actual.rol}
          </span>
        </div>
      </form>
    </div>
  )
}

/** Badge pequeño para el header de páginas: muestra el nombre del centro activo */
export function CentroActivoBadge({ centro }: { centro: string }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
        'bg-gradient-to-r from-amber-500/15 to-orange-500/15',
        'border border-amber-500/30',
        'text-xs font-semibold text-amber-600 dark:text-amber-400',
      ].join(' ')}
    >
      <Building2 className="h-3 w-3 shrink-0" />
      {centro}
    </span>
  )
}
