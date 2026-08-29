const USERNAME_PATTERN = /^[a-z]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 32;

export function normalizePanelUsername(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function isValidPanelUsername(raw) {
  const username = normalizePanelUsername(raw);
  return (
    username.length >= MIN_LENGTH &&
    username.length <= MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}

export function panelUsernameError(raw) {
  const username = normalizePanelUsername(raw);
  if (!username) return "نام کاربری را وارد کنید";
  if (username.length < MIN_LENGTH || username.length > MAX_LENGTH) {
    return "نام کاربری باید بین ۳ تا ۳۲ کاراکتر باشد";
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "فقط حروف انگلیسی کوچک مجاز است";
  }
  return null;
}
