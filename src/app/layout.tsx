import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: 'AIZakon — Закони Верховної Ради простою мовою',
  description:
    'Законопроекти Верховної Ради України з AI-поясненням. Хто вніс, як голосували, що це означає для вас.',
  keywords: 'Верховна Рада, закони України, законопроекти, голосування депутатів',
  openGraph: {
    title: 'AIZakon — Закони простою мовою',
    description: 'Всі законопроекти ВРУ з поясненням від AI',
    locale: 'uk_UA',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk" className="h-full">
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-gray-100 py-6 mt-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <span>
              Дані:&nbsp;
              <a href="https://data.rada.gov.ua" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                data.rada.gov.ua
              </a>
              &nbsp;(CC BY 4.0)
            </span>
            <span>AIZakon — незалежний проект. Не афільований з ВРУ.</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
