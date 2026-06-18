# SallPlan

SallPlan ist eine Web-App fuer die Verwaltung und Reservierung von Schulraeumen. Die aktuelle Version laeuft im Supabase-Modus. Fuer reine lokale Tests kann `config.js` auf `mode: "demo"` gestellt werden.

## Start

Oeffne `index.html` im Browser. Es ist kein Build-Schritt und keine Installation noetig.

Online-Demo:

```text
https://reneyy.github.io/sallplan/
```

Demo-Logins:

| Benutzer | Passwort | Rolle |
| --- | --- | --- |
| `admin` | `admin123` | Admin |
| `eischen` | `schule123` | Klassenlehrerin |
| `mueller` | `schule123` | Klassenlehrerin |
| `weber` | `schule123` | Klassenlehrer |
| `schneider` | `schule123` | Klassenlehrerin |
| `klein` | `schule123` | TAP |
| `becker` | `schule123` | A-EBS |

## Funktionen

- Login-Simulation mit lokalen Benutzerkonten.
- Startseite mit Kacheln fuer Raumplanung, Kalender, Materialausleihe und Lehrerstundenplaene.
- Raumseite mit Datumsfilter und optionaler Anzeige nur freier Raeume.
- Wochenansicht pro Raum mit Montag bis Sonntag.
- Datumswahl im Stundenplan springt automatisch in die passende Schulwoche.
- Aktuelle und naechste Woche sind buchbar, spaetere Wochen nur einsehbar.
- Montag/Mittwoch/Freitag nutzen ein anderes Zeitraster als Dienstag/Donnerstag.
- Kleine Pausen sind sichtbar, aber nicht buchbar.
- Mittagspausen sind sichtbar und buchbar.
- Reservierung mit reservierender Person, zweiter Person und kurzer Notiz.
- Keine Doppelbuchungen fuer denselben Raum, Tag und Slot.
- Klassenlehrer/innen koennen den Stundenplan ihrer eigenen Klassensaele inklusive Lehrpersonen-Zuordnung bearbeiten.
- Klassenlehrer/innen und Admin koennen einmalige und dauerhafte Freigaben anlegen.
- Admin kann Lehrpersonen, Raeume, Ferien, Sperrungen, Import und Einstellungen getrennt verwalten.
- Admin kann Lehrpersonen, Raeume und Ferien loeschen.
- Admin kann Raumkarten mit Saalnummer, Initialen und Lehrerzuweisungen bearbeiten.
- Materialausleihe mit Beispieldaten und Doppelbuchungsschutz.
- Monatskalender fuer Ferien und Termine.
- Lehrerstundenplaene koennen als PDF lokal in der App angezeigt werden.
- Admin kann einzelne Raeume fuer konkrete Termine sperren.
- Ferien gelten fuer alle Raeume und erscheinen farblich getrennt.
- QR-faehige Raumlinks ueber `index.html?roomId=r1`.

## Raumtypen

- `fixed_schedule`: Klassensaal mit festem Wochenstundenplan.
- `free_booking`: Raum ohne festen Stundenplan, direkt buchbar.

## Rollen

- Admin: darf alles einsehen und lokal verwalten.
- Klassenlehrer/in, TAP, EPS, I-EBS, Éd.grad und Concierge: duerfen alles einsehen, buchen und zugewiesene Raeume verwalten.
- A-EBS, Autre und Intervenant: duerfen alles einsehen und buchbare Slots reservieren.

## Datenmodell

Im Demo-Modus liegen die Daten in `data.js` und werden nach dem ersten Start in `LocalStorage` kopiert. Im Supabase-Modus kommen diese Daten aus den Tabellen:

- `teachers`
- `rooms`
- `fixedSchedule`
- `recurringReleases`
- `manualReleases`
- `reservations`
- `roomBlocks`
- `schoolHolidays`
- `roomTeachers`
- `calendarEvents`
- `materials`
- `materialReservations`
- `teacherTimetables`

Mit dem Button "Beispieldaten zuruecksetzen" werden lokale Aenderungen geloescht und die Demo-Daten neu geladen.

Hinweis: Das Zeitraster liegt als Tagesvorlage in `data.js`. Montag, Mittwoch, Freitag, Samstag und Sonntag nutzen die schwarzen Zeiten aus der Vorlage; Dienstag und Donnerstag nutzen die blauen Zeiten.

## Supabase-Pilot

Vorbereitet sind:

- `supabase/schema.sql`: Tabellen, RLS-Regeln und Datenbank-Doppelbuchungsschutz.
- `supabase/seed.sql`: optionale Startdaten.
- `supabase/migration_20260618_features.sql`: neue Rollen, Raumkartenfelder, Kalender, Materialausleihe und Lehrerstundenplan-PDFs.
- `supabase/functions/admin-create-teacher/index.ts`: Edge Function fuer sichere Admin-Benutzeranlage.
- `config.js`: aktuell Demo-Modus.
- `config.sample.js`: Vorlage fuer Supabase-Projektwerte.
- `SUPABASE_SETUP.md`: Schritt-fuer-Schritt-Anleitung.

Die App zeigt oben "Demo" oder spaeter "Supabase", je nach Konfiguration.

## Zukuenftige Erweiterungen

- Supabase-Anbindung in `app.js` aktivieren.
- Sichere Passwortverwaltung ueber Supabase Auth.
- Benutzerverwaltung mit Edge Function.
- QR-Codes als PDF pro Raum.
- Kalenderexport.
- PDF-Export der Wochenplaene.
- Wiederkehrende Reservierungen.
- Import echter Stundenplaene.
- Mehrsprachigkeit Deutsch/Franzoesisch.
- Benachrichtigungen und Aenderungsverlauf.
