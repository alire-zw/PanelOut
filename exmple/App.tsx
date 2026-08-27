import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { BrowserLoginPage } from './pages/BrowserLogin'
import { BottomNav } from './components/BottomNav'
import { Header } from './components/Header'
import CollaborationIcon from './components/icons/CollaborationIcon'
import { HomePage } from './pages/Home'
import { OrderDetailPage } from './pages/OrderDetail'
import { OrdersListPage } from './pages/OrdersList'
import { MyVirtualNumbersPage } from './pages/MyVirtualNumbers'
import { ProfileInfoPage } from './pages/ProfileInfo'
import { ProfileCardsPage } from './pages/ProfileCards'
import { ProfileChargeHistoryPage } from './pages/ProfileChargeHistory'
import { ProfilePage } from './pages/Profile'
import { WalletPage } from './pages/Wallet'
import { WalletChargePage } from './pages/WalletCharge'
import { WalletChargePaymentPage } from './pages/WalletChargePayment'
import { WalletTronPaymentPage } from './pages/WalletTronPayment'
import { WalletPaymentFailedPage } from './pages/WalletPaymentFailed'
import { WalletPaymentSuccessPage } from './pages/WalletPaymentSuccess'
import { WalletTransferPage } from './pages/WalletTransfer'
import { WalletTransferRecipientPage } from './pages/WalletTransferRecipient'
import { WalletTransferConfirmPage } from './pages/WalletTransferConfirm'
import { WalletTransferSuccessPage } from './pages/WalletTransferSuccess'
import { ShopPage } from './pages/Shop'
import { StarsPage } from './pages/Stars'
import { StarsConfirmPage } from './pages/StarsConfirm'
import { StarsKycPhonePage } from './pages/StarsKycPhone'
import { StarsKycOtpPage } from './pages/StarsKycOtp'
import { StarsKycIdentityPage } from './pages/StarsKycIdentity'
import { StarsKycCardPage } from './pages/StarsKycCard'
import { StarsKycTermsPage } from './pages/StarsKycTerms'
import { StarsKycReviewPage } from './pages/StarsKycReview'
import { StarsPaymentSuccessPage } from './pages/StarsPaymentSuccess'
import { StarsPaymentFailedPage } from './pages/StarsPaymentFailed'
import { PremiumPage } from './pages/Premium'
import { PremiumConfirmPage } from './pages/PremiumConfirm'
import { PremiumPaymentSuccessPage } from './pages/PremiumPaymentSuccess'
import { PremiumPaymentFailedPage } from './pages/PremiumPaymentFailed'
import { VirtualNumberPage } from './pages/VirtualNumber'
import { VirtualNumberConfirmPage } from './pages/VirtualNumberConfirm'
import { VirtualNumberPaymentSuccessPage } from './pages/VirtualNumberPaymentSuccess'
import { VirtualNumberPaymentFailedPage } from './pages/VirtualNumberPaymentFailed'
import { ChannelViewsPage } from './pages/ChannelViews'
import { ChannelViewsConfirmPage } from './pages/ChannelViewsConfirm'
import { ChannelViewsAutoPage } from './pages/ChannelViewsAuto'
import { ChannelViewsPaymentSuccessPage } from './pages/ChannelViewsPaymentSuccess'
import { ChannelViewsPaymentFailedPage } from './pages/ChannelViewsPaymentFailed'
import { ReactionPage } from './pages/Reaction'
import { ReactionConfirmPage } from './pages/ReactionConfirm'
import { ReactionAutoPage } from './pages/ReactionAuto'
import { ReactionPaymentSuccessPage } from './pages/ReactionPaymentSuccess'
import { ReactionPaymentFailedPage } from './pages/ReactionPaymentFailed'
import { TelegramMembersPage } from './pages/TelegramMembers'
import { TelegramMembersConfirmPage } from './pages/TelegramMembersConfirm'
import { TelegramMembersPaymentSuccessPage } from './pages/TelegramMembersPaymentSuccess'
import { TelegramMembersPaymentFailedPage } from './pages/TelegramMembersPaymentFailed'
import { ChatGPTPage } from './pages/ChatGPT'
import { ChatGPTProductsPage } from './pages/ChatGPTProducts'
import { ChatGPTConfirmPage } from './pages/ChatGPTConfirm'
import { ChatGPTPaymentSuccessPage } from './pages/ChatGPTPaymentSuccess'
import { ChatGPTPaymentFailedPage } from './pages/ChatGPTPaymentFailed'
import { AdminPage } from './pages/Admin'
import { AdminUsersPage } from './pages/admin/AdminUsers'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetail'
import { AdminOrdersPage } from './pages/admin/AdminOrders'
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetail'
import { AdminPaymentsPage } from './pages/admin/AdminPayments'
import { AdminClubPage } from './pages/admin/AdminClub'
import { AdminKycPage } from './pages/admin/AdminKyc'
import { AdminAnalyticsPage } from './pages/admin/AdminAnalytics'
import { AdminCryptoPage } from './pages/admin/AdminCrypto'
import { AdminTransfersPage } from './pages/admin/AdminTransfers'
import { AdminToolsPage } from './pages/admin/AdminTools'
import { AdminDiscountsPage } from './pages/admin/AdminDiscounts'
import { AdminPricingPage } from './pages/admin/AdminPricing'
import { AdminTicketsPage } from './pages/admin/AdminTickets'
import { AdminSystemChannelsPage } from './pages/admin/AdminSystemChannels'
import { AdminShopBannersPage } from './pages/admin/AdminShopBanners'
import { AdminShopBannerCreatePage } from './pages/admin/AdminShopBannerCreate'
import { AdminAccountPlansPage } from './pages/admin/AdminAccountPlans'
import { AdminAccountPlansCategoryPage } from './pages/admin/AdminAccountPlansCategory'
import { AdminAccountPlansCreatePage } from './pages/admin/AdminAccountPlansCreate'
import { AdminAccountOrdersPage } from './pages/admin/AdminAccountOrders'
import { AdminAccountOrderDetailPage } from './pages/admin/AdminAccountOrderDetail'
import { SupportPage } from './pages/Support'
import { SupportNewPage } from './pages/SupportNew'
import { SupportTicketPage } from './pages/SupportTicket'
import { PlaceholderPage } from './pages/Placeholder'
import { shopHeroNavPaths } from './data/shopHeroPages'
import { useTelegram } from './hooks/useTelegram'
import { lockAppScroll, unlockAppScroll } from './lib/scrollLock'
import { syncTelegramChromeForPath } from './lib/telegramTheme'
import { ChannelLockGate } from './components/ChannelLockGate'
import './App.css'

