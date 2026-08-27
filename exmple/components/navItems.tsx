import type { ComponentType } from 'react'
import DashboardIcon from './icons/DashboardIcon'
import DashboardActiveIcon from './icons/DashboardActiveIcon'
import ShopIcon from './icons/ShopIcon'
import ShopActiveIcon from './icons/ShopActiveIcon'
import ContactIcon from './icons/ContactIcon'
import ContactActiveIcon from './icons/ContactActiveIcon'
import UserIcon from './icons/UserIcon'
import UserActiveIcon from './icons/UserActiveIcon'
import AdminIcon from './icons/AdminIcon'
import AdminActiveIcon from './icons/AdminActiveIcon'

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
  label: 'ادمین',
  path: '/admin',
  icon: AdminIcon,
  activeIcon: AdminActiveIcon,
}

export { iconSize }
