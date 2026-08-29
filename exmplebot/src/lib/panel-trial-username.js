const USERNAME_PATTERN = /^[a-z]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 32;

export function normalizePanelTrialUsername(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function isValidPanelTrialUsername(raw) {
  const username = normalizePanelTrialUsername(raw);

  return (
    username.length >= MIN_LENGTH &&
    username.length <= MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}
