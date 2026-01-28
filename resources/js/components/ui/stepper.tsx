import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  label: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isUpcoming = stepNumber > currentStep

          return (
            <React.Fragment key={index}>
              {/* Step Item */}
              <div className="flex flex-col items-center flex-1 relative">
                {/* Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all z-10 border-2",
                    isCompleted && "bg-blue-600 border-blue-600 text-white",
                    isCurrent && "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100",
                    isUpcoming && "bg-background border-gray-300 text-gray-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Label */}
                <div className="mt-2 text-center max-w-[120px]">
                  <p
                    className={cn(
                      "text-xs font-medium whitespace-normal",
                      (isCompleted || isCurrent) && "text-blue-900 dark:text-blue-100",
                      isUpcoming && "text-gray-400"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 -mt-12 mx-2">
                  <div
                    className={cn(
                      "h-full transition-all",
                      stepNumber < currentStep ? "bg-blue-600" : "bg-gray-300"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
