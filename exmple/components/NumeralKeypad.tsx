import { toPersianDigit } from '../lib/amount'
import { useTelegram } from '../hooks/useTelegram'
import './NumeralKeypad.css'

interface NumeralKeypadProps {
  onDigit: (digit: string) => void
  onBackspace: () => void
}

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function NumeralKeypad({ onDigit, onBackspace }: NumeralKeypadProps) {
  const { haptic } = useTelegram()

  const handleDigit = (digit: string) => {
    haptic('light')
    onDigit(digit)
  }

  const handleBackspace = () => {
    haptic('light')
    onBackspace()
  }

  return (
    <div className="numeral-keypad" dir="ltr">
      <div className="numeral-keypad__grid">
        {DIGIT_KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            className="numeral-keypad__key"
            onClick={() => handleDigit(digit)}
          >
            {toPersianDigit(digit)}
          </button>
        ))}
        <span className="numeral-keypad__spacer" aria-hidden />
        <button type="button" className="numeral-keypad__key" onClick={() => handleDigit('0')}>
          {toPersianDigit('0')}
        </button>
        <button
          type="button"
          className="numeral-keypad__key numeral-keypad__key--action"
          onClick={handleBackspace}
          aria-label="حذف"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 6H20.25C21.2165 6 22 6.7835 22 7.75V16.25C22 17.2165 21.2165 18 20.25 18H9L4 21V6H9Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M14.5 10.5L17.5 13.5M17.5 10.5L14.5 13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
