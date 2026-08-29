import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatToman } from "./wallet.message.js";

export function buildWalletTopUpMessage(address, trxPriceIrt) {
  const price = formatToman(trxPriceIrt);

  return [
    `${premiumEmoji(PremiumEmoji.TOPUP_TITLE)} <b>افزایش موجودی</b> | قیمت هر ترون: <code>${price}</code> تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} برای شارژ کیف پول، مبلغ موردنظر را فقط به‌صورت <b>TRX (ترون)</b> به آدرس زیر واریز کنید. لطفاً از ارسال <b>USDT</b> یا سایر توکن‌ها به این آدرس خودداری نمایید؛ تنها واریزهای TRX قابل محاسبه و شارژ خواهند بود.`,
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_ADDRESS)} آدرس کیف پول:`,
    `<code>${address}</code>`,
    "",
    `${premiumEmoji(PremiumEmoji.TOPUP_CONFIRM)} پس از تأیید تراکنش در شبکه ترون، موجودی حساب شما به‌صورت خودکار و بدون نیاز به ارسال رسید شارژ خواهد شد.`,
  ].join("\n");
}
