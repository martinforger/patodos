'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type Props = {
  categorias: string[]
  categoriaActual?: string
}

export function FiltroCategoria({ categorias, categoriaActual }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function seleccionar(cat: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (cat) {
      params.set('categoria', cat)
    } else {
      params.delete('categoria')
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => seleccionar(undefined)}
        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
          !categoriaActual
            ? 'bg-foreground text-background border-foreground'
            : 'border-border hover:bg-muted'
        }`}
      >
        Todos
      </button>
      {categorias.map((cat) => (
        <button
          key={cat}
          onClick={() => seleccionar(cat)}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            categoriaActual === cat
              ? 'bg-foreground text-background border-foreground'
              : 'border-border hover:bg-muted'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
