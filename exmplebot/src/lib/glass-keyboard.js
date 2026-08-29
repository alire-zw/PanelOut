export function truncateGlassValue(text, maxLength = 28) {
  const normalized = String(text ?? "—").trim() || "—";

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function resolveGlassStatusTone(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized || normalized === "—") {
    return null;
  }

  if (/تعلیق|غیرفعال|معلق|قطع|ناموفق/i.test(normalized)) {
    return "danger";
  }

  if (/فعال/i.test(normalized)) {
    return "success";
  }

  return null;
}

export function appendGlassValueBeforeLabelRow(
  keyboard,
  { value, label, icon, displayCb, tone = null },
) {
  const resolvedTone = tone ?? resolveGlassStatusTone(value);
  const valueBtn = keyboard.text(truncateGlassValue(value), displayCb);

  if (resolvedTone === "success") {
    valueBtn.success();
  } else if (resolvedTone === "danger") {
    valueBtn.danger();
  }

  keyboard.text(label, displayCb).icon(icon);
  keyboard.row();
}

export function appendGlassCopyPairRows(
  keyboard,
  {
    leftLabel,
    rightLabel,
    leftIcon,
    rightIcon,
    leftValue,
    rightValue,
    leftCopy,
    rightCopy,
    displayCb,
  },
) {
  keyboard.text(leftLabel, displayCb).icon(leftIcon);
  keyboard.text(rightLabel, displayCb).icon(rightIcon);
  keyboard.row();

  if (leftCopy) {
    keyboard.copyText(truncateGlassValue(leftValue), leftCopy);
  } else {
    keyboard.text(truncateGlassValue(leftValue), displayCb);
  }

  if (rightCopy) {
    keyboard.copyText(truncateGlassValue(rightValue), rightCopy);
  } else {
    keyboard.text(truncateGlassValue(rightValue), displayCb);
  }

  keyboard.row();
}

export function appendGlassFullUrlRow(keyboard, { text, url, displayCb }) {
  if (url) {
    keyboard.url(text, url);
  } else {
    keyboard.text(text, displayCb);
  }

  keyboard.row();
}
