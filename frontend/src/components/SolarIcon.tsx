import { addCollection, Icon } from '@iconify/react'
import { icons as solarIcons } from '@iconify-json/solar'

addCollection(solarIcons)

type SolarIconProps = {
  icon: `solar:${string}`
  width?: number | string
  height?: number | string
  color?: string
  className?: string
}

export function SolarIcon({
  icon,
  width = 22,
  height = 22,
  color = 'currentColor',
  className,
}: SolarIconProps) {
  return (
    <Icon
      icon={icon}
      width={width}
      height={height}
      color={color}
      className={className}
      ssr
      style={{ display: 'block' }}
    />
  )
}
