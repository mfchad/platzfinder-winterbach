import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Info, Minus, Plus, Save } from "lucide-react";
import type { BookingRule } from "@/lib/types";

interface RuleMeta {
  key: string;
  label: string;
  hint: string;
  group: string;
  type: "number" | "boolean" | "weekdays";
}

const RULE_META: RuleMeta[] = [
  // Betriebszeiten
  { key: "day_start_hour", label: "Erster buchbarer Slot (Stunde)", hint: "Ab welcher Uhrzeit können Plätze gebucht werden?", group: "Betriebszeiten", type: "number" },
  { key: "day_end_hour", label: "Letzter Slot endet (Stunde)", hint: "Bis zu welcher Uhrzeit können Plätze gebucht werden?", group: "Betriebszeiten", type: "number" },
  { key: "slot_duration_minutes", label: "Slot-Dauer (Minuten)", hint: "Wie lang ist ein einzelner Buchungs-Slot in Minuten?", group: "Betriebszeiten", type: "number" },
  // Platz-Einstellungen
  { key: "courts_count", label: "Anzahl der Plätze", hint: "Wie viele Tennisplätze stehen zur Verfügung?", group: "Platz-Einstellungen", type: "number" },
  // Buchungs-Fenster
  { key: "booking_window_hours", label: "Buchungsvorlauf (Stunden)", hint: "Wie viele Stunden im Voraus darf ein Mitglied einen Platz buchen?", group: "Buchungs-Fenster", type: "number" },
  // Kernzeit-Regeln
  { key: "core_time_start", label: "Kernzeit Beginn (Stunde)", hint: "Ab welcher Uhrzeit gelten die strengeren Kernzeit-Limits?", group: "Kernzeit-Regeln", type: "number" },
  { key: "core_time_end", label: "Kernzeit Ende (Stunde)", hint: "Bis zu welcher Uhrzeit gelten die strengeren Kernzeit-Limits?", group: "Kernzeit-Regeln", type: "number" },
  { key: "core_time_days", label: "Kernzeit-Wochentage", hint: "An welchen Wochentagen gelten die Kernzeit-Regeln?", group: "Kernzeit-Regeln", type: "weekdays" },
  // Spiel-Limits
  { key: "single_max_per_day", label: "Einzel: Max. Stunden/Tag", hint: "Wie viele Stunden darf ein Mitglied pro Tag Einzel spielen (in der Kernzeit)?", group: "Spiel-Limits in der Kernzeit", type: "number" },
  { key: "single_max_per_week", label: "Einzel: Max. Stunden/Woche", hint: "Wie viele Stunden darf ein Mitglied pro Woche Einzel spielen (in der Kernzeit)?", group: "Spiel-Limits in der Kernzeit", type: "number" },
  { key: "double_max_per_day", label: "Doppel: Max. Stunden/Tag", hint: "Wie viele Stunden darf ein Mitglied pro Tag Doppel spielen (in der Kernzeit)?", group: "Spiel-Limits in der Kernzeit", type: "number" },
  { key: "double_max_per_week", label: "Doppel: Max. Stunden/Woche", hint: "Wie viele Stunden darf ein Mitglied pro Woche Doppel spielen (in der Kernzeit)?", group: "Spiel-Limits in der Kernzeit", type: "number" },
  // Halbbuchungen
  { key: "half_booking_max_hours", label: "Max. Vorlauf (Stunden)", hint: "Bis wie viele Stunden vor Beginn kann eine Halbbuchung erstellt werden?", group: "Halbbuchungen", type: "number" },
  { key: "half_booking_min_hours", label: "Min. Vorlauf (Stunden)", hint: "Mindestens wie viele Stunden vor Beginn muss eine Halbbuchung erstellt werden?", group: "Halbbuchungen", type: "number" },
  { key: "half_booking_expiry_hours", label: "Stornierung bei fehlendem Partner (Stunden vor Beginn)", hint: "Wenn eine Halbbuchung bis zu diesem Zeitpunkt nicht vervollständigt wurde, wird sie automatisch gelöscht, um den Platz für andere freizugeben.", group: "Halbbuchungen", type: "number" },
  // System
  { key: "email_notifications_enabled", label: "E-Mail-Benachrichtigungen", hint: "Sollen E-Mail-Benachrichtigungen bei Buchungsänderungen versendet werden?", group: "System", type: "boolean" },
];

