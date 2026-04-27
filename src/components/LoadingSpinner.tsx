import clsx from 'clsx'
interface Props { size?: 'sm'|'md'|'lg'; className?: string; fullPage?: boolean }
export default function LoadingSpinner({ size = 'md', className, fullPage }: Props) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-7 h-7 border-2', lg: 'w-10 h-10 border-[3px]' }
  const spinner = (
    <div className={clsx('rounded-full border-sifra-border border-t-sifra-blue animate-spin', sizes[size], className)} />
  )
  if (fullPage) return <div className="flex items-center justify-center min-h-[60vh]">{spinner}</div>
  return spinner
}
