'use client'

import Link from 'next/link'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-brand-green/20 bg-black/95 backdrop-blur-md">
            <div className="container mx-auto px-3 sm:px-4 lg:px-8">
                <div className="flex h-16 sm:h-20 items-center justify-between gap-2">
                    {/* Logo & Title */}
                    <Link href="/" className="group flex items-center gap-2 sm:gap-3 transition-all hover:scale-105">
                        <img 
                            src="/logo.png" 
                            alt="DeCleanup Network" 
                            className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0"
                        />
                        <p className="font-bebas text-[10px] sm:text-[11px] leading-none tracking-wide text-gray-300 lg:text-[12px] whitespace-nowrap">
                            CLEAN UP, SNAP, EARN
                        </p>
                    </Link>

                    {/* Wallet Connect */}
                    <WalletConnect />
                </div>
            </div>
        </header>
    )
}
