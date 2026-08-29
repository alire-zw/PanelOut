import { AdminEmoji, adminEmoji } from "../constants/emojis.js";

export const adminMessage = [
  `${adminEmoji(AdminEmoji.PANEL)} <b>پنل مدیریت ربات</b>`,
  "",
  "از منوی زیر بخش مورد نظر را انتخاب کنید.",
].join("\n");

export function buildAdminUsersStatsMessage(updatedAt) {
  return [
    `${adminEmoji(AdminEmoji.TITLE)} <b>آمار کاربران ربات</b>`,
    "",
    `${adminEmoji(AdminEmoji.DESC)} شما می‌توانید آمار کاربران ربات را از این بخش مشاهده کنید.`,
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}
