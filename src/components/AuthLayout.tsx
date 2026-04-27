import { Link } from 'react-router-dom'

interface Props {
  title: string
  subtitle: string
  children: React.ReactNode
}

/**
 * Shared wrapper for all auth pages (Login, Register, Verify, etc.)
 * Renders the Sifra script logo, page title, and card.
 */
export default function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen bg-sifra-gradient flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="sifra-wordmark text-6xl leading-none">Sifra</span>
          </Link>
          <h1 className="text-2xl font-black text-sifra-navy mt-5 mb-1">{title}</h1>
          <p className="text-sm text-sifra-muted">{subtitle}</p>
        </div>

        <div className="card px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
