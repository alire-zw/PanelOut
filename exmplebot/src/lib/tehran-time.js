const tehranDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getTehranGregorianParts(date = new Date()) {
  const [year, month, day] = tehranDate.format(date).split("-");
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function toTehranMidnight({ year, month, day }) {
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+03:30`,
  );
}

export function getTehranStartOfDay(date = new Date()) {
  return toTehranMidnight(getTehranGregorianParts(date));
}

export function getTehranRollingWeekStart() {
  return new Date(getTehranStartOfDay().getTime() - 7 * 24 * 60 * 60 * 1000);
}

export function getTehranRollingMonthStart(date = new Date()) {
  const { year, month, day } = getTehranGregorianParts(date);
  let targetMonth = month - 1;
  let targetYear = year;

  if (targetMonth < 1) {
    targetMonth = 12;
    targetYear -= 1;
  }

  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

  return toTehranMidnight({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInTargetMonth),
  });
}

const jalaliDateTime = new Intl.DateTimeFormat("en-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatJalaliDateTime(date = new Date()) {
  const parts = jalaliDateTime.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}/${get("month")}/${get("day")} ساعت ${get("hour")}:${get("minute")}`;
}
