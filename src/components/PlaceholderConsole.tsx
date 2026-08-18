import { useCompetition } from "@/store/competition-store";
import { useLogout } from "@/hooks/useLogout";
import { FederationLogo } from "./FederationLogo";
import { ArrowRight } from "lucide-react";


const ROLE_LABELS: Record<string, string> = {
  "assistant-referee": "Assistant Referee",
  "a-quality-judge": "Judge A — Quality",
  "b-performance-judge": "Judge B — Performance",
  "c-difficulty-judge": "Judge C — Difficulty",
};

const STYLE_LABELS: Record<string, string> = {
  changquan: "Changquan",
  nanquan: "Nanquan",
  taijiquan: "Taijiquan",
  traditional: "Traditional",
};

export function PlaceholderConsole() {
  const { selectedRole, competitionStyle, setSelectedRole, logout } = useCompetition();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedRole(null)} className="h-9 w-9 rounded-lg bg-navy-light flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="h-4 w-4" />
            </button>
            <FederationLogo size="sm" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gold font-heading font-semibold px-3 py-1 rounded-full border border-gold/30 bg-gold/10" dir="ltr">
              {selectedRole ? ROLE_LABELS[selectedRole] : ""}
            </span>
            <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">خروج</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8 text-center mt-20">
        <div className="rounded-2xl border border-dashed border-navy-lighter bg-card p-12">
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2" dir="ltr">
            {selectedRole ? ROLE_LABELS[selectedRole] : ""} Panel
          </h2>
          <p className="text-muted-foreground font-body mb-4">سيتم بناء هذه اللوحة في المرحلة التالية.</p>
          {competitionStyle && (
            <p className="text-sm text-fed-red font-body">
              Active Style: <span className="font-semibold" dir="ltr">{STYLE_LABELS[competitionStyle] || competitionStyle}</span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
