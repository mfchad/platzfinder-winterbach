import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogOut, Trash2, Edit, Plus, Upload } from "lucide-react";
import type { Member, Booking, BookingRule } from "@/lib/types";
import DateNavigation from "@/components/DateNavigation";
import { formatDateISO, anonymizeName } from "@/lib/types";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) navigate('/admin');
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) navigate('/admin');
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-accent text-accent-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-display text-lg sm:text-xl font-bold">Verwaltung</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Abmelden
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="members">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="members">Mitglieder</TabsTrigger>
            <TabsTrigger value="bookings">Buchungen</TabsTrigger>
            <TabsTrigger value="special">Sonderbuchungen</TabsTrigger>
            <TabsTrigger value="rules">Regelwerk</TabsTrigger>
          </TabsList>

          <TabsContent value="members"><MembersTab /></TabsContent>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="special"><SpecialBookingsTab /></TabsContent>
          <TabsContent value="rules"><RulesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ===== Members Tab =====
function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [geburtsjahr, setGeburtsjahr] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { data } = await supabase.from('members').select('*').order('nachname');
    setMembers((data as Member[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addMember = async () => {
    if (!vorname.trim() || !nachname.trim() || !geburtsjahr.trim()) {
      toast({ title: "Fehler", description: "Pflichtfelder ausfüllen.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from('members').insert({
      vorname: vorname.trim(), nachname: nachname.trim(),
      geburtsjahr: parseInt(geburtsjahr), email: email.trim() || null,
    });
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Erfolg", description: "Mitglied hinzugefügt." });
    setVorname(""); setNachname(""); setGeburtsjahr(""); setEmail("");
    load();
  };

  const deleteMember = async (id: string) => {
    await supabase.from('members').delete().eq('id', id);
    load();
  };

  const handleBulkUpload = async () => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const toInsert: any[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length >= 3) {
        toInsert.push({
          vorname: parts[0],
          nachname: parts[1],
          geburtsjahr: parseInt(parts[2]),
          email: parts[3] || null,
        });
      }
    }
    if (toInsert.length === 0) {
      toast({ title: "Fehler", description: "Keine gültigen Daten gefunden.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from('members').insert(toInsert);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Erfolg", description: `${toInsert.length} Mitglieder importiert.` });
    setBulkText(""); setShowBulk(false);
    load();
  };

  const filtered = members.filter(m =>
    !search || `${m.vorname} ${m.nachname}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between flex-wrap gap-2">
          Mitgliederverwaltung ({members.length})
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Upload
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add member form */}
        <div className="flex flex-wrap gap-2 items-end">
          <div><Label className="text-xs">Vorname*</Label><Input value={vorname} onChange={e => setVorname(e.target.value)} className="w-32" /></div>
          <div><Label className="text-xs">Nachname*</Label><Input value={nachname} onChange={e => setNachname(e.target.value)} className="w-32" /></div>
          <div><Label className="text-xs">Geburtsjahr*</Label><Input value={geburtsjahr} onChange={e => setGeburtsjahr(e.target.value)} type="number" className="w-24" /></div>
          <div><Label className="text-xs">E-Mail</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="w-48" /></div>
          <Button size="sm" onClick={addMember}><Plus className="h-4 w-4 mr-1" />Hinzufügen</Button>
        </div>

        <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vorname</TableHead>
                <TableHead>Nachname</TableHead>
                <TableHead>Geburtsjahr</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{m.vorname}</TableCell>
                  <TableCell>{m.nachname}</TableCell>
                  <TableCell>{m.geburtsjahr}</TableCell>
                  <TableCell>{m.email || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMember(m.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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

// ===== Bookings Tab =====
function BookingsTab() {
  const [date, setDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const dateStr = formatDateISO(date);

  const load = useCallback(async () => {
    const { data } = await supabase.from('bookings').select('*').eq('date', dateStr).order('start_hour');
    setBookings((data as Booking[]) || []);
  }, [dateStr]);

  useEffect(() => { load(); }, [load]);

  const deleteBooking = async (id: string) => {
    await supabase.from('bookings').delete().eq('id', id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Buchungen verwalten</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateNavigation date={date} onDateChange={setDate} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platz</TableHead>
                <TableHead>Zeit</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Bucher</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Kommentar</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map(b => (
                <TableRow key={b.id} className={b.booking_type === 'double' ? 'bg-wimbledon-gold/10' : ''}>
                  <TableCell>Platz {b.court_number}</TableCell>
                  <TableCell>{String(b.start_hour).padStart(2, '0')}:00</TableCell>
                  <TableCell>
                    {b.booking_type === 'special' ? b.special_label :
                     b.booking_type === 'half' ? (b.is_joined ? 'Halb → Voll' : 'Halbbuchung') :
                     b.booking_type === 'double' ? '🎾 Doppel' : 'Einzel'}
                  </TableCell>
                  <TableCell>{b.booker_vorname} {b.booker_nachname}</TableCell>
                  <TableCell>
                    {b.partner_vorname ? `${b.partner_vorname} ${b.partner_nachname}` : 
                     b.double_match_names || '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{b.booker_comment || b.partner_comment || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteBooking(b.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {bookings.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Keine Buchungen für diesen Tag.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Special Bookings Tab =====
function SpecialBookingsTab() {
  const [court, setCourt] = useState("1");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("8");
  const [label, setLabel] = useState("Abo");
  const [recurrence, setRecurrence] = useState("none");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!date) { toast({ title: "Fehler", description: "Bitte Datum auswählen.", variant: "destructive" }); return; }
    
    const bookings: any[] = [];
    const startDate = new Date(date);
    const end = endDate ? new Date(endDate) : startDate;

    let current = new Date(startDate);
    while (current <= end) {
      bookings.push({
        court_number: parseInt(court),
        date: formatDateISO(current),
        start_hour: parseInt(hour),
        booking_type: 'special',
        special_label: label,
        booker_vorname: 'Admin',
        booker_nachname: 'System',
        booker_geburtsjahr: 2000,
        recurrence_type: recurrence,
        created_by_admin: true,
        is_joined: false,
      });

      if (recurrence === 'daily') current.setDate(current.getDate() + 1);
      else if (recurrence === 'weekly') current.setDate(current.getDate() + 7);
      else if (recurrence === 'monthly') current.setMonth(current.getMonth() + 1);
      else break;
    }

    const { error } = await supabase.from('bookings').insert(bookings);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Erfolg", description: `${bookings.length} Sonderbuchung(en) erstellt.` });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="font-display">Sonderbuchungen</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Platz</Label>
            <Select value={court} onValueChange={setCourt}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6].map(c => <SelectItem key={c} value={String(c)}>Platz {c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Uhrzeit</Label>
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({length:14},(_, i)=>i+8).map(h => <SelectItem key={h} value={String(h)}>{String(h).padStart(2,'0')}:00</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Datum</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Bezeichnung</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="z.B. Abo, Platz Gesperrt" />
        </div>
        <div>
          <Label>Wiederholung</Label>
          <Select value={recurrence} onValueChange={setRecurrence}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Einmalig</SelectItem>
              <SelectItem value="daily">Täglich</SelectItem>
              <SelectItem value="weekly">Wöchentlich</SelectItem>
              <SelectItem value="monthly">Monatlich</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {recurrence !== 'none' && (
          <div>
            <Label>Enddatum</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        )}
        <Button onClick={handleCreate}>Sonderbuchung erstellen</Button>
      </CardContent>
    </Card>
  );
}

// ===== Rules Tab =====
function RulesTab() {
  const [rules, setRules] = useState<BookingRule[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { data } = await supabase.from('booking_rules').select('*').order('rule_key');
    setRules((data as BookingRule[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRule = async (id: string, value: string) => {
    const { error } = await supabase.from('booking_rules').update({ rule_value: value, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Gespeichert" });
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="font-display">Regelwerk verwalten</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 bg-muted rounded-md">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium">{r.description || r.rule_key}</p>
                <p className="text-xs text-muted-foreground">{r.rule_key}</p>
              </div>
              <Input
                defaultValue={r.rule_value}
                className="w-32"
                onBlur={e => {
                  if (e.target.value !== r.rule_value) updateRule(r.id, e.target.value);
                }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
