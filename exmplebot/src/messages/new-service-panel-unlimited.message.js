import {
  MAX_PANEL_UNLIMITED_DAYS,
  MAX_PANEL_UNLIMITED_MAX_USERS,
  MIN_PANEL_UNLIMITED_DAYS,
  PANEL_UNLIMITED_PRICE_PER_SUB,
  PANEL_UNLIMITED_PRICE_PER_USER,
} from "../constants/panel-unlimited.js";
import { formatPanelUnlimitedCountText } from "../lib/panel-unlimited-steps.js";
import { formatPanelUnlimitedDaysText } from "../lib/panel-unlimited-days-steps.js";
import { formatPanelUnlimitedMaxUsersText } from "../lib/panel-unlimited-users-steps.js";
import { PremiumEmoji, premiumEmoji } from "../constants/emojis.js";
import { formatToman } from "./wallet.message.js";

export function buildPanelUnlimitedSoldOutMessage({ capacity, sold }) {
  return [
    `${premiumEmoji(PremiumEmoji.INVALID_CONFUSED)} <b>ظرفیت تکمیل شده</b>`,
    "",
    "در حال حاضر امکان خرید <b>سرویس نامحدود</b> وجود ندارد.",
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>ظرفیت کل:</b> ${Number(capacity).toLocaleString("en-US")} عدد`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>فروخته‌شده:</b> ${Number(sold).toLocaleString("en-US")} عدد`,
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} با <b>اعلام موجودی</b> در ربات یا کانال، دوباره امکان خرید فراهم می‌شود.`,
  ].join("\n");
}

export function buildNewServicePanelUnlimitedMessage({
  selectedCount = 0,
  selectedMaxUsers = 0,
  selectedDays = MIN_PANEL_UNLIMITED_DAYS,
  lockedMinMaxUsers = null,
  discountPercent = 0,
  userAddon = 0n,
  daysMultiplier = 1,
  totalPrice = 0,
  remaining = 0,
  pricePerSub = PANEL_UNLIMITED_PRICE_PER_SUB,
  pricePerUser = PANEL_UNLIMITED_PRICE_PER_USER,
} = {}) {
  const lines = [
    `${premiumEmoji(PremiumEmoji.SERVICE_PANEL_BTN)} <b>خرید سرویس نامحدود</b>`,
    "",
    "تعداد اشتراک، سقف کاربر هر اشتراک و مدت اشتراک را از طریق <b>دکمه‌های زیر</b> انتخاب کنید. این سرویس به‌صورت <b>تعدادی</b> و با <b>ظرفیت محدود</b> ارائه می‌شود.",
    "",
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>قیمت هر اشتراک:</b> ${formatToman(pricePerSub)} تومان`,
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>قیمت هر کاربر:</b> ${formatToman(pricePerUser)} تومان (حداکثر ${MAX_PANEL_UNLIMITED_MAX_USERS} کاربر)`,
    `${premiumEmoji(PremiumEmoji.WALLET)} <b>مدت اشتراک:</b> ${MIN_PANEL_UNLIMITED_DAYS} روز (پایه) — ${MAX_PANEL_UNLIMITED_DAYS} روزه <b>دو برابر</b> قیمت`,
    "",
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>تعداد انتخاب‌شده:</b> ${formatPanelUnlimitedCountText(selectedCount)}`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>سقف کاربر هر اشتراک:</b> ${formatPanelUnlimitedMaxUsersText(selectedMaxUsers)}`,
    `${premiumEmoji(PremiumEmoji.STATS_DESC)} <b>مدت اشتراک:</b> ${formatPanelUnlimitedDaysText(selectedDays)}`,
    `${premiumEmoji(PremiumEmoji.MANAGE_SERVICES)} <b>ظرفیت باقی‌مانده:</b> ${Number(remaining).toLocaleString("en-US")} عدد`,
  ];

  if (lockedMinMaxUsers) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} <b>حداقل سقف کاربر:</b> ${formatPanelUnlimitedMaxUsersText(lockedMinMaxUsers)} (بر اساس خرید قبلی؛ امکان کاهش وجود ندارد)`,
    );
  }

  if (discountPercent > 0) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_TITLE)} <b>تخفیف اشتراک:</b> ${discountPercent}٪`,
    );
  }

  if (userAddon > 0n) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_TITLE)} <b>هزینه کاربران:</b> ${formatToman(userAddon)} تومان`,
    );
  }

  if (daysMultiplier > 1) {
    lines.push(
      `${premiumEmoji(PremiumEmoji.TOPUP_METHOD_TITLE)} <b>ضریب مدت اشتراک:</b> ${daysMultiplier} برابر (${MAX_PANEL_UNLIMITED_DAYS} روزه)`,
    );
  }

  lines.push(
    `${premiumEmoji(PremiumEmoji.DEPOSIT_IRT)} <b>مبلغ قابل پرداخت:</b> ${formatToman(totalPrice)} تومان`,
    "",
    `${premiumEmoji(PremiumEmoji.INVALID_THINKING)} <b>نکته مهم درباره تعداد کاربر</b>`,
    "پس از تعیین تعداد کاربر در <b>اولین خرید</b>، در خریدهای بعدی امکان <b>کاهش</b> این مقدار وجود ندارد. اکانت ادمین شما با همین تعداد کاربر ساخته می‌شود و اشتراک‌های بعدی نیز بر همین اساس خواهد بود.",
    "",
    `${premiumEmoji(PremiumEmoji.OCTOPUS)} عددی که انتخاب می‌کنید، <b>سقف حداکثر کاربر</b> برای هر اشتراک است؛ یعنی اگر پنل نامحدود ۵ کاربره تهیه کنید، می‌توانید اشتراک‌های ۱ تا ۵ کاربره بسازید و الزامی نیست همه اشتراک‌ها ۵ کاربر باشند.`,
    "",
    `${premiumEmoji(PremiumEmoji.OCTOPUS)} پس از بررسی <b>تعداد انتخابی</b> و <b>مبلغ نهایی</b>، برای تکمیل سفارش روی دکمه «<b>تایید و ادامه خرید</b>» کلیک کنید:`,
  );

  return lines.join("\n");
}
