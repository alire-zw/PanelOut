import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";

export const walletTopUpMethodMessage = [
  `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_TITLE)} <b>افزایش موجودی</b>`,
  "",
  `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} برای شارژ کیف پول، لطفاً یکی از <b>روش‌های پرداخت</b> زیر را انتخاب کنید. پس از انتخاب، اطلاعات لازم برای تکمیل فرایند پرداخت در اختیار شما قرار خواهد گرفت.`,
  "",
  `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_CHOOSE)} روش پرداخت موردنظر خود را انتخاب کنید`,
].join("\n");

export const walletTopUpUnavailableMessage = [
  `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_TITLE)} <b>افزایش موجودی</b>`,
  "",
  `${premiumEmoji(PremiumEmoji.TOPUP_DESC)} در حال حاضر هیچ <b>روش پرداختی</b> فعال نیست. لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید.`,
].join("\n");
