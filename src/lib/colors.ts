// Fixed colour assignments. Colour follows the entity (never its rank), so a source keeps its colour on every screen.
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"] as const;
export const NEUTRAL = "#64748b";

export const SOURCE_COLOR: Record<string, string> = {
  LinkedIn: SERIES[0], Naukri: SERIES[1], Referral: SERIES[2], "Job portal": SERIES[3],
  "Walk-in": SERIES[4], "Resume upload": SERIES[5], Other: SERIES[6],
};

export const STATUS_COLOR: Record<string, string> = {
  Active: "#10b981", Placed: "#8b5cf6", "Not looking": "#f59e0b", "Do not contact": "#f43f5e",
};

export const ROLE_COLOR: Record<string, string> = { ADMIN: "#f43f5e", MANAGER: "#8b5cf6", RECRUITER: "#14b8a6", VIEWER: "#64748b" };

export function actionColor(action: string) {
  if (action === "DELETE") return "#f43f5e";
  if (action === "EXPORT" || action === "RESUME_DOWNLOAD") return "#f59e0b";
  if (action === "IMPORT" || action === "RESUME_UPLOAD") return "#14b8a6";
  if (action === "CREATE") return "#10b981";
  if (action === "MERGE") return "#8b5cf6";
  if (action.startsWith("USER") || action === "SETTINGS" || action === "LOGIN") return "#ec4899";
  return "#3b82f6";
}

/** Inline style that feeds the accent-badge / accent-chip utilities. */
export const accent = (c: string) => ({ ["--accent" as string]: c }) as React.CSSProperties;
