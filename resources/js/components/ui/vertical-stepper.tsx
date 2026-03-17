import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  label: string
  description?: string
  extra?: React.ReactNode
}

interface VerticalStepperProps {
  steps: Step[]
  currentStep: number
  isFullyCompleted?: boolean
  /** If set, marks steps 1–lastCompletedStep as done (checkmark) and remaining as upcoming (gray). No "current" ring shown. */
  lastCompletedStep?: number
  className?: string
}

export function VerticalStepper({ steps, currentStep, isFullyCompleted = false, lastCompletedStep, className }: VerticalStepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col space-y-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1

          const isCompleted = isFullyCompleted
            || (lastCompletedStep !== undefined ? stepNumber <= lastCompletedStep : stepNumber < currentStep)
          const isCurrent = lastCompletedStep === undefined && !isFullyCompleted && stepNumber === currentStep
          const isUpcoming = !isFullyCompleted && !isCompleted && !isCurrent

          return (
            <React.Fragment key={index}>
              <div className="flex items-start gap-3 relative">
                {/* Circle and Connector Column */}
                <div className="flex flex-col items-center">
                  <div className={cn("relative shrink-0 z-10", isCurrent && "")}>
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-foreground/20 animate-ping" />
                    )}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm transition-all border-2",
                        (isCompleted || isFullyCompleted) && "bg-foreground border-foreground text-background",
                        isCurrent && "bg-foreground border-foreground text-background",
                        isUpcoming && "bg-background border-border text-muted-foreground"
                      )}
                    >
                      {(isCompleted || isFullyCompleted) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        stepNumber
                      )}
                    </div>
                  </div>

                  {/* Vertical Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="w-px h-14 mt-1">
                      <div
                        className={cn(
                          "w-full h-full transition-all",
                          (isCompleted || isFullyCompleted) ? "bg-foreground" : "bg-border"
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className={cn("flex-1 pt-1.5", index < steps.length - 1 ? "pb-6" : "")}>
                  <p
                    className={cn(
                      "text-sm font-medium leading-tight",
                      (isCompleted || isFullyCompleted || isCurrent) && "text-foreground",
                      isUpcoming && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p
                      className={cn(
                        "text-xs mt-0.5 leading-tight text-muted-foreground"
                      )}
                    >
                      {step.description}
                    </p>
                  )}
                  {step.extra && (
                    <div className="mt-1.5">{step.extra}</div>
                  )}
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
