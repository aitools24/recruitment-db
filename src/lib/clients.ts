import { z } from "zod";

export const CLIENT_STATUSES = ["Active", "On hold", "Inactive"] as const;
export const CLIENT_STATUS_COLOR: Record<string, string> = { Active: "#10b981", "On hold": "#f59e0b", Inactive: "#64748b" };

const text = (max = 200) => z.string().trim().max(max).transform((s) => s || null).nullable().optional();
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((s) => (s ? new Date(`${s}T00:00:00Z`) : null)).nullable().optional();
const int = (max: number) => z.union([z.literal(""), z.coerce.number().int().min(0).max(max)]).transform((v) => (v === "" ? null : v)).nullable().optional();

export const clientInput = z.object({
  name: z.string().trim().min(2, "Enter the client's name").max(120),
  industry: text(), location: text(), website: text(), gstin: text(20),
  contactName: text(), contactTitle: text(), contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid contact email")]).transform((s) => s || null).nullable().optional(),
  contactPhone: text(30),
  feePercent: z.union([z.literal(""), z.coerce.number().min(0).max(100)]).transform((v) => (v === "" ? null : v)).nullable().optional(),
  billingAfterDays: int(365), guaranteeDays: int(730),
  agreementStart: date, agreementEnd: date,
  status: z.enum(CLIENT_STATUSES).optional(),
  notes: text(5000),
});

/** Billing / guarantee days for a placement: the client's own terms when set, otherwise the workspace defaults. */
export function termsFor(
  client: { billingAfterDays: number | null; guaranteeDays: number | null } | null | undefined,
  tenant: { billingAfterDays: number; guaranteeDays: number },
) {
  return {
    billingAfterDays: client?.billingAfterDays ?? tenant.billingAfterDays,
    guaranteeDays: client?.guaranteeDays ?? tenant.guaranteeDays,
  };
}
