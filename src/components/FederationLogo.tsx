/**
 * FederationLogo — standardized branding for ALL dashboard headers.
 *
 * Variants:
 *  - "header" (DEFAULT): horizontal compact lockup for top bars (logo + 2-line title).
 *      Use this in every dashboard header for visual consistency across TA / Chief / Judge A/B/C.
 *  - "sm" / "md" / "lg": legacy stacked variants for login screens / hero areas.
 */
type Size = "sm" | "md" | "lg" | "header";

const dims: Record<Size, string> = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-28 w-28",
  header: "h-10 w-10",
};

const textSize: Record<Size, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  header: "text-[11px]",
};

export function FederationLogo({ size = "md" }: { size?: Size }) {
  if (size === "header") {
    // Horizontal lockup — used inside dashboard top bars
    return (
      <div className="flex items-center gap-2.5 min-w-0" dir="rtl">
        <img
          src="/images/federation-logo.jfif"
          alt="شعار الجامعة التونسية للووشو كونغ فو"
          className="h-10 w-10 rounded-full object-cover ring-1 ring-gold/40 shadow-[0_0_12px_oklch(0.78_0.12_85_/_0.25)] shrink-0"
        />
        <div className="leading-tight min-w-0 font-arabic">
          <p className="text-[11px] font-heading font-bold text-gold tracking-wide truncate">
            الجامعة التونسية للووشو كونغ فو
          </p>
          <p className="text-[10px] text-muted-foreground truncate">بطولة الحامة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src="/images/federation-logo.jfif"
        alt="شعار الجامعة التونسية للووشو كونغ فو"
        className={`${dims[size]} rounded-full object-cover ring-1 ring-gold/40`}
      />
      <p className={`${textSize[size]} font-heading font-bold text-gold tracking-wider text-center`}>
        الجامعة التونسية للووشو كونغ فو
      </p>
    </div>
  );
}
