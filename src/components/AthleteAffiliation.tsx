import { countryFlag } from "@/lib/affiliation";

/**
 * Global athlete identity chip: name + affiliation (country flag/name for
 * international events, club/team name for national ones). Read-only display
 * shared by Judge A/B/C, the Chief console and the public screens.
 */
export function AthleteAffiliation({
  name,
  club,
  country,
  bib,
  compact = false,
  className = "",
}: {
  name?: string | null;
  club?: string | null;
  country?: string | null;
  bib?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const flag = countryFlag(country);
  const c = (country ?? "").trim();
  const k = (club ?? "").trim();

  return (
    <div className={`min-w-0 leading-tight ${className}`}>
      <p
        className={`truncate font-heading font-black text-white ${compact ? "text-[11px]" : "text-sm"}`}
        title={name ?? undefined}
      >
        {bib ? <span className="text-white/40 tabular-nums" dir="ltr">#{bib} </span> : null}
        {name || "—"}
      </p>
      <p
        className={`truncate font-bold text-white/60 ${compact ? "text-[9px]" : "text-[10px]"}`}
        title={[c, k].filter(Boolean).join(" · ")}
      >
        {c || k ? (
          <>
            {flag ? <span className="mr-1">{flag}</span> : null}
            {[c, k].filter(Boolean).join(" · ")}
          </>
        ) : (
          "—"
        )}
      </p>
    </div>
  );
}
