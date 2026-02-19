import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  label: string
  description?: string
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

          // When lastCompletedStep is provided, use it to drive state instead of currentStep
          const isCompleted = isFullyCompleted
            || (lastCompletedStep !== undefined ? stepNumber <= lastCompletedStep : stepNumber < currentStep)
          const isCurrent = lastCompletedStep === undefined && !isFullyCompleted && stepNumber === currentStep
          const isUpcoming = !isFullyCompleted && !isCompleted && !isCurrent

          return (
            <React.Fragment key={index}>
              {/* Step Item */}
              <div className="flex items-start gap-3 relative">
                {/* Circle and Connector Column */}
                <div className="flex flex-col items-center">
                  {/* Circle */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all z-10 border-2 shrink-0",
                      isFullyCompleted && "bg-green-600 border-green-600 text-white",
                      !isFullyCompleted && isCompleted && "bg-blue-600 border-blue-600 text-white",
                      !isFullyCompleted && isCurrent && "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100",
                      isUpcoming && "bg-background border-gray-300 text-gray-400"
                    )}
                  >
                    {(isCompleted || isFullyCompleted) ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      stepNumber
                    )}
                  </div>

                  {/* Vertical Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-16 mt-1">
                      <div
                        className={cn(
                          "w-full h-full transition-all",
                          isFullyCompleted
                            ? "bg-green-600"
                            : (isCompleted ? "bg-blue-600" : "bg-gray-300")
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className={cn("flex-1", index < steps.length - 1 ? "pb-8" : "")}>
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      isFullyCompleted && "text-green-900 dark:text-green-100",
                      !isFullyCompleted && (isCompleted || isCurrent) && "text-blue-900 dark:text-blue-100",
                      isUpcoming && "text-gray-400"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p
                      className={cn(
                        "text-xs mt-1 leading-tight",
                        isFullyCompleted && "text-green-700 dark:text-green-300",
                        !isFullyCompleted && (isCompleted || isCurrent) && "text-blue-700 dark:text-blue-300",
                        isUpcoming && "text-muted-foreground"
                      )}
                    >
                      {step.description}
                    </p>
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
