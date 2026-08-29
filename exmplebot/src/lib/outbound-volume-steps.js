export const DEFAULT_OUTBOUND_VOLUME_GB = 50;
export const MAX_OUTBOUND_VOLUME_GB = 10000;
export const OUTBOUND_TB_THRESHOLD_GB = 1000;

function formatTerabyteValue(gb) {
  const tb = gb / OUTBOUND_TB_THRESHOLD_GB;

  if (Number.isInteger(tb)) {
    return `${tb.toLocaleString("en-US")} ترابایت`;
  }

  return `${tb.toLocaleString("en-US", { maximumFractionDigits: 1 })} ترابایت`;
}

export function formatOutboundVolumeLabel(gb) {
  if (gb < OUTBOUND_TB_THRESHOLD_GB) {
    return `${Number(gb).toLocaleString("en-US")} گیگ`;
  }

  return formatTerabyteValue(gb);
}

export function formatOutboundVolumeText(gb) {
  if (gb < OUTBOUND_TB_THRESHOLD_GB) {
    return `${Number(gb).toLocaleString("en-US")} گیگابایت`;
  }

  return formatTerabyteValue(gb);
}

export function getNextOutboundVolumeGb(gb) {
  if (gb < DEFAULT_OUTBOUND_VOLUME_GB) {
    return DEFAULT_OUTBOUND_VOLUME_GB;
  }

  if (gb >= MAX_OUTBOUND_VOLUME_GB) {
    return MAX_OUTBOUND_VOLUME_GB;
  }

  if (gb === DEFAULT_OUTBOUND_VOLUME_GB) {
    return 100;
  }

  if (gb < 500) {
    return gb + 100;
  }

  if (gb < 2000) {
    return gb + 500;
  }

  return Math.min(gb + 1000, MAX_OUTBOUND_VOLUME_GB);
}

export function getPrevOutboundVolumeGb(gb) {
  if (gb <= DEFAULT_OUTBOUND_VOLUME_GB) {
    return DEFAULT_OUTBOUND_VOLUME_GB;
  }

  if (gb === 100) {
    return DEFAULT_OUTBOUND_VOLUME_GB;
  }

  if (gb <= 500) {
    return gb - 100;
  }

  if (gb <= 2000) {
    return gb - 500;
  }

  return gb - 1000;
}
