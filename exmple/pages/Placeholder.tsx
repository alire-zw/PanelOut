import type { ReactNode } from 'react'
import './Placeholder.css'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: ReactNode
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <div className="placeholder">
      <div className="placeholder__icon">{icon}</div>
      <h1 className="placeholder__title">{title}</h1>
      <p className="placeholder__desc">{description}</p>
    </div>
  )
}