const noBottomNavPaths = [
  '/login',
  '/wallet',
  '/stars',
  '/premium',
  '/orders',
  '/my-virtual-numbers',
  '/profile/info',
  '/profile/cards',
  '/profile/charge-history',
  ...shopHeroNavPaths,
]
const lockScrollExactPaths = ['/login', '/wallet', '/profile/charge-history']
const lockScrollPrefixPaths = ['/wallet/charge', '/wallet/transfer', '/stars/kyc']

function AppShell() {
  const { isReady } = useTelegram()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const hideBottomNav =
    noBottomNavPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/support/')
  const shouldLockScroll =
    lockScrollExactPaths.includes(pathname) ||
    lockScrollPrefixPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    (pathname.startsWith('/support/') && pathname !== '/support/new')

  useEffect(() => {
    if (!shouldLockScroll) return

    lockAppScroll()
    return () => unlockAppScroll()
  }, [shouldLockScroll])

  useEffect(() => {
    if (!isReady) return
    syncTelegramChromeForPath(pathname)
  }, [isReady, pathname])

  useEffect(() => {
    if (!isReady) return
    const startParam = window.Telegram?.WebApp.initDataUnsafe?.start_param?.trim()
    if (startParam === 'profile' && pathname !== '/profile') {
      navigate('/profile', { replace: true })
    }
  }, [isReady, navigate, pathname])

  if (!isReady) {
    return (
      <div className="app app--loading">
        <div className="app__loader" aria-label="در حال بارگذاری" />
      </div>
    )
  }

  return (
    <div className={`app${hideBottomNav ? ' app--no-bottom-nav' : ''}`}>
      <div className="app__scroll">
        <Header />
        <main className="app__main">
          <Routes>
          <Route path="/" element={<ShopPage />} />
          <Route path="/login" element={<BrowserLoginPage />} />
          <Route path="/stars" element={<StarsPage />} />
          <Route path="/stars/confirm" element={<StarsConfirmPage />} />
          <Route path="/stars/kyc/phone" element={<StarsKycPhonePage />} />
          <Route path="/stars/kyc/otp" element={<StarsKycOtpPage />} />
          <Route path="/stars/kyc/identity" element={<StarsKycIdentityPage />} />
          <Route path="/stars/kyc/card" element={<StarsKycCardPage />} />
          <Route path="/stars/kyc/terms" element={<StarsKycTermsPage />} />
          <Route path="/stars/kyc/review" element={<StarsKycReviewPage />} />
          <Route path="/stars/payment/success" element={<StarsPaymentSuccessPage />} />
          <Route path="/stars/payment/failed" element={<StarsPaymentFailedPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/premium/confirm" element={<PremiumConfirmPage />} />
          <Route path="/premium/payment/success" element={<PremiumPaymentSuccessPage />} />
          <Route path="/premium/payment/failed" element={<PremiumPaymentFailedPage />} />
          <Route path="/virtual-number" element={<VirtualNumberPage />} />
          <Route path="/virtual-number/confirm" element={<VirtualNumberConfirmPage />} />
          <Route
            path="/virtual-number/payment/success"
            element={<VirtualNumberPaymentSuccessPage />}
          />
          <Route
            path="/virtual-number/payment/failed"
            element={<VirtualNumberPaymentFailedPage />}
          />
          <Route path="/channel-views" element={<ChannelViewsPage />} />
          <Route path="/channel-views/auto" element={<ChannelViewsAutoPage />} />
          <Route path="/channel-views/confirm" element={<ChannelViewsConfirmPage />} />
          <Route
            path="/channel-views/payment/success"
            element={<ChannelViewsPaymentSuccessPage />}
          />
          <Route
            path="/channel-views/payment/failed"
            element={<ChannelViewsPaymentFailedPage />}
          />
          <Route path="/reaction" element={<ReactionPage />} />
          <Route path="/reaction/auto" element={<ReactionAutoPage />} />
          <Route path="/reaction/confirm" element={<ReactionConfirmPage />} />
          <Route path="/reaction/payment/success" element={<ReactionPaymentSuccessPage />} />
          <Route path="/reaction/payment/failed" element={<ReactionPaymentFailedPage />} />
          <Route path="/telegram-members" element={<TelegramMembersPage />} />
          <Route path="/telegram-members/confirm" element={<TelegramMembersConfirmPage />} />
          <Route
            path="/telegram-members/payment/success"
            element={<TelegramMembersPaymentSuccessPage />}
          />
          <Route
            path="/telegram-members/payment/failed"
            element={<TelegramMembersPaymentFailedPage />}
          />
          <Route path="/chatgpt" element={<ChatGPTPage />} />
          <Route path="/chatgpt/payment/success" element={<ChatGPTPaymentSuccessPage />} />
          <Route path="/chatgpt/payment/failed" element={<ChatGPTPaymentFailedPage />} />
          <Route path="/chatgpt/:categoryId/confirm" element={<ChatGPTConfirmPage />} />
          <Route path="/chatgpt/:categoryId" element={<ChatGPTProductsPage />} />
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/orders" element={<OrdersListPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/my-virtual-numbers" element={<MyVirtualNumbersPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/kyc" element={<AdminKycPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/orders/:orderId" element={<AdminOrderDetailPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/crypto" element={<AdminCryptoPage />} />
          <Route path="/admin/transfers" element={<AdminTransfersPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/club" element={<AdminClubPage />} />
          <Route path="/admin/discounts" element={<AdminDiscountsPage />} />
          <Route path="/admin/pricing" element={<AdminPricingPage />} />
          <Route path="/admin/tickets" element={<AdminTicketsPage />} />
          <Route path="/admin/system-channels" element={<AdminSystemChannelsPage />} />
          <Route path="/admin/shop-banners" element={<AdminShopBannersPage />} />
          <Route path="/admin/shop-banners/new" element={<AdminShopBannerCreatePage />} />
          <Route path="/admin/account-plans" element={<AdminAccountPlansPage />} />
          <Route path="/admin/account-orders" element={<AdminAccountOrdersPage />} />
          <Route
            path="/admin/account-orders/:orderId"
            element={<AdminAccountOrderDetailPage />}
          />
          <Route
            path="/admin/account-plans/:categoryId"
            element={<AdminAccountPlansCategoryPage />}
          />
          <Route
            path="/admin/account-plans/:categoryId/new"
            element={<AdminAccountPlansCreatePage />}
          />
          <Route
            path="/admin/account-plans/:categoryId/edit/:planId"
            element={<AdminAccountPlansCreatePage />}
          />
          <Route path="/admin/tools" element={<AdminToolsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/support/new" element={<SupportNewPage />} />
          <Route path="/support/:ticketCode" element={<SupportTicketPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/wallet/charge" element={<WalletChargePage />} />
          <Route path="/wallet/transfer" element={<WalletTransferPage />} />
          <Route path="/wallet/transfer/recipient" element={<WalletTransferRecipientPage />} />
          <Route path="/wallet/transfer/confirm" element={<WalletTransferConfirmPage />} />
          <Route path="/wallet/transfer/success" element={<WalletTransferSuccessPage />} />
          <Route path="/wallet/charge/payment" element={<WalletChargePaymentPage />} />
          <Route path="/wallet/charge/tron" element={<WalletTronPaymentPage />} />
          <Route path="/wallet/payment/success" element={<WalletPaymentSuccessPage />} />
          <Route path="/wallet/payment/failed" element={<WalletPaymentFailedPage />} />
          <Route path="/profile/info" element={<ProfileInfoPage />} />
          <Route path="/profile/cards" element={<ProfileCardsPage />} />
          <Route path="/profile/charge-history" element={<ProfileChargeHistoryPage />} />
          <Route
            path="/cooperation"
            element={
              <PlaceholderPage
                title="همکاری با ما"
                description="درخواست همکاری و اطلاعات مربوط به فروشندگان."
                icon={<CollaborationIcon width={28} height={28} />}
              />
            }
          />
        </Routes>
        </main>
      </div>
      {!hideBottomNav && <BottomNav />}
      <ChannelLockGate />
    </div>
  )
}

export function App() {
  return <AppShell />
}