const WEEKDAYS = [
  { value: "1", label: "Mo" },
  { value: "2", label: "Di" },
  { value: "3", label: "Mi" },
  { value: "4", label: "Do" },
  { value: "5", label: "Fr" },
  { value: "6", label: "Sa" },
  { value: "7", label: "So" },
];

const GROUP_ORDER = [
  "Betriebszeiten",
  "Platz-Einstellungen",
  "Buchungs-Fenster",
  "Kernzeit-Regeln",
  "Spiel-Limits in der Kernzeit",
  "Halbbuchungen",
  "System",
];

function HintIcon({ hint }: { hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-sm">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

function NumberStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(Math.max(0, value - 1))}>
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="number"
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-20 text-center h-8"
      />
      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(value + 1)}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

function WeekdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value.split(",").filter(Boolean);
  const toggle = (day: string) => {
    const next = selected.includes(day)
      ? selected.filter(d => d !== day)
      : [...selected, day].sort();
    onChange(next.join(","));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAYS.map(wd => (
        <label key={wd.value} className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={selected.includes(wd.value)}
            onCheckedChange={() => toggle(wd.value)}
          />
          <span className="text-sm">{wd.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function RulesTab() {
  const [rules, setRules] = useState<BookingRule[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { data } = await supabase.from("booking_rules").select("*").order("rule_key");
    setRules((data as BookingRule[]) || []);
    setEditedValues({});
  }, []);

  useEffect(() => { load(); }, [load]);

  const getValue = (key: string): string => {
    const rule = rules.find(r => r.rule_key === key);
    if (!rule) return "";
    return editedValues[rule.id] ?? rule.rule_value;
  };

  const setValue = (key: string, val: string) => {
    const rule = rules.find(r => r.rule_key === key);
    if (!rule) return;
    setEditedValues(prev => ({ ...prev, [rule.id]: val }));
  };

  const hasChanges = Object.keys(editedValues).some(id => {
    const rule = rules.find(r => r.id === id);
    return rule && editedValues[id] !== rule.rule_value;
  });

  const handleSaveAll = async () => {
    const changed = Object.entries(editedValues).filter(([id, val]) => {
      const rule = rules.find(r => r.id === id);
      return rule && val !== rule.rule_value;
    });
    for (const [id, value] of changed) {
      const { error } = await supabase.from("booking_rules").update({ rule_value: value, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Gespeichert", description: `${changed.length} Regel(n) aktualisiert.` });
    load();
  };

  // Group rules
  const grouped = GROUP_ORDER.map(group => ({
    group,
    items: RULE_META.filter(m => m.group === group),
  }));

  // Check for half_booking_max_hours > booking_window_hours conflict
  const halfMaxHours = parseInt(getValue("half_booking_max_hours")) || 0;
  const bookingWindowHours = parseInt(getValue("booking_window_hours")) || 0;
  const showHalfBookingHint = halfMaxHours > bookingWindowHours && bookingWindowHours > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Regelwerk</h2>
          <Button onClick={handleSaveAll} disabled={!hasChanges} size="sm">
            <Save className="h-4 w-4 mr-1" /> Änderungen speichern
          </Button>
        </div>

        {showHalfBookingHint && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-200">
            <strong>Hinweis:</strong> Da das allgemeine Buchungs-Fenster auf {bookingWindowHours} Stunden begrenzt ist, können Halbbuchungen trotz dieser Einstellung nicht früher als {bookingWindowHours} Stunden im Voraus getätigt werden.
          </div>
        )}

        {grouped.map(({ group, items }) => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">{group}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map(meta => {
                const val = getValue(meta.key);
                return (
                  <div key={meta.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:w-[280px] shrink-0">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <HintIcon hint={meta.hint} />
                    </div>
                    <div>
                      {meta.type === "number" && (
                        <NumberStepper
                          value={parseInt(val) || 0}
                          onChange={v => setValue(meta.key, String(v))}
                        />
                      )}
                      {meta.type === "boolean" && (
                        <Switch
                          checked={val === "true"}
                          onCheckedChange={c => setValue(meta.key, c ? "true" : "false")}
                        />
                      )}
                      {meta.type === "weekdays" && (
                        <WeekdayPicker
                          value={val}
                          onChange={v => setValue(meta.key, v)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
