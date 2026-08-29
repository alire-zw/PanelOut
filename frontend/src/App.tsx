import { useEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { ChannelLockGate } from './components/ChannelLockGate'
import { Header } from './components/Header'
import { useTelegram } from './hooks/useTelegram'
import { lockAppScroll, unlockAppScroll } from './lib/scrollLock'
import { syncTelegramChromeForPath } from './lib/telegramTheme'
import { AdminPage } from './pages/Admin'
import { AdminCardsPage } from './pages/AdminCards'
import { AdminChargesPage } from './pages/AdminCharges'
import { AdminSystemChannelsPage } from './pages/AdminSystemChannels'
import { AdminPaymentSettingsPage } from './pages/AdminPaymentSettings'
import { AdminPanelsPage } from './pages/AdminPanels'
import { AdminTicketsPage } from './pages/AdminTickets'
import { AdminUserDetailPage } from './pages/AdminUserDetail'
import { AdminUsersPage } from './pages/AdminUsers'
import { FaqPage } from './pages/Faq'
import { HomePage } from './pages/HomePage'
import { PanelStartPage } from './pages/PanelStart'
import { PanelSuccessPage } from './pages/PanelSuccess'
import { PanelTrialUsernamePage } from './pages/PanelTrialUsername'
import { PanelUsageActivatePage } from './pages/PanelUsageActivate'
import { PanelUsageUsernamePage } from './pages/PanelUsageUsername'
import { DashboardPage } from './pages/Dashboard'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProfilePage } from './pages/Profile'
import { ProfileInfoPage } from './pages/ProfileInfo'
import { SupportPage } from './pages/Support'
import { SupportNewPage } from './pages/SupportNew'
import { SupportTicketPage } from './pages/SupportTicket'
import { WalletPage } from './pages/Wallet'
import { WalletCardChargePage } from './pages/WalletCardCharge'
import { WalletChargePage } from './pages/WalletCharge'
import { WalletChargePaymentPage } from './pages/WalletChargePayment'
import { WalletTronChargePage } from './pages/WalletTronCharge'
import { WalletTransferPage } from './pages/WalletTransfer'
import { WalletTransferRecipientPage } from './pages/WalletTransferRecipient'
import { WalletTransferConfirmPage } from './pages/WalletTransferConfirm'
import { WalletTransferSuccessPage } from './pages/WalletTransferSuccess'
import './App.css'

const noBottomNavPaths = ['/wallet', '/panel', '/faq']
const lockScrollExactPaths = ['/wallet']
const lockScrollPrefixPaths = ['/wallet/charge', '/wallet/transfer', '/panel']

export default function App() {
  const { isReady } = useTelegram()
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)

  const hideBottomNav =
    noBottomNavPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith('/support/') ||
    pathname.startsWith('/profile/') ||
    pathname.startsWith('/admin/')

  const shouldLockScroll =
    lockScrollExactPaths.includes(pathname) ||
    lockScrollPrefixPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    (pathname.startsWith('/support/') && pathname !== '/support/new')

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])

  useEffect(() => {
    if (!shouldLockScroll) return
    lockAppScroll()
    return () => unlockAppScroll()
  }, [shouldLockScroll])

  useEffect(() => {
    if (!isReady) return
    syncTelegramChromeForPath(pathname)
  }, [isReady, pathname])

  return (
    <div className={`app${hideBottomNav ? ' app--no-bottom-nav' : ''}`}>
      <div className="app__scroll" ref={scrollRef}>
        <Header />
        <main className="app__main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/panel" element={<PanelStartPage />} />
            <Route path="/panel/trial/username" element={<PanelTrialUsernamePage />} />
            <Route path="/panel/usage" element={<PanelUsageActivatePage />} />
            <Route path="/panel/usage/username" element={<PanelUsageUsernamePage />} />
            <Route path="/panel/success" element={<PanelSuccessPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/support/new" element={<SupportNewPage />} />
            <Route path="/support/:ticketCode" element={<SupportTicketPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/info" element={<ProfileInfoPage />} />
            <Route
              path="/profile/cards"
              element={<PlaceholderPage title="کارت های بانکی" withPageHeader backTo="/profile" />}
            />
            <Route
              path="/profile/charge-history"
              element={<PlaceholderPage title="تاریخچه شارژ" withPageHeader backTo="/profile" />}
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/users/:telegramId" element={<AdminUserDetailPage />} />
            <Route path="/admin/cards" element={<AdminCardsPage />} />
            <Route path="/admin/charges" element={<AdminChargesPage />} />
            <Route path="/admin/tickets" element={<AdminTicketsPage />} />
            <Route path="/admin/system-channels" element={<AdminSystemChannelsPage />} />
            <Route path="/admin/panels" element={<AdminPanelsPage />} />
            <Route path="/admin/payment-settings" element={<AdminPaymentSettingsPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/wallet/charge" element={<WalletChargePage />} />
            <Route path="/wallet/charge/payment" element={<WalletChargePaymentPage />} />
            <Route path="/wallet/charge/card" element={<WalletCardChargePage />} />
            <Route path="/wallet/transfer" element={<WalletTransferPage />} />
            <Route path="/wallet/transfer/recipient" element={<WalletTransferRecipientPage />} />
            <Route path="/wallet/transfer/confirm" element={<WalletTransferConfirmPage />} />
            <Route path="/wallet/transfer/success" element={<WalletTransferSuccessPage />} />
            <Route path="/wallet/charge/tron" element={<WalletTronChargePage />} />
          </Routes>
        </main>
      </div>
      {!hideBottomNav && <BottomNav />}
      <ChannelLockGate />
    </div>
  )
}
