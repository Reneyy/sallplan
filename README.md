# SallPlan

SallPlan ist ein lokaler Klick-Prototyp fuer die Verwaltung und Reservierung von Schulraeumen. Die App laeuft direkt im Browser mit HTML, CSS und JavaScript und speichert Daten im `LocalStorage`.

## Start

Oeffne `index.html` im Browser. Es ist kein Build-Schritt und keine Installation noetig.

Demo-Logins:

| Benutzer | Passwort | Rolle |
| --- | --- | --- |
| `admin` | `admin123` | Admin |
| `eischen` | `schule123` | Klassenlehrerin |
| `mueller` | `schule123` | Klassenlehrerin |
| `weber` | `schule123` | Klassenlehrer |
| `schneider` | `schule123` | Klassenlehrerin |
| `klein` | `schule123` | Nebenfachlehrer |
| `becker` | `schule123` | Nebenfachlehrerin |

## Funktionen

- Login-Simulation mit lokalen Benutzerkonten.
- Startseite mit Raumkacheln und Filter.
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
- Admin kann Lehrpersonen, Raeume und Ferien lokal verwalten.
- Admin kann Lehrpersonen, Raeume und Ferien loeschen.
- Admin kann einzelne Raeume fuer konkrete Termine sperren.
- Ferien gelten fuer alle Raeume und erscheinen farblich getrennt.
- QR-faehige Raumlinks ueber `index.html?roomId=r1`.

## Raumtypen

- `fixed_schedule`: Klassensaal mit festem Wochenstundenplan.
- `free_booking`: Raum ohne festen Stundenplan, direkt buchbar.

## Rollen

- Admin: darf alles einsehen und lokal verwalten.
- Klassenlehrer/in: darf alles einsehen, buchbare Slots reservieren und eigene Klassensaele verwalten.
- Nebenfachlehrer/in: darf alles einsehen und buchbare Slots reservieren.

## Datenmodell

Die Daten liegen in `data.js` und werden nach dem ersten Start in `LocalStorage` kopiert:

- `teachers`
- `rooms`
- `fixedSchedule`
- `recurringReleases`
- `manualReleases`
- `reservations`
- `roomBlocks`
- `schoolHolidays`

Mit dem Button "Beispieldaten zuruecksetzen" werden lokale Aenderungen geloescht und die Demo-Daten neu geladen.

Hinweis: Das Zeitraster liegt als Tagesvorlage in `data.js`. Montag, Mittwoch, Freitag, Samstag und Sonntag nutzen die schwarzen Zeiten aus der Vorlage; Dienstag und Donnerstag nutzen die blauen Zeiten.

## Zukuenftige Erweiterungen

- Supabase-Login und zentrale PostgreSQL-Datenbank.
- Sichere Passwortverwaltung.
- Benutzerverwaltung mit Einladungen.
- QR-Codes als PDF pro Raum.
- Kalenderexport.
- PDF-Export der Wochenplaene.
- Wiederkehrende Reservierungen.
- Import echter Stundenplaene.
- Mehrsprachigkeit Deutsch/Franzoesisch.
- Benachrichtigungen und Aenderungsverlauf.
