'use client'

import { useState, useTransition } from 'react'
import { Building2, ChevronDown, Check } from 'lucide-react'
import { cambiarCentro } from '@/lib/actions/centro'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { CentroResumen } from '@/lib/supabase/perfil'

interface SelectorCentroDropdownProps {
  centros: CentroResumen[]
  centroActivo: string
  centroNombre: string
}

export function SelectorCentroDropdown({
  centros,
  centroActivo,
  centroNombre,
}: SelectorCentroDropdownProps) {
  const [isPending, startTransition] = useTransition()

  // Si el usuario solo tiene un centro de acopio asignado,
  // mostramos una insignia estática no cliqueable.
  if (centros.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border bg-muted text-xs font-semibold text-muted-foreground select-none">
        <Building2 className="h-3 w-3 shrink-0" />
        {centroNombre}
      </span>
    )
  }

  const handleSelect = (centroId: string) => {
    if (centroId === centroActivo || isPending) return
    startTransition(async () => {
      const formData = new FormData()
      formData.append('centro_id', centroId)
      try {
        await cambiarCentro(formData)
      } catch (e) {
        console.error('Error al cambiar de centro:', e)
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className={[
            'h-7 rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1.5',
            'bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20',
            'border-amber-500/30 text-amber-700 dark:text-amber-400',
            'transition-all duration-200 cursor-pointer shadow-sm',
            isPending ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          <Building2 className="h-3 w-3 shrink-0" />
          <span>{centroNombre}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b mb-1">
          Cambiar Centro de Acopio
        </div>
        {centros.map((c) => (
          <DropdownMenuItem
            key={c.centro_id}
            onClick={() => handleSelect(c.centro_id)}
            className="flex items-center justify-between cursor-pointer font-medium text-xs py-2 px-3 hover:bg-accent rounded-sm"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">{c.centro}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                {c.rol === 'administrador_sistema' ? 'Administrador' : c.rol === 'coordinador_centro' ? 'Coordinador' : 'Operador'}
              </span>
            </div>
            {c.centro_id === centroActivo && (
              <Check className="h-4 w-4 text-amber-500 shrink-0 ml-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
