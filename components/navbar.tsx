"use client"

import Link from "next/link"
import { Activity } from "lucide-react"

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur-sm shadow-sm supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 shadow-md group-hover:shadow-lg transition-shadow">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-gray-900">Website Status</span>
              <span className="text-xs text-gray-500">Real-time monitoring</span>
            </div>
          </Link>
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}




