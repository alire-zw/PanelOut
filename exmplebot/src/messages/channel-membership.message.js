import { premiumEmoji } from "../constants/emojis.js";

export const channelMembershipMessage = [
  `${premiumEmoji({ id: "5870593825407243361", fallback: "👋" })} برای دسترسی به <b>امکانات پنل</b> و <b>مدیریت سرویس‌های خود</b>، ابتدا در <b>کانال‌های زیر</b> عضو شوید.`,
  "",
  `${premiumEmoji({ id: "5922735252366693072", fallback: "🐙" })} عضویت در کانال‌ها برای <b>اطلاع‌رسانی بروزرسانی‌ها</b>، <b>تغییرات سرویس‌ها</b> و دریافت <b>اخبار مهم</b> الزامی است.`,
  "",
  `${premiumEmoji({ id: "5427240466158487770", fallback: "🍿" })} پس از <b>عضویت کامل</b>، روی دکمه <b>«تأیید عضویت»</b> کلیک کنید.`,
].join("\n");
