import { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}
export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-sifra-bg rounded-3xl flex items-center justify-center mb-4 border border-sifra-border">
        <Icon size={28} className="text-sifra-muted" />
      </div>
      <h3 className="text-lg font-bold text-sifra-navy mb-1">{title}</h3>
      {description && <p className="text-sm text-sifra-muted max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
