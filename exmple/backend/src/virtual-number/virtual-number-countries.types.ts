export type VirtualNumberQuality = 'premium' | 'standard' | 'economy'

export type VirtualNumberCountry = {
  countryId: string
  country: string
  flagCode: string
  range: number
  price: number
  toman: number
  quality: VirtualNumberQuality
  available: boolean
}

export type VirtualNumberCountryGroup = {
  quality: VirtualNumberQuality
  label: string
  items: VirtualNumberCountry[]
}

export const VIRTUAL_NUMBER_QUALITY_LABELS: Record<VirtualNumberQuality, string> = {
  premium: 'ویژه',
  standard: 'استاندارد',
  economy: 'اقتصادی',
}

export const VIRTUAL_NUMBER_QUALITY_ORDER: VirtualNumberQuality[] = [
  'economy',
  'standard',
  'premium',
]
