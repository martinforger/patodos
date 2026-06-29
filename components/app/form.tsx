'use client'

import React, { useId } from 'react'

export const inputCls =
  'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

/**
 * Envuelve un campo de formulario con etiqueta accesible y mensaje de error.
 * Inyecta automáticamente el id en el primer elemento nativo (input/select/textarea)
 * para que el htmlFor de la etiqueta funcione correctamente.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  const uid = useId()
  const arr = React.Children.toArray(children)
  const first = arr[0]

  const enhanced =
    React.isValidElement<{ id?: string }>(first) &&
    typeof first.type === 'string' &&
    ['input', 'select', 'textarea'].includes(first.type)
      ? React.cloneElement(first, { id: uid })
      : first

  return (
    <div className="space-y-1">
      <label htmlFor={uid} className="text-sm font-medium">
        {label}
      </label>
      {enhanced}
      {arr.slice(1)}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function LeyendaObligatoria() {
  return (
    <p className="text-right text-xs text-muted-foreground">* Campos obligatorios</p>
  )
}
