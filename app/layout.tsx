import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} bg-white text-gray-900`}>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-6 py-6">
        {children}
          </main>
          <Footer />
        </div>
        <Analytics />
      </body>
    </html>
  )
}
