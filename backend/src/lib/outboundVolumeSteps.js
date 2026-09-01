export const DEFAULT_OUTBOUND_VOLUME_GB = 50;
export const MAX_OUTBOUND_VOLUME_GB = 10000;
export const OUTBOUND_TB_THRESHOLD_GB = 1000;

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

export function clampOutboundVolumeGb(gb) {
  const value = Math.trunc(Number(gb) || 0);
  if (!Number.isFinite(value)) return DEFAULT_OUTBOUND_VOLUME_GB;
  return Math.min(Math.max(value, DEFAULT_OUTBOUND_VOLUME_GB), MAX_OUTBOUND_VOLUME_GB);
}
