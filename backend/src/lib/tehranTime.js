/** Start of calendar day in Asia/Tehran (ISO instant). */
export function getTehranDayStart(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  return new Date(`${day}T00:00:00+03:30`);
}

/** @param {"today"|"week"|"month"|"all"} range */
export function getTehranRangeStart(range) {
  const dayStart = getTehranDayStart();
  if (range === "today") return dayStart;
  if (range === "week") {
    return new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  }
  if (range === "month") {
    return new Date(dayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
  }
  return null;
}
