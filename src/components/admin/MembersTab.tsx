import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Upload, Save, AlertTriangle, FileSpreadsheet, Search, ChevronDown, Pencil, Undo2, Mail, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import type { Member } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";

const PAGE_SIZE = 50;

type EditableMember = {
  vorname: string;
  nachname: string;
  geburtsjahr: number;
  email: string;
};

export default function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [geburtsjahr, setGeburtsjahr] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkParsedRows, setBulkParsedRows] = useState<Array<{ vorname: string; nachname: string; geburtsjahr: number; email: string | null }>>([]);
  const [bulkSheetCount, setBulkSheetCount] = useState(0);
  const [bulkFileName, setBulkFileName] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [dirtyRows, setDirtyRows] = useState<Record<string, EditableMember>>({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingSearch, setPendingSearch] = useState("");
  const [showSearchWarning, setShowSearchWarning] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    const { data } = await supabase.from("members").select("*").order("nachname");
    setMembers((data as Member[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addMember = async () => {
    if (!vorname.trim() || !nachname.trim() || !geburtsjahr.trim()) {
      toast({ title: "Fehler", description: "Pflichtfelder ausfüllen.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("members").insert({
      vorname: vorname.trim(), nachname: nachname.trim(),
      geburtsjahr: parseInt(geburtsjahr), email: email.trim() || null,
    });
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Erfolg", description: "Mitglied hinzugefügt." });
    setVorname(""); setNachname(""); setGeburtsjahr(""); setEmail("");
    load();
  };

  const deleteMember = async (id: string) => {
    await supabase.from("members").delete().eq("id", id);
    load();
  };

  const HEADER_MAP: Record<string, keyof typeof FIELD_KEYS> = {
    vorname: "vorname", "first name": "vorname", "firstname": "vorname",
    nachname: "nachname", "last name": "nachname", "lastname": "nachname",
    "e-mail": "email", email: "email", mail: "email",
    geburtsjahr: "geburtsjahr", year: "geburtsjahr", "birth year": "geburtsjahr", jahrgang: "geburtsjahr",
  };
  const FIELD_KEYS = { vorname: true, nachname: true, geburtsjahr: true, email: true } as const;

  const parseSheetData = (sheet: XLSX.WorkSheet) => {
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    if (json.length === 0) return [];
    const headers = Object.keys(json[0]);
    const colMap: Record<string, string> = {};
    for (const h of headers) {
      const normalized = h.toLowerCase().trim();
      if (HEADER_MAP[normalized]) colMap[HEADER_MAP[normalized]] = h;
    }
    if (!colMap.vorname || !colMap.nachname) {
      toast({ title: "Fehler", description: "Spalten 'Vorname' und 'Nachname' nicht gefunden.", variant: "destructive" });
      return [];
    }
    return json.map(row => ({
      vorname: String(row[colMap.vorname] || "").trim(),
      nachname: String(row[colMap.nachname] || "").trim(),
      geburtsjahr: parseInt(String(row[colMap.geburtsjahr] || "0")) || 0,
      email: colMap.email ? (String(row[colMap.email] || "").trim() || null) : null,
    })).filter(r => r.vorname && r.nachname);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      setBulkSheetCount(workbook.SheetNames.length);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = parseSheetData(sheet);
      setBulkParsedRows(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkCsvParse = () => {
    const lines = bulkText.trim().split("\n").filter(l => l.trim());
    const rows: typeof bulkParsedRows = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length >= 2) {
        rows.push({
          vorname: parts[0], nachname: parts[1],
          geburtsjahr: parseInt(parts[2]) || 0, email: parts[3] || null,
        });
      }
    }
    setBulkParsedRows(rows);
  };

  const handleBulkImport = async () => {
    if (bulkParsedRows.length === 0) {
      toast({ title: "Fehler", description: "Keine gültigen Daten gefunden.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("members").insert(bulkParsedRows);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Erfolg", description: `${bulkParsedRows.length} Mitglieder importiert.` });
    setBulkText(""); setBulkParsedRows([]); setBulkFileName(""); setShowBulk(false);
    load();
  };

  const filtered = useMemo(() =>
    members.filter(m =>
      !search || `${m.vorname} ${m.nachname} ${m.email || ""}`.toLowerCase().includes(search.toLowerCase())
    ), [members, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search]);

  const hasDirty = Object.keys(dirtyRows).length > 0;
  const hasPendingDeletions = pendingDeletions.size > 0;
  const hasUnsavedChanges = hasDirty || hasPendingDeletions;

  const togglePendingDeletion = (id: string) => {
    setPendingDeletions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSearchChange = (value: string) => {
    if (hasUnsavedChanges) {
      setPendingSearch(value);
      setShowSearchWarning(true);
    } else {
      setSearch(value);
    }
  };

  const confirmSearchWithDirty = () => {
    setDirtyRows({});
    setPendingDeletions(new Set());
    setSearch(pendingSearch);
    setShowSearchWarning(false);
  };

  const getCellValue = (member: Member, field: keyof EditableMember): string => {
    if (dirtyRows[member.id]) {
      const val = dirtyRows[member.id][field];
      return val !== undefined ? String(val) : String(member[field] ?? "");
    }
    return String(member[field] ?? "");
  };

  const handleCellChange = (memberId: string, field: keyof EditableMember, value: string, member: Member) => {
    setDirtyRows(prev => {
      const existing = prev[memberId] || {
        vorname: member.vorname,
        nachname: member.nachname,
        geburtsjahr: member.geburtsjahr,
        email: member.email || "",
      };
      return {
        ...prev,
        [memberId]: { ...existing, [field]: field === "geburtsjahr" ? (value === "" ? 0 : parseInt(value)) : value },
      };
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    memberId: string,
    field: keyof EditableMember,
    rowIndex: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextRowIdx = rowIndex + 1;
      if (nextRowIdx < paginatedMembers.length) {
        const nextMemberId = paginatedMembers[nextRowIdx].id;
        const ref = inputRefs.current[`${nextMemberId}-${field}`];
        ref?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDirtyRows(prev => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      (e.target as HTMLInputElement).blur();
    }
  };

  const saveChanges = async () => {
    let errorCount = 0;
    const updateIds = Object.keys(dirtyRows).filter(id => !pendingDeletions.has(id));
    for (const id of updateIds) {
      const row = dirtyRows[id];
      const { error } = await supabase.from("members").update({
        vorname: row.vorname,
        nachname: row.nachname,
        geburtsjahr: row.geburtsjahr,
        email: row.email || null,
      }).eq("id", id);
      if (error) errorCount++;
    }
    const deleteIds = Array.from(pendingDeletions);
    for (const id of deleteIds) {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) errorCount++;
    }
    if (errorCount > 0) {
      toast({ title: "Fehler", description: `${errorCount} Vorgang/Vorgänge fehlgeschlagen.`, variant: "destructive" });
    } else {
      const parts: string[] = [];
      if (updateIds.length > 0) parts.push(`${updateIds.length} aktualisiert`);
      if (deleteIds.length > 0) parts.push(`${deleteIds.length} gelöscht`);
      toast({ title: "Erfolg", description: parts.join(", ") + "." });
    }
    setDirtyRows({});
    setPendingDeletions(new Set());
    setShowSaveConfirm(false);
    load();
  };

  const handleEditModeToggle = (checked: boolean) => {
    if (!checked && hasUnsavedChanges) {
      setShowSaveConfirm(true);
      return;
    }
    setIsEditMode(checked);
    if (!checked) { setDirtyRows({}); setPendingDeletions(new Set()); }
  };

  const toggleCardExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const paginationPages = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const saveButtonLabel = () => {
    if (hasDirty && !hasPendingDeletions) return `Speichern (${Object.keys(dirtyRows).length})`;
    if (!hasDirty && hasPendingDeletions) return `Speichern (${pendingDeletions.size} Löschungen)`;
    if (hasDirty && hasPendingDeletions) return `Speichern (${Object.keys(dirtyRows).length} + ${pendingDeletions.size})`;
    return "Speichern";
  };

  return (
    <div className="space-y-4">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-3 pt-1 -mx-4 px-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">Mitglieder</h2>
            <Badge variant="secondary" className="text-xs font-normal bg-muted text-muted-foreground">
              {members.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Button
                size="sm"
                onClick={() => setShowSaveConfirm(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Save className="h-4 w-4 mr-1" />
                {saveButtonLabel()}
              </Button>
            )}
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 border transition-colors ${isEditMode ? 'border-[hsl(var(--club-gold))] bg-[hsl(var(--club-gold-light))]' : 'border-border bg-muted/50'}`}>
              <Label htmlFor="edit-mode-toggle" className="text-sm font-medium cursor-pointer select-none whitespace-nowrap">
                Bearbeiten
              </Label>
              <Switch
                id="edit-mode-toggle"
                checked={isEditMode}
                onCheckedChange={handleEditModeToggle}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowBulk(true)} className="text-muted-foreground">
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mitglieder suchen…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-9 w-full sm:max-w-sm bg-card"
          />
        </div>
      </div>

      {/* Edit mode alert */}
      {isEditMode && (
        <Alert className="border-[hsl(var(--club-gold))] bg-[hsl(var(--club-gold-light))]">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--club-gold))]" />
          <AlertDescription className="text-foreground text-sm">
            <strong>Bearbeitungsmodus aktiv.</strong> Änderungen werden erst nach dem Speichern übernommen.
          </AlertDescription>
        </Alert>
      )}

      {/* Add member form */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[100px]">
              <Label className="text-xs text-muted-foreground">Vorname*</Label>
              <Input value={vorname} onChange={e => setVorname(e.target.value)} className="h-9" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <Label className="text-xs text-muted-foreground">Nachname*</Label>
              <Input value={nachname} onChange={e => setNachname(e.target.value)} className="h-9" />
            </div>
            <div className="w-24">
              <Label className="text-xs text-muted-foreground">Jahrgang*</Label>
              <Input value={geburtsjahr} onChange={e => setGeburtsjahr(e.target.value)} type="number" className="h-9" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">E-Mail</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" className="h-9" />
            </div>
            <Button size="sm" onClick={addMember} className="h-9 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1" />Hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Card view */}
      {isMobile ? (
        <div className="space-y-2">
          {paginatedMembers.map(m => {
            const isMarkedForDeletion = pendingDeletions.has(m.id);
            const isDirty = !!dirtyRows[m.id];
            const isExpanded = expandedCards.has(m.id);

            return (
              <Card
                key={m.id}
                className={`border transition-all ${
                  isMarkedForDeletion ? 'opacity-50 border-destructive' :
                  isDirty ? 'border-[hsl(var(--club-gold))]' :
                  'border-border/60'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${isMarkedForDeletion ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {isEditMode && dirtyRows[m.id] ? `${dirtyRows[m.id].vorname} ${dirtyRows[m.id].nachname}` : `${m.vorname} ${m.nachname}`}
                      </p>
                      {(m.email || dirtyRows[m.id]?.email) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          {isEditMode && dirtyRows[m.id] ? dirtyRows[m.id].email : m.email}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isMarkedForDeletion && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Storniert</Badge>
                      )}
                      {isEditMode && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleCardExpanded(m.id)}>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      )}
                      {!isEditMode && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {m.geburtsjahr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded edit area */}
                  {isEditMode && isExpanded && !isMarkedForDeletion && (
                    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Vorname</Label>
                          <Input
                            value={getCellValue(m, "vorname")}
                            onChange={e => handleCellChange(m.id, "vorname", e.target.value, m)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nachname</Label>
                          <Input
                            value={getCellValue(m, "nachname")}
                            onChange={e => handleCellChange(m.id, "nachname", e.target.value, m)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Geburtsjahr</Label>
                          <Input
                            type="number"
                            value={getCellValue(m, "geburtsjahr")}
                            onChange={e => handleCellChange(m.id, "geburtsjahr", e.target.value, m)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">E-Mail</Label>
                          <Input
                            type="email"
                            value={getCellValue(m, "email")}
                            onChange={e => handleCellChange(m.id, "email", e.target.value, m)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
                        onClick={() => togglePendingDeletion(m.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Löschen vormerken
                      </Button>
                    </div>
                  )}

                  {/* Undo deletion */}
                  {isEditMode && isMarkedForDeletion && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground w-full"
                        onClick={() => togglePendingDeletion(m.id)}
                      >
                        <Undo2 className="h-4 w-4 mr-1" /> Rückgängig
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Desktop: Table view */
        <div className={`overflow-x-auto relative rounded-xl bg-white shadow-[0_1px_6px_0_rgba(0,0,0,0.06)] border transition-shadow ${isEditMode ? 'shadow-[0_0_0_2px_hsl(var(--club-gold)/0.4)] border-[hsl(var(--club-gold)/0.6)]' : 'border-slate-200'}`}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-100">
                <TableHead className="sticky left-0 z-10 bg-slate-50 min-w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vorname</TableHead>
                <TableHead className="sticky left-[120px] z-10 bg-slate-50 min-w-[120px] border-r border-slate-100 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nachname</TableHead>
                <TableHead className="min-w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jahrgang</TableHead>
                <TableHead className="min-w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-Mail</TableHead>
                {isEditMode && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.map((m, rowIndex) => {
                const isDirty = !!dirtyRows[m.id];
                const isMarkedForDeletion = pendingDeletions.has(m.id);
                return (
                  <TableRow
                    key={m.id}
                    className={`transition-colors border-b border-slate-100 ${
                      isMarkedForDeletion ? "bg-destructive/5 opacity-60" :
                      isDirty ? "bg-[hsl(var(--club-gold-light))]" : "bg-white"
                    }`}
                  >
                    {(["vorname", "nachname", "geburtsjahr", "email"] as const).map((field) => {
                      const stickyClass = field === "vorname"
                        ? "sticky left-0 z-10 bg-inherit"
                        : field === "nachname"
                        ? "sticky left-[120px] z-10 bg-inherit border-r border-border/40"
                        : "";

                      return (
                        <TableCell key={field} className={stickyClass}>
                          {isEditMode && !isMarkedForDeletion ? (
                            <Input
                              ref={(el) => { inputRefs.current[`${m.id}-${field}`] = el; }}
                              type={field === "email" ? "email" : field === "geburtsjahr" ? "number" : "text"}
                              value={getCellValue(m, field)}
                              onChange={e => handleCellChange(m.id, field, e.target.value, m)}
                              onKeyDown={e => handleKeyDown(e, m.id, field, rowIndex)}
                              className="h-8 text-sm border-transparent hover:border-input focus:border-ring focus:ring-1 focus:ring-ring bg-transparent transition-colors"
                            />
                          ) : (
                            <span className={`text-sm ${isMarkedForDeletion ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {field === "email" ? (m[field] || "–") : m[field]}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    {isEditMode && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => togglePendingDeletion(m.id)}
                          title={isMarkedForDeletion ? "Rückgängig" : "Löschen"}
                        >
                          {isMarkedForDeletion ? (
                            <Undo2 className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {paginationPages.map((page, i) =>
              page === "ellipsis" ? (
                <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={currentPage === page}
                    onClick={() => setCurrentPage(page as number)}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Search warning dialog */}
      <Dialog open={showSearchWarning} onOpenChange={setShowSearchWarning}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Ungespeicherte Änderungen</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sie haben {Object.keys(dirtyRows).length} ungespeicherte Änderung(en). Möchten Sie diese verwerfen?
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowSearchWarning(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={confirmSearchWithDirty}>Verwerfen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save confirmation dialog */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Änderungen speichern</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            {Object.keys(dirtyRows).filter(id => !pendingDeletions.has(id)).length > 0 && (
              <p>📝 {Object.keys(dirtyRows).filter(id => !pendingDeletions.has(id)).length} Änderung(en) speichern</p>
            )}
            {pendingDeletions.size > 0 && (
              <p className="text-destructive font-medium">🗑️ {pendingDeletions.size} Mitglied(er) dauerhaft löschen</p>
            )}
            <p className="mt-2">Möchten Sie fortfahren?</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>Abbrechen</Button>
            <Button variant={hasPendingDeletions ? "destructive" : "default"} onClick={saveChanges}>
              {hasPendingDeletions ? "Speichern & Löschen" : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk upload dialog */}
      <Dialog open={showBulk} onOpenChange={(open) => {
        setShowBulk(open);
        if (!open) { setBulkParsedRows([]); setBulkText(""); setBulkFileName(""); setBulkSheetCount(0); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Mitglieder Import</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Excel- oder CSV-Datei hochladen</Label>
            <input
              ref={(el) => { inputRefs.current["__file__"] = el; }}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => (inputRefs.current["__file__"] as any)?.click()} className="gap-2">
                <Upload className="h-4 w-4" /> Datei auswählen
              </Button>
              {bulkFileName && <span className="text-sm text-muted-foreground">Datei: <strong>{bulkFileName}</strong></span>}
            </div>
            {bulkSheetCount > 1 && (
              <p className="text-xs text-muted-foreground">ℹ️ Die Datei enthält {bulkSheetCount} Blätter – nur das erste wird importiert.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Oder CSV-Daten einfügen</Label>
            <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={4}
              placeholder="Max,Mustermann,1984,max@email.de&#10;Anna,Schmidt,1990" />
            {bulkText.trim() && bulkParsedRows.length === 0 && (
              <Button size="sm" variant="outline" onClick={handleBulkCsvParse}>Vorschau laden</Button>
            )}
          </div>
          {bulkParsedRows.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vorschau ({bulkParsedRows.length} Einträge)</Label>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs py-1 px-2">Vorname</TableHead>
                      <TableHead className="text-xs py-1 px-2">Nachname</TableHead>
                      <TableHead className="text-xs py-1 px-2">Jahrgang</TableHead>
                      <TableHead className="text-xs py-1 px-2">E-Mail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkParsedRows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-1 px-2">{r.vorname}</TableCell>
                        <TableCell className="text-xs py-1 px-2">{r.nachname}</TableCell>
                        <TableCell className="text-xs py-1 px-2">{r.geburtsjahr || "-"}</TableCell>
                        <TableCell className="text-xs py-1 px-2">{r.email || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {bulkParsedRows.length > 5 && (
                <p className="text-xs text-muted-foreground">… und {bulkParsedRows.length - 5} weitere</p>
              )}
            </div>
          )}
          <Button onClick={handleBulkImport} disabled={bulkParsedRows.length === 0} className="bg-primary text-primary-foreground">
            {bulkParsedRows.length > 0 ? `Import starten (${bulkParsedRows.length})` : "Import starten"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
