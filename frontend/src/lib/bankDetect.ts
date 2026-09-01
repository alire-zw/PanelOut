export type BankInfo = {
  slug: string
  nameFa: string
  bin: string
  color1: string
  color2: string
  iconSrc: string
}

/** Iranian card BINs (first 6 digits) → bank visual metadata */
const BANKS: Array<Omit<BankInfo, 'bin' | 'iconSrc'> & { bins: string[] }> = [
  { slug: 'melli', nameFa: 'بانک ملی', bins: ['603799'], color1: '#FFF200', color2: '#1A1A1A' },
  { slug: 'sepah', nameFa: 'بانک سپه', bins: ['589210'], color1: '#E31837', color2: '#8B0000' },
  { slug: 'saderat', nameFa: 'بانک صادرات', bins: ['603769'], color1: '#1E3A8A', color2: '#0F172A' },
  { slug: 'tejarat', nameFa: 'بانک تجارت', bins: ['627353', '585983'], color1: '#0EA5E9', color2: '#0369A1' },
  { slug: 'mellat', nameFa: 'بانک ملت', bins: ['610433', '991975'], color1: '#DC2626', color2: '#7F1D1D' },
  { slug: 'refah', nameFa: 'بانک رفاه', bins: ['589463'], color1: '#2563EB', color2: '#1E3A8A' },
  { slug: 'keshavarzi', nameFa: 'بانک کشاورزی', bins: ['603770', '639217'], color1: '#16A34A', color2: '#14532D' },
  { slug: 'maskan', nameFa: 'بانک مسکن', bins: ['628023'], color1: '#EA580C', color2: '#9A3412' },
  { slug: 'post', nameFa: 'پست بانک', bins: ['627760'], color1: '#16A34A', color2: '#166534' },
  { slug: 'parsian', nameFa: 'بانک پارسیان', bins: ['622106', '627884', '639194'], color1: '#F59E0B', color2: '#92400E' },
  { slug: 'pasargad', nameFa: 'بانک پاسارگاد', bins: ['502229', '639347'], color1: '#000000', color2: '#FBBF24' },
  { slug: 'saman', nameFa: 'بانک سامان', bins: ['621986'], color1: '#0EA5E9', color2: '#075985' },
  { slug: 'sina', nameFa: 'بانک سینا', bins: ['639346'], color1: '#1D4ED8', color2: '#172554' },
  { slug: 'eghtesad-novin', nameFa: 'اقتصاد نوین', bins: ['627412'], color1: '#7C3AED', color2: '#4C1D95' },
  { slug: 'kar-afarin', nameFa: 'کارآفرین', bins: ['627488'], color1: '#CA8A04', color2: '#713F12' },
  { slug: 'sarmayeh', nameFa: 'بانک سرمایه', bins: ['639607'], color1: '#64748B', color2: '#1E293B' },
  { slug: 'ayandeh', nameFa: 'بانک آینده', bins: ['636214'], color1: '#8B5CF6', color2: '#4C1D95' },
  { slug: 'shahr', nameFa: 'بانک شهر', bins: ['502806', '504706'], color1: '#DC2626', color2: '#450A0A' },
  { slug: 'dey', nameFa: 'بانک دی', bins: ['502938'], color1: '#06B6D4', color2: '#164E63' },
  { slug: 'ansar', nameFa: 'بانک انصار', bins: ['627381'], color1: '#DC2626', color2: '#7F1D1D' },
  { slug: 'ghavamin', nameFa: 'قوامین', bins: ['639599'], color1: '#16A34A', color2: '#14532D' },
  { slug: 'tourism', nameFa: 'گردشگری', bins: ['505416'], color1: '#E11D48', color2: '#881337' },
  { slug: 'iran-zamin', nameFa: 'ایران زمین', bins: ['505785'], color1: '#0D9488', color2: '#134E4A' },
  { slug: 'hekmat', nameFa: 'حکمت ایرانیان', bins: ['636949'], color1: '#1E40AF', color2: '#1E3A8A' },
  { slug: 'mehr-iran', nameFa: 'مهر ایران', bins: ['606373'], color1: '#16A34A', color2: '#14532D' },
  { slug: 'resalat', nameFa: 'رسالت', bins: ['504172'], color1: '#0EA5E9', color2: '#0C4A6E' },
  { slug: 'middle-east', nameFa: 'خاورمیانه', bins: ['585947'], color1: '#F59E0B', color2: '#78350F' },
  { slug: 'mellal', nameFa: 'ملل', bins: ['606256'], color1: '#1D4ED8', color2: '#1E3A8A' },
  { slug: 'kowsar', nameFa: 'کوثر', bins: ['505801'], color1: '#9333EA', color2: '#581C87' },
  { slug: 'tosee-taavon', nameFa: 'توسعه تعاون', bins: ['502908'], color1: '#059669', color2: '#064E3B' },
  { slug: 'industry-mine', nameFa: 'صنعت و معدن', bins: ['627961'], color1: '#334155', color2: '#0F172A' },
  { slug: 'export-development', nameFa: 'توسعه صادرات', bins: ['627648'], color1: '#1E40AF', color2: '#172554' },
  { slug: 'credit-istitute-for-development', nameFa: 'موسسه اعتباری توسعه', bins: ['628157'], color1: '#475569', color2: '#1E293B' },
]

const UNKNOWN: BankInfo = {
  slug: 'unknown',
  nameFa: 'نامشخص',
  bin: '',
  color1: '#52525B',
  color2: '#27272A',
  iconSrc: '/banks/unknown.svg',
}

function withIcon(slug: string, rest: Omit<BankInfo, 'iconSrc'>): BankInfo {
  return { ...rest, iconSrc: `/banks/${slug}.svg` }
}

export function detectBankFromCardDigits(digits: string): BankInfo | null {
  const clean = digits.replace(/\D/g, '')
  if (clean.length < 6) return null
  const bin = clean.slice(0, 6)
  for (const bank of BANKS) {
    if (bank.bins.includes(bin)) {
      return withIcon(bank.slug, {
        slug: bank.slug,
        nameFa: bank.nameFa,
        bin,
        color1: bank.color1,
        color2: bank.color2,
      })
    }
  }
  return withIcon('unknown', { ...UNKNOWN, bin })
}

export function getBankVisual(slug: string | null | undefined, cardNumber?: string): BankInfo {
  if (cardNumber) {
    const detected = detectBankFromCardDigits(cardNumber)
    if (detected && detected.slug !== 'unknown') return detected
  }
  if (slug) {
    const bank = BANKS.find((item) => item.slug === slug)
    if (bank) {
      return withIcon(bank.slug, {
        slug: bank.slug,
        nameFa: bank.nameFa,
        bin: bank.bins[0] ?? '',
        color1: bank.color1,
        color2: bank.color2,
      })
    }
  }
  return withIcon('unknown', { ...UNKNOWN })
}

export {
  CARD_PATTERN_URLS,
  getCardPattern,
  getCardTopBackgroundStyle,
  getRandomCardPattern,
  preloadCardPatterns,
  type CardPatternUrl,
} from './cardPatterns'
