import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Upload, Save, AlertTriangle } from "lucide-react";
import type { Member } from "@/lib/types";

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [dirtyRows, setDirtyRows] = useState<Record<string, EditableMember>>({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingSearch, setPendingSearch] = useState("");
  const [showSearchWarning, setShowSearchWarning] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

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

  const handleBulkUpload = async () => {
    const lines = bulkText.trim().split("\n").filter(l => l.trim());
    const toInsert: any[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length >= 3) {
        toInsert.push({
          vorname: parts[0], nachname: parts[1],
          geburtsjahr: parseInt(parts[2]), email: parts[3] || null,
        });
      }
    }
    if (toInsert.length === 0) {
      toast({ title: "Fehler", description: "Keine gültigen Daten gefunden.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("members").insert(toInsert);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Erfolg", description: `${toInsert.length} Mitglieder importiert.` });
    setBulkText(""); setShowBulk(false);
    load();
  };

  const filtered = useMemo(() =>
    members.filter(m =>
      !search || `${m.vorname} ${m.nachname}`.toLowerCase().includes(search.toLowerCase())
    ), [members, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [search]);

  const hasDirty = Object.keys(dirtyRows).length > 0;

  const handleSearchChange = (value: string) => {
    if (hasDirty) {
      setPendingSearch(value);
      setShowSearchWarning(true);
    } else {
      setSearch(value);
    }
  };

  const confirmSearchWithDirty = () => {
    setDirtyRows({});
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
    const fields: (keyof EditableMember)[] = ["vorname", "nachname", "geburtsjahr", "email"];
    const fieldIdx = fields.indexOf(field);

    if (e.key === "Tab") {
      // default browser tab behavior works
    } else if (e.key === "Enter") {
      e.preventDefault();
      const nextRowIdx = rowIndex + 1;
      if (nextRowIdx < paginatedMembers.length) {
        const nextMemberId = paginatedMembers[nextRowIdx].id;
        const ref = inputRefs.current[`${nextMemberId}-${field}`];
        ref?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Revert this row
      setDirtyRows(prev => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      (e.target as HTMLInputElement).blur();
    }
  };

  const saveChanges = async () => {
    const ids = Object.keys(dirtyRows);
    let errorCount = 0;
    for (const id of ids) {
      const row = dirtyRows[id];
      const { error } = await supabase.from("members").update({
        vorname: row.vorname,
        nachname: row.nachname,
        geburtsjahr: row.geburtsjahr,
        email: row.email || null,
      }).eq("id", id);
      if (error) errorCount++;
    }
    if (errorCount > 0) {
      toast({ title: "Fehler", description: `${errorCount} Zeile(n) konnten nicht gespeichert werden.`, variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: `${ids.length} Mitglied(er) aktualisiert.` });
    }
    setDirtyRows({});
    setShowSaveConfirm(false);
    load();
  };

  const handleEditModeToggle = (checked: boolean) => {
    if (!checked && hasDirty) {
      setShowSaveConfirm(true);
      return;
    }
    setIsEditMode(checked);
    if (!checked) setDirtyRows({});
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between flex-wrap gap-2">
          <span>Mitgliederverwaltung ({members.length})</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="edit-mode-toggle" className="text-sm font-normal cursor-pointer">
                Bearbeitungs-Modus
              </Label>
              <Switch
                id="edit-mode-toggle"
                checked={isEditMode}
                onCheckedChange={handleEditModeToggle}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}>
              <Upload className="h-4 w-4 mr-1" /> Bulk Upload
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Edit mode warning */}
        {isEditMode && (
          <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Achtung:</strong> Sie bearbeiten Stammdaten. Änderungen an E-Mail-Adressen wirken sich auf die Benachrichtigungen und die Zuordnung von Buchungen aus.
            </AlertDescription>
          </Alert>
        )}

        {/* Save button */}
        {hasDirty && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowSaveConfirm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="h-4 w-4 mr-1" />
              Änderungen speichern ({Object.keys(dirtyRows).length})
            </Button>
          </div>
        )}

        {/* Add member form */}
        <div className="flex flex-wrap gap-2 items-end">
          <div><Label className="text-xs">Vorname*</Label><Input value={vorname} onChange={e => setVorname(e.target.value)} className="w-32" /></div>
          <div><Label className="text-xs">Nachname*</Label><Input value={nachname} onChange={e => setNachname(e.target.value)} className="w-32" /></div>
          <div><Label className="text-xs">Geburtsjahr*</Label><Input value={geburtsjahr} onChange={e => setGeburtsjahr(e.target.value)} type="number" className="w-24" /></div>
          <div><Label className="text-xs">E-Mail</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="w-48" /></div>
          <Button size="sm" onClick={addMember}><Plus className="h-4 w-4 mr-1" />Hinzufügen</Button>
        </div>

        <Input
          placeholder="Suchen..."
          value={showSearchWarning ? search : search}
          onChange={e => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />

        {/* Search warning dialog */}
        <Dialog open={showSearchWarning} onOpenChange={setShowSearchWarning}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Ungespeicherte Änderungen</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Sie haben {Object.keys(dirtyRows).length} ungespeicherte Änderung(en). Möchten Sie diese verwerfen und die Suche fortsetzen?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSearchWarning(false)}>Abbrechen</Button>
              <Button variant="destructive" onClick={confirmSearchWithDirty}>Verwerfen & Suchen</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Editable table */}
        <div className="overflow-x-auto relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background min-w-[120px]">Vorname</TableHead>
                <TableHead className="sticky left-[120px] z-10 bg-background min-w-[120px]">Nachname</TableHead>
                <TableHead className="min-w-[100px]">Geburtsjahr</TableHead>
                <TableHead className="min-w-[200px]">E-Mail</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.map((m, rowIndex) => {
                const isDirty = !!dirtyRows[m.id];
                return (
                  <TableRow
                    key={m.id}
                    className={
                      isDirty
                        ? "border-l-2 border-l-blue-500"
                        : isEditMode
                        ? "bg-amber-50/50 dark:bg-amber-950/10"
                        : ""
                    }
                  >
                    {(["vorname", "nachname", "geburtsjahr", "email"] as const).map((field, colIdx) => {
                      const isSticky = field === "vorname" || field === "nachname";
                      const stickyClass = field === "vorname"
                        ? "sticky left-0 z-10"
                        : field === "nachname"
                        ? "sticky left-[120px] z-10"
                        : "";
                      const bgClass = isDirty
                        ? "bg-blue-50 dark:bg-blue-950/20"
                        : isEditMode
                        ? "bg-amber-50/50 dark:bg-amber-950/10"
                        : "bg-background";

                      return (
                        <TableCell key={field} className={`${stickyClass} ${isSticky ? bgClass : ""}`}>
                          {isEditMode ? (
                            <Input
                              ref={(el) => { inputRefs.current[`${m.id}-${field}`] = el; }}
                              type={field === "email" ? "email" : field === "geburtsjahr" ? "number" : "text"}
                              value={getCellValue(m, field)}
                              onChange={e => handleCellChange(m.id, field, e.target.value, m)}
                              onKeyDown={e => handleKeyDown(e, m.id, field, rowIndex)}
                              className="h-8 text-sm border-transparent focus:border-input bg-transparent"
                            />
                          ) : (
                            <span>{field === "email" ? (m[field] || "-") : m[field]}</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMember(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

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

        {/* Save confirmation dialog */}
        <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Änderungen speichern</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Möchten Sie die Änderungen für {Object.keys(dirtyRows).length} Mitglied(er) dauerhaft speichern?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>Abbrechen</Button>
              <Button onClick={saveChanges}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk upload dialog */}
        <Dialog open={showBulk} onOpenChange={setShowBulk}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Mitglieder Bulk Upload</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              CSV-Daten einfügen: Vorname, Nachname, Geburtsjahr, E-Mail (optional). Trennzeichen: Komma, Semikolon oder Tab.
            </p>
            <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8}
              placeholder="Max,Mustermann,1984,max@email.de&#10;Anna,Schmidt,1990,anna@email.de" />
            <Button onClick={handleBulkUpload}>Importieren</Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
