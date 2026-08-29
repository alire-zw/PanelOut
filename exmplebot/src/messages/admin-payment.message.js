import { AdminEmoji, adminEmoji } from "../constants/emojis.js";
import {
  formatCardNumber,
  formatShebaNumber,
} from "../services/payment-settings.service.js";

export function buildAdminPaymentSettingsMessage(updatedAt) {
  return [
    `${adminEmoji(AdminEmoji.PAYMENT)} <b>تنظیمات پرداخت</b>`,
    "",
    `${adminEmoji(AdminEmoji.DESC)} روش پرداخت موردنظر را از منوی زیر انتخاب کنید تا تنظیمات آن را مدیریت نمایید.`,
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}

export function buildAdminTronSettingsMessage(updatedAt) {
  return [
    `${adminEmoji(AdminEmoji.TRON)} <b>تنظیمات پرداخت ترون</b>`,
    "",
    `${adminEmoji(AdminEmoji.DESC)} در این بخش می‌توانید <b>ولت مستر</b> و وضعیت <b>پرداخت ترون</b> را مدیریت کنید.`,
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}

export function buildAdminRialSettingsMessage(updatedAt) {
  return [
    `${adminEmoji(AdminEmoji.RIAL)} <b>تنظیمات پرداخت ریالی</b>`,
    "",
    `${adminEmoji(AdminEmoji.DESC)} در این بخش می‌توانید <b>شماره کارت</b>، <b>شبا</b> و وضعیت <b>پرداخت ریالی</b> را مدیریت کنید.`,
    "",
    `${adminEmoji(AdminEmoji.REFRESH)} آخرین بروزرسانی: ${updatedAt}.`,
  ].join("\n");
}

export const adminSetMasterWalletPromptMessage = [
  `${adminEmoji(AdminEmoji.TRON)} <b>تنظیم ولت مستر</b>`,
  "",
  `${adminEmoji(AdminEmoji.DESC)} لطفاً <b>آدرس ولت مستر TRON</b> را در یک پیام ارسال کنید.`,
  "",
  `${adminEmoji(AdminEmoji.NOTIFY)} پس از هر واریز و شارژ کیف پول کاربر، مبلغ TRX واریزی به‌صورت خودکار به این آدرس منتقل می‌شود.`,
].join("\n");

export const adminSetCardPromptMessage = [
  `${adminEmoji(AdminEmoji.CARD)} <b>تنظیم شماره کارت</b>`,
  "",
  `${adminEmoji(AdminEmoji.DESC)} لطفاً <b>شماره کارت ۱۶ رقمی</b> را در یک پیام ارسال کنید.`,
].join("\n");

export const adminSetShebaPromptMessage = [
  `${adminEmoji(AdminEmoji.SHEBA)} <b>تنظیم شماره شبا</b>`,
  "",
  `${adminEmoji(AdminEmoji.DESC)} لطفاً <b>شماره شبا</b> را در یک پیام ارسال کنید (با یا بدون پیشوند IR).`,
].join("\n");

export function buildMasterWalletSavedMessage(address) {
  return [
    `${adminEmoji(AdminEmoji.CONFIRM)} <b>ولت مستر با موفقیت ذخیره شد</b>`,
    "",
    `<code>${address}</code>`,
  ].join("\n");
}

export function buildCardSavedMessage(cardNumber) {
  return [
    `${adminEmoji(AdminEmoji.CONFIRM)} <b>شماره کارت با موفقیت ذخیره شد</b>`,
    "",
    `<code>${formatCardNumber(cardNumber)}</code>`,
  ].join("\n");
}

export function buildShebaSavedMessage(shebaNumber) {
  return [
    `${adminEmoji(AdminEmoji.CONFIRM)} <b>شماره شبا با موفقیت ذخیره شد</b>`,
    "",
    `<code>${formatShebaNumber(shebaNumber)}</code>`,
  ].join("\n");
}
