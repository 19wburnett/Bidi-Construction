import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-orange focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200",
        secondary:
          "border-transparent bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-600",
        outline: "text-black dark:text-white border-gray-300 dark:border-gray-600",
        orange: "border-transparent bg-orange text-white hover:bg-orange/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
