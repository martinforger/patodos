'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, Filter, X } from 'lucide-react'

interface FiltrosEgresosProps {
  defaultDesde?: string
  defaultHasta?: string
}

export function FiltrosEgresos({ defaultDesde = '', defaultHasta = '' }: FiltrosEgresosProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [desde, setDesde] = useState(defaultDesde)
  const [hasta, setHasta] = useState(defaultHasta)

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (desde) params.set('desde', desde)
    else params.delete('desde')
    
    if (hasta) params.set('hasta', hasta)
    else params.delete('hasta')
    
    params.set('pagina', '1') // Volver a la primera página al filtrar

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleLimpiar = () => {
    setDesde('')
    setHasta('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('desde')
    params.delete('hasta')
    params.delete('pagina')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="desde" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 select-none">
          <Calendar className="h-3.5 w-3.5 text-amber-500" />
          Desde
        </label>
        <input
          id="desde"
          type="date"
          name="desde"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 w-full sm:w-[165px] text-foreground cursor-pointer hover:border-accent-foreground/35"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="hasta" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 select-none">
          <Calendar className="h-3.5 w-3.5 text-amber-500" />
          Hasta
        </label>
        <input
          id="hasta"
          type="date"
          name="hasta"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 w-full sm:w-[165px] text-foreground cursor-pointer hover:border-accent-foreground/35"
        />
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        <Button type="submit" size="sm" disabled={isPending} className="flex-1 sm:flex-initial gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:from-amber-600 hover:to-orange-600 shadow-sm border-none disabled:opacity-50">
          <Filter className="h-3.5 w-3.5" />
          {isPending ? 'Filtrando...' : 'Filtrar'}
        </Button>
        {(defaultDesde || defaultHasta) && (
          <Button type="button" variant="outline" size="sm" onClick={handleLimpiar} disabled={isPending} className="flex-1 sm:flex-initial gap-1.5 cursor-pointer hover:bg-muted/50">
            <X className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        )}
      </div>
    </form>
  )
}
