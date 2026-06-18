# SallPlan mit Supabase verbinden

Diese Anleitung ist fuer die echte gemeinsame Version. Danach sehen alle Lehrpersonen dieselben Reservierungen.

## Was du schon hast

Supabase-Projekt:

```text
https://pavdreevrugqvfahaacm.supabase.co
```

Der oeffentliche Key ist in `config.js` eingetragen. Das ist okay. Dieser Key ist fuer Webseiten gedacht.

## 1. Datenbank vorbereiten

1. Oeffne dein Supabase-Projekt.
2. Links auf **SQL Editor** klicken.
3. Auf **New query** klicken.
4. Den Inhalt von `supabase/schema.sql` einfuegen.
5. Auf **Run** klicken.
6. Danach wieder **New query**.
7. Den Inhalt von `supabase/seed.sql` einfuegen.
8. Auf **Run** klicken.
9. Danach wieder **New query**.
10. Den Inhalt von `supabase/migration_20260618_features.sql` einfuegen.
11. Auf **Run** klicken.

Damit sind Tabellen, Rechte, Raeume, Lehrpersonen, Ferien, Freigaben, Beispielstundenplaene, neue Rollen, Materialausleihe und Kalender angelegt.

Wenn deine Datenbank schon existiert, musst du `schema.sql` und `seed.sql` nicht erneut laufen lassen. Dann reicht fuer diese Version einmal:

```text
supabase/migration_20260618_features.sql
```

Diese Migration legt auch den geschuetzten Supabase-Storage-Bucket fuer PDF-Lehrerstundenplaene an. Sie erweitert ausserdem die Materialausleihe um Bestand, Anzahl, Name/Klasse und Material-Tickets.

## 2. Ersten Admin-Login anlegen

1. In Supabase links auf **Authentication** klicken.
2. Auf **Users** klicken.
3. Auf **Add user** klicken.
4. E-Mail:

```text
admin@sallplan.local
```

5. Passwort selbst waehlen, z. B. ein sicheres Startpasswort.
6. User speichern.
7. Danach in der Users-Liste diesen User oeffnen.
8. Die **User UID** kopieren.

## 3. Admin mit SallPlan verbinden

1. Wieder links auf **SQL Editor**.
2. **New query**.
3. Diesen Code einfuegen:

```sql
update teachers
set auth_user_id = 'HIER-DIE-USER-UID-EINFUEGEN'
where id = 'admin';
```

4. `HIER-DIE-USER-UID-EINFUEGEN` durch die kopierte UID ersetzen.
5. Auf **Run** klicken.

Danach kannst du dich in SallPlan so einloggen:

```text
Benutzername: admin
Passwort: dein gewaehltes Supabase-Passwort
```

## 4. GitHub Pages aktualisieren

Lade diese Dateien neu in dein GitHub-Repository hoch:

```text
index.html
style.css
app.js
data.js
config.js
config.sample.js
README.md
architecture.md
SUPABASE_SETUP.md
supabase/
```

Danach laeuft die Webseite im Supabase-Modus.
Wichtig: Erst die Migration in Supabase ausfuehren, dann GitHub aktualisieren.

## 5. Weitere Lehrpersonen

Fuer die richtig bequeme Admin-Funktion "Lehrperson anlegen" muss spaeter die Edge Function in `supabase/functions/admin-create-teacher` deployed werden.

Bis dahin kannst du Lehrpersonen zuerst manuell in Supabase unter **Authentication â†’ Users** anlegen und dann ihre UID in der Tabelle `teachers` eintragen.

Beispiel:

```sql
update teachers
set auth_user_id = 'USER-UID-DER-LEHRPERSON'
where username = 'eischen';
```

Der Loginname in SallPlan ist dann weiter:

```text
eischen
```

Supabase benutzt intern daraus:

```text
eischen@sallplan.local
```

## Wichtig

Den `service_role` Key nie in GitHub hochladen und nie in `config.js` eintragen.

