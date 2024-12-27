import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { initializeServices } from '@/lib/init-services'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Coin Price Monitor',
  description: '',
}

// 
// initializeServices().catch(console.error)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
