import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFecha(fechaStr: string | null | undefined): string {
  if (!fechaStr) return '—'
  // Si es solo YYYY-MM-DD
  const match = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const [_, year, month, day] = match
    return `${day}/${month}/${year}`
  }
  // Si contiene hora o zona horaria
  try {
    const date = new Date(fechaStr)
    if (isNaN(date.getTime())) return '—'
    
    // Si contiene 'T', se parsea como UTC/ISO pero lo convertimos a la fecha local es-VE
    if (fechaStr.includes('T')) {
      return date.toLocaleDateString('es-VE')
    }
    
    // Fallback manual si es otro formato con guiones
    const parts = fechaStr.split('-')
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`
    }
    return date.toLocaleDateString('es-VE')
  } catch {
    return '—'
  }
}
