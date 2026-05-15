## Self-Service E-Mail-Erfassung für Mitglieder

Aktuell: 13 von 470 Mitgliedern haben eine E-Mail hinterlegt.

### 1. Datenbank
- **Neue Tabelle** `email_verification_requests`: speichert Token, Mitglied, vorgeschlagene E-Mail, Ablaufzeit, Status. RLS: nur Edge Functions schreiben/lesen.
- **Public RPC** `get_email_completion_stats()` → `{ filled, total }` (keine PII, für Banner).
- **Public RPC** `lookup_member_email(vorname, nachname)` → `{ found, has_email, masked_email }` (keine Roh-E-Mail an Public).
- **Edge Function** `request-member-email`: prüft Mitglied (Vor- + Nachname), erzeugt Token, speichert Eintrag, **sendet Verifizierungs-Mail**.
- **Edge Function** `verify-member-email`: validiert Token, schreibt E-Mail in `members`.

### 2. UI auf der Buchungsseite
- **Banner** (subtile Akzentfarbe, Club-Gold/Marine, Schließen-Knopf merkt sich Status in localStorage) oberhalb der DateNavigation:
  *"Hilf uns, den Club zu digitalisieren! {filled} / {total} E-Mail-Adressen erfasst."*
  + Button **„E-Mail jetzt ergänzen"**.
- Live-Update via Supabase Realtime auf `members`.

### 3. Modal-Workflow (`MemberEmailDialog`)
- **Schritt 1**: Vorname + Nachname.
- **Schritt 2**: Lookup → 
  - nicht gefunden: Hinweis "Mitglied nicht gefunden, bitte Verwaltung kontaktieren".
  - gefunden, mit E-Mail: maskierte E-Mail anzeigen + Button „Aktualisieren".
  - gefunden, ohne E-Mail: Eingabefeld.
- **Schritt 3**: E-Mail eingeben → Edge Function ruft Verifizierungslink → Bestätigung „Wir haben dir einen Bestätigungslink gesendet."
- **Verifizierungs-Seite** `/verify-email?token=…`: ruft Edge Function, zeigt Erfolg/Fehler.

### 4. Admin
- `MembersTab` zeigt aktualisierte E-Mails (bereits live, da Tabelle direkt gelesen wird).

### Offene Voraussetzung — E-Mail-Versand
Damit Verifizierungslinks **wirklich verschickt** werden, braucht das Projekt eine eigene Mail-Domain (z. B. `notify.tc-winterbach.de`). Aktuell ist **keine Domain konfiguriert**. Zwei Optionen:

**A. Domain einrichten** *(empfohlen, professionell, branded mails von z.B. `noreply@notify.tc-winterbach.de`)*  
Ich richte Domain + transaktionalen Versand ein, baue dann das vollständige Verifizierungs-Feature inkl. Mailversand.

**B. Vorerst ohne Verifizierung** *(schnell, aber weniger sicher)*  
Eingabe wird sofort gespeichert und als „unbestätigt" markiert. Kein Mailversand. Verifizierung kann später nachgerüstet werden.

Bitte wähle A oder B, damit ich entsprechend implementiere.
