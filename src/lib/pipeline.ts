// Stage colours are the validated categorical series in fixed order (see colors.ts SERIES).
// Placement pipeline: the stages a candidate moves through once they are put forward for a job,
// and the billing / guarantee timers that run from their joining date.

export const STAGES = [
  { key: "INTERNAL", label: "Submitted to internal team", short: "Internal review", color: "#3987e5" },
  { key: "CLIENT", label: "Submitted to client", short: "With client", color: "#d95926" },
  { key: "INTERVIEW", label: "Interview scheduled", short: "Interview", color: "#199e70" },
  { key: "OFFER", label: "Offer", short: "Offer", color: "#c98500" },
  { key: "ONBOARDING", label: "Onboarding", short: "Onboarding", color: "#d55181" },
  { key: "BILLING", label: "Billing", short: "Billing", color: "#0ca30c" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((s) => s.key) as [StageKey, ...StageKey[]];
export const stageInfo = (k: string | null | undefined) => STAGES.find((s) => s.key === k);
export const stageIndex = (k: string | null | undefined) => STAGES.findIndex((s) => s.key === k);

const DAY = 86400000;

/** Today's date in India, as UTC midnight, so it compares cleanly with DATE columns. */
export function todayIST(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now); // YYYY-MM-DD
  return new Date(`${ymd}T00:00:00Z`);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export type PlacementTimer = {
  joined: boolean;          // joining date has arrived
  daysSinceJoining: number; // negative before the joining date
  billableOn: Date;
  daysToBillable: number;   // <= 0 means billing can be raised
  guaranteeEndsOn: Date;
  daysToGuaranteeEnd: number;
  billed: boolean;
};

export function placementTimer(
  joiningDate: Date,
  terms: { billingAfterDays: number; guaranteeDays: number },
  billedOn: Date | null,
  now = new Date(),
): PlacementTimer {
  const today = todayIST(now);
  const since = Math.round((today.getTime() - joiningDate.getTime()) / DAY);
  const billableOn = addDays(joiningDate, terms.billingAfterDays);
  const guaranteeEndsOn = addDays(joiningDate, terms.guaranteeDays);
  return {
    joined: since >= 0,
    daysSinceJoining: since,
    billableOn,
    daysToBillable: terms.billingAfterDays - since,
    guaranteeEndsOn,
    daysToGuaranteeEnd: terms.guaranteeDays - since,
    billed: !!billedOn,
  };
}

/** Short label for lists, e.g. "Bill in 12d", "Ready to bill", "Guarantee 40d left". */
export function timerBadge(t: PlacementTimer): { text: string; tone: "wait" | "due" | "ok" } {
  if (!t.joined) return { text: `Joins in ${-t.daysSinceJoining}d`, tone: "wait" };
  if (!t.billed && t.daysToBillable > 0) return { text: `Bill in ${t.daysToBillable}d`, tone: "wait" };
  if (!t.billed) return { text: "Ready to bill", tone: "due" };
  if (t.daysToGuaranteeEnd > 0) return { text: `Guarantee ${t.daysToGuaranteeEnd}d left`, tone: "wait" };
  return { text: "Guarantee complete", tone: "ok" };
}
