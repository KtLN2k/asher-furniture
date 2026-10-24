const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function cmFromMm(mm: number): number {
  return Math.round(mm) / 10;
}
