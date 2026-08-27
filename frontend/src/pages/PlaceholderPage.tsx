import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'

type PlaceholderPageProps = {
  title: string
  withPageHeader?: boolean
  backTo?: string
}

export function PlaceholderPage({
  title,
  withPageHeader = false,
  backTo = '/',
}: PlaceholderPageProps) {
  const navigate = useNavigate()

  return (
    <div className={`placeholder-page${withPageHeader ? ' placeholder-page--flush' : ''}`}>
      {withPageHeader ? (
        <PageHeader title={title} onBack={() => navigate(backTo)} />
      ) : (
        <h1 className="placeholder-page__title">{title}</h1>
      )}
      <p className="placeholder-page__text">این بخش به‌زودی اضافه می‌شود.</p>
    </div>
  )
}
