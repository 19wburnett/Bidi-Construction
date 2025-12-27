import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!open || !mounted) return null

  const dialogContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => onOpenChange(false)}
        style={{ pointerEvents: 'auto' }}
      />
      <div className="relative z-[100000] w-full flex items-center justify-center p-2 sm:p-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )

  // Use portal to render dialog at document.body level to avoid z-index/overflow issues
  return createPortal(dialogContent, document.body)
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white dark:bg-gray-900 shadow-2xl rounded-lg w-full max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 ${className}`} {...props} />
)

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", ...props }, ref) => (
  <h2
    ref={ref}
    className={`text-lg font-semibold leading-none tracking-tight ${className}`}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => (
  <p ref={ref} className={`text-sm text-gray-500 ${className}`} {...props} />
))
DialogDescription.displayName = "DialogDescription"

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className = "", ...props }, ref) => (
  <button
    ref={ref}
    className={`absolute right-2 sm:right-4 top-2 sm:top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none touch-target p-2 ${className}`}
    {...props}
  >
    <X className="h-5 w-5 sm:h-4 sm:w-4" />
    <span className="sr-only">Close</span>
  </button>
))
DialogClose.displayName = "DialogClose"

const DialogFooter = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter }

