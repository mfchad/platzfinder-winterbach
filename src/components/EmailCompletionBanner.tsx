import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MemberEmailDialog from "./MemberEmailDialog";

const STORAGE_KEY = "email_banner_dismissed_at";
const REAPPEAR_DAYS = 7;

export default function EmailCompletionBanner() {
  const [stats, setStats] = useState<{ filled: number; total: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const loadStats = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_email_completion_stats");
    if (!error && data && data[0]) {
      setStats({ filled: Number(data[0].filled), total: Number(data[0].total) });
    }
  }, []);

  useEffect(() => {
    const ts = localStorage.getItem(STORAGE_KEY);
    if (ts) {
      const ageDays = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
      if (ageDays < REAPPEAR_DAYS) setDismissed(true);
    }
    loadStats();

    const channel = supabase
      .channel("members-email-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => {
        loadStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadStats]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setDismissed(true);
  };

  if (dismissed || !stats || stats.total === 0) return null;
  const pct = Math.round((stats.filled / stats.total) * 100);

  return (
    <>
      <div
        className="relative rounded-lg border shadow-sm overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsla(38, 63%, 96%, 1) 0%, hsla(38, 63%, 90%, 1) 100%)",
          borderColor: "hsl(var(--club-gold))",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "hsl(var(--club-navy))" }}
          >
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base" style={{ color: "hsl(var(--club-navy))" }}>
              Hilf uns, den Club zu digitalisieren!
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Aktueller Stand: <strong>{stats.filled}</strong> / {stats.total} E-Mail-Adressen erfasst
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: "hsl(var(--club-gold))" }}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="flex-shrink-0 text-white"
            style={{ background: "hsl(var(--club-navy))" }}
          >
            E-Mail jetzt ergänzen
          </Button>
          <button
            onClick={handleDismiss}
            className="absolute top-1 right-1 p-1 rounded hover:bg-black/5 text-muted-foreground"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <MemberEmailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={loadStats}
      />
    </>
  );
}
