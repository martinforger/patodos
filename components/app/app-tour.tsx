'use client'

import { useEffect } from 'react'
import { Onborda, OnbordaProvider, useOnborda } from 'onborda'
import type { OnbordaProps } from 'onborda'
import { HelpCircle } from 'lucide-react'
import { TourCard } from './tour-card'

const storageKey = (userId: string) => `patodos_tour_v1_${userId}`

// Recorrido guiado que explica el flujo completo de la app.
// Cada paso apunta a un elemento del sidebar por su id (siempre montado),
// por lo que el tour no necesita navegar entre rutas.
const tours: OnbordaProps['steps'] = [
  {
    tour: 'principal',
    steps: [
      {
        icon: '👋',
        title: 'Bienvenido',
        content:
          'Este es el sistema de inventario de ayuda humanitaria. En un minuto te muestro cómo funciona el flujo completo.',
        selector: '#tour-brand',
        side: 'right-top',
        pointerPadding: 8,
        pointerRadius: 10,
      },
      {
        icon: '📊',
        title: 'Panel',
        content:
          'Tu resumen del día: ingresos, egresos y solicitudes recientes de tu centro de un vistazo.',
        selector: '#tour-panel',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '📦',
        title: 'Inventario',
        content:
          'El stock actual de cada insumo en tu centro. Se actualiza solo con cada ingreso o egreso: nunca se edita a mano.',
        selector: '#tour-inventario',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '⬇️',
        title: 'Ingresos',
        content:
          'Registra las donaciones que llegan. Puedes asociar un donante (buscándolo o creándolo en el momento) o marcarlo como anónimo. El stock sube automáticamente.',
        selector: '#tour-ingresos',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '⬆️',
        title: 'Egresos',
        content:
          'Registra los despachos hacia un destino, con la persona que recibe y uno o más responsables de la entrega. El sistema valida que haya stock suficiente antes de guardar.',
        selector: '#tour-egresos',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '📋',
        title: 'Solicitudes',
        content:
          'Pedidos de ayuda. Al registrar un egreso puedes vincularlo a una solicitud; su estado (pendiente → parcialmente atendida → completada) se calcula automáticamente.',
        selector: '#tour-solicitudes',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '🕘',
        title: 'Historial',
        content:
          'Todos los movimientos con filtros por fecha y tipo. Coordinadores y administradores pueden anular un movimiento indicando un motivo; el stock se revierte solo.',
        selector: '#tour-historial',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '📈',
        title: 'Reportes',
        content:
          'Resumen por insumo y detalle de movimientos por rango de fechas, exportable a CSV o PDF.',
        selector: '#tour-reportes',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '👥',
        title: 'Personas',
        content:
          'Registro único de personas: una misma persona puede ser donante, solicitante o contacto de entrega según el contexto. No hay que duplicarla.',
        selector: '#tour-personas',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '📍',
        title: 'Destinos',
        content:
          'Los lugares a donde se despacha la ayuda, con dirección y referencias para llegar.',
        selector: '#tour-destinos',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '👥',
        title: 'Equipo',
        content:
          'Los voluntarios y colaboradores de tu centro. Coordinadores pueden ver quién está asignado y con qué rol.',
        selector: '#tour-equipo',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '🛠️',
        title: 'Administración',
        content:
          'Solo para administradores: crea centros de acopio, asigna usuarios con su rol y consulta el panel multi-centro.',
        selector: '#tour-admin',
        side: 'right-top',
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: '🚀',
        title: '¡Listo para empezar!',
        content:
          'Primer paso recomendado: ve a Administración → Centros y completa los datos reales de tu centro. Puedes relanzar este tour cuando quieras con el botón de ayuda abajo a la derecha.',
        selector: '#tour-admin',
        side: 'right-top',
        pointerPadding: 8,
        pointerRadius: 10,
      },
    ],
  },
]

function LanzadorTour({ userId }: { userId: string }) {
  const { startOnborda, isOnbordaVisible } = useOnborda()
  const key = storageKey(userId)

  // Auto-arranque la primera vez por usuario en este navegador.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    const t = setTimeout(() => startOnborda('principal'), 700)
    return () => clearTimeout(t)
  }, [startOnborda, key])

  if (isOnbordaVisible) return null

  return (
    <button
      type="button"
      onClick={() => startOnborda('principal')}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-lg transition-colors hover:bg-muted"
      aria-label="Iniciar recorrido guiado"
    >
      <HelpCircle className="h-4 w-4" />
      Tour
    </button>
  )
}

export function AppTour({ children, userId }: { children: React.ReactNode; userId: string }) {
  return (
    <OnbordaProvider>
      <Onborda
        steps={tours}
        cardComponent={TourCard}
        shadowRgb="15,23,42"
        shadowOpacity="0.6"
      >
        {children}
        <LanzadorTour userId={userId} />
      </Onborda>
    </OnbordaProvider>
  )
}
