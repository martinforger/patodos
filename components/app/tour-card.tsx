'use client'

import type { CardComponentProps } from 'onborda'
import { useOnborda } from 'onborda'

export function TourCard({ step, currentStep, totalSteps, nextStep, prevStep, arrow }: CardComponentProps) {
  const { closeOnborda } = useOnborda()
  const esPrimero = currentStep === 0
  const esUltimo = currentStep + 1 >= totalSteps

  return (
    <div className="relative w-80 shrink-0 rounded-xl border bg-card p-5 text-card-foreground shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {step.icon && <span className="text-xl leading-none">{step.icon}</span>}
          <h3 className="text-base font-semibold">{step.title}</h3>
        </div>
        <button
          type="button"
          onClick={() => closeOnborda()}
          aria-label="Cerrar tour"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.content}</div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs tabular-nums text-muted-foreground">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="flex gap-2">
          {!esPrimero && (
            <button
              type="button"
              onClick={() => prevStep()}
              className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              Atrás
            </button>
          )}
          {esUltimo ? (
            <button
              type="button"
              onClick={() => closeOnborda()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Finalizar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => nextStep()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>

      <span className="text-card">{arrow}</span>
    </div>
  )
}
