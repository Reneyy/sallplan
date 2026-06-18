# SallPlan Architektur

## Dateien

- `index.html`: Grundstruktur, Login, Ansichten, Modal.
- `style.css`: Responsives Layout und Statusfarben.
- `data.js`: Konstanten, Zeitraster und Beispieldaten.
- `app.js`: Zustand, Rechte, Statuslogik, Rendering und Interaktionen.
- `README.md`: Startanleitung und Projektuebersicht.
- `config.js`: Demo-/Supabase-Konfiguration.
- `supabase/schema.sql`: produktives Datenbankschema.
- `supabase/seed.sql`: optionale Startdaten.
- `supabase/functions/admin-create-teacher/index.ts`: sichere Benutzeranlage durch Admins.

## Statusberechnung

`getCellStatus(roomId, date, day, slotId)` berechnet den sichtbaren Status einer Kalenderzelle.

Prioritaet:

1. Inaktiver Raum.
2. Sperrung.
3. Reservierung.
4. Kleine Pause.
5. Ferien.
6. Mittagspause.
7. Frei buchbarer Raum.
8. Dauerhafte Freigabe.
9. Einmalige Freigabe.
10. Fixer Stundenplan.
11. Freier nicht belegter Slot.

Diese Reihenfolge verhindert, dass eine Reservierung oder Sperrung von einer Freigabe ueberdeckt wird.

## Buchungslogik

`canBook(roomId, date, day, slotId, teacherId)` prueft:

- Raum ist aktiv.
- Woche ist aktuelle oder naechste Woche.
- Keine Sperrung.
- Keine bestehende Reservierung.
- Slot ist keine kleine Pause.
- Slot ist frei, freigegeben oder Ferienzeit.

Admin darf im Prototyp auch fixe Slots buchen, solange keine Sperrung oder Reservierung besteht.

## Rechte

`canEditRoomSchedule(room)` erlaubt Stundenplan- und Freigabeverwaltung fuer:

- Admin.
- Klassenlehrer/in, wenn `room.responsibleTeacherId` der aktuellen Lehrperson entspricht.

Nebenfachlehrer/innen koennen alles einsehen, aber nur buchbare Slots reservieren.

## Zeitraster

Der Kalender zeigt Montag bis Sonntag. Die App verwendet Tagesvorlagen:

- Montag, Mittwoch, Freitag, Samstag und Sonntag: schwarze Zeiten.
- Dienstag und Donnerstag: blaue Zeiten.
- Kleine Pausen sind sichtbare, nicht buchbare Slots.
- Mittagspausen sind sichtbare, buchbare Slots.

Stundenplaneintraege speichern neben dem Fach auch `teacherId`, damit unter jedem Fach eine Lehrperson angezeigt und bearbeitet werden kann.

Die Wochenansicht wird nicht ueber eine lange KW-Liste gesteuert, sondern ueber ein Datumsfeld. Die App berechnet daraus automatisch den Montag der passenden Woche und begrenzt die Auswahl auf das Schuljahr.

## Admin-Loeschfunktionen

Admins koennen im Prototyp Lehrpersonen, Raeume und Ferien loeschen.

- Beim Loeschen einer Lehrperson werden ihre Reservierungen entfernt, Raum-Zustaendigkeiten geloest und Stundenplan-Zuordnungen geleert.
- Beim Loeschen eines Raums werden Stundenplan, Reservierungen, Freigaben und Sperrungen fuer diesen Raum entfernt.
- Das feste Admin-Konto kann nicht geloescht werden.

## LocalStorage

`loadData()`, `saveData()` und `resetData()` kapseln die lokale Speicherung. Dadurch kann spaeter ein Supabase-Repository an diese Stelle treten, ohne die UI komplett umzubauen.

## Supabase-Migration

Die aktuellen Arrays lassen sich in Tabellen ueberfuehren:

- `teachers`
- `rooms`
- `schedule_slots`
- `fixed_schedule`
- `recurring_releases`
- `manual_releases`
- `reservations`
- `room_blocks`
- `school_holidays`

In `supabase/schema.sql` sind Buchungen serverseitig mit einem eindeutigen Constraint auf `(room_id, date, slot_id)` abgesichert. Row-Level-Security erlaubt allen angemeldeten Personen das Lesen, begrenzt Reservierungen auf eigene Buchungen und Adminrechte, und erlaubt Stundenplanbearbeitung nur Admins oder zustaendigen Klassenlehrer/innen.
