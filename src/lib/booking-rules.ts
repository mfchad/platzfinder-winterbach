import { supabase } from "@/integrations/supabase/client";
import type { BookingRule } from "./types";

let rulesCache: Record<string, string> | null = null;

export async function fetchRules(): Promise<Record<string, string>> {
  if (rulesCache) return rulesCache;
  const { data } = await supabase.from('booking_rules').select('*');
  const rules: Record<string, string> = {};
  (data as BookingRule[] || []).forEach(r => { rules[r.rule_key] = r.rule_value; });
  rulesCache = rules;
  return rules;
}

export function clearRulesCache() {
  rulesCache = null;
}

export function getRule(rules: Record<string, string>, key: string, fallback: string): string {
  return rules[key] || fallback;
}

export function getRuleNum(rules: Record<string, string>, key: string, fallback: number): number {
  const v = rules[key];
  return v ? parseInt(v, 10) : fallback;
}
