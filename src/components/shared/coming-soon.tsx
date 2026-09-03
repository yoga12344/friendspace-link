import { Clock } from 'lucide-react'

interface ComingSoonProps {
  feature: string
  phase: string
  description?: string
}

export function ComingSoon({ feature, phase, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center">
      <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-4">
        <Clock className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{feature}</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        {description ?? 'This feature is being built and will be available soon.'}
      </p>
      <span className="mt-4 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        Coming in {phase}
      </span>
    </div>
  )
}
