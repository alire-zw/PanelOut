import type { ComponentType } from 'react'
import AdminActiveIcon from './icons/AdminActiveIcon'
import AdminIcon from './icons/AdminIcon'
import ContactActiveIcon from './icons/ContactActiveIcon'
import ContactIcon from './icons/ContactIcon'
import DashboardActiveIcon from './icons/DashboardActiveIcon'
import DashboardIcon from './icons/DashboardIcon'
import ShopActiveIcon from './icons/ShopActiveIcon'
import ShopIcon from './icons/ShopIcon'
import UserActiveIcon from './icons/UserActiveIcon'
import UserIcon from './icons/UserIcon'

type IconProps = {
  width?: number | string
  height?: number | string
  color?: string
  className?: string
}

export type NavItem = {
  id: string
  label: string
  path: string
  icon: ComponentType<IconProps>
  activeIcon: ComponentType<IconProps>
}

const iconSize = { width: 22, height: 22 }

export const navItems: NavItem[] = [
  {
    id: 'shop',
    label: 'فروشگاه',
    path: '/',
    icon: ShopIcon,
    activeIcon: ShopActiveIcon,
  },
  {
    id: 'dashboard',
    label: 'داشبورد',
    path: '/dashboard',
    icon: DashboardIcon,
    activeIcon: DashboardActiveIcon,
  },
  {
    id: 'support',
    label: 'پشتیبانی',
    path: '/support',
    icon: ContactIcon,
    activeIcon: ContactActiveIcon,
  },
  {
    id: 'profile',
    label: 'پروفایل',
    path: '/profile',
    icon: UserIcon,
    activeIcon: UserActiveIcon,
  },
]

export const adminNavItem: NavItem = {
  id: 'admin',
  label: 'مدیریت',
  path: '/admin',
  icon: AdminIcon,
  activeIcon: AdminActiveIcon,
}

export { iconSize }
