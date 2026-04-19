import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight text-gray-900">
            AI<span className="text-blue-600">Zanon</span>
          </span>
          <span className="hidden sm:inline text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
            Закони простою мовою
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Законопроекти
          </Link>
          <a
            href="https://rada.gov.ua"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition-colors hidden sm:inline"
          >
            rada.gov.ua ↗
          </a>
        </nav>
      </div>
    </header>
  )
}
