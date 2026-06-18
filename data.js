const SALLPLAN_STORAGE_KEY = "sallplan.prototype.v3";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const TEACHER_TYPES = [
  { id: "class_teacher", label: "Klassenlehrer/in", canManageRooms: true },
  { id: "tap", label: "TAP", canManageRooms: true },
  { id: "eps", label: "EPS", canManageRooms: true },
  { id: "iebs", label: "I-EBS", canManageRooms: true },
  { id: "ed_grad", label: "Éd.grad", canManageRooms: true },
  { id: "aebs", label: "A-EBS", canManageRooms: false },
  { id: "concierge", label: "Concierge", canManageRooms: true },
  { id: "autre", label: "Autre", canManageRooms: false },
  { id: "intervenant", label: "Intervenant", canManageRooms: false },
  { id: "admin", label: "Admin", canManageRooms: true }
];

const SLOT_ROWS = [
  { id: "row1", label: "1. Stunde", kind: "lesson" },
  { id: "row2", label: "2. Stunde", kind: "lesson" },
  { id: "break_morning", label: "Kleine Pause", kind: "short_break" },
  { id: "row3", label: "3. Stunde", kind: "lesson" },
  { id: "row4", label: "4. Stunde", kind: "lesson" },
  { id: "lunch", label: "Mittagspause", kind: "lunch_break" },
  { id: "row5", label: "5. Stunde", kind: "lesson" },
  { id: "break_afternoon", label: "Kleine Pause", kind: "short_break" },
  { id: "row6", label: "6. Stunde", kind: "lesson" }
];

const BLACK_DAY_TIMES = {
  row1: ["08:00", "08:55"],
  row2: ["08:55", "09:50"],
  break_morning: ["09:50", "10:10"],
  row3: ["10:10", "11:05"],
  row4: ["11:05", "12:00"],
  lunch: ["12:00", "14:00"],
  row5: ["14:00", "14:55"],
  break_afternoon: ["14:55", "15:05"],
  row6: ["15:05", "16:00"]
};

const BLUE_DAY_TIMES = {
  row1: ["08:00", "08:50"],
  row2: ["08:50", "09:40"],
  break_morning: ["09:40", "10:00"],
  row3: ["10:00", "10:50"],
  row4: ["10:50", "11:40"],
  lunch: ["11:40", "12:30"],
  row5: ["14:00", "14:55"],
  break_afternoon: ["14:55", "15:05"],
  row6: ["15:05", "16:00"]
};

function createDefaultState() {
  const currentMonday = getMonday(new Date());
  const nextMonday = addDays(currentMonday, 7);

  return {
    meta: {
      schoolYearStart: "2025-09-15",
      schoolYearEnd: "2026-07-15"
    },
    teachers: [
      { id: "admin", name: "Admin", username: "admin", password: "admin123", role: "admin", teacherType: "admin" },
      { id: "t1", name: "Frau Mueller", username: "mueller", password: "schule123", role: "teacher", teacherType: "class_teacher" },
      { id: "t2", name: "Herr Weber", username: "weber", password: "schule123", role: "teacher", teacherType: "class_teacher" },
      { id: "t3", name: "Frau Eischen", username: "eischen", password: "schule123", role: "teacher", teacherType: "class_teacher" },
      { id: "t4", name: "Herr Klein", username: "klein", password: "schule123", role: "teacher", teacherType: "tap" },
      { id: "t5", name: "Frau Schneider", username: "schneider", password: "schule123", role: "teacher", teacherType: "class_teacher" },
      { id: "t6", name: "Frau Becker", username: "becker", password: "schule123", role: "teacher", teacherType: "aebs" }
    ],
    rooms: [
      { id: "r1", name: "Sall C2.1", roomNumber: "C2.1", iconLabel: "C21", type: "fixed_schedule", building: "", floor: "", capacity: 0, responsibleTeacherId: "t3", active: true },
      { id: "r2", name: "Sall C2.2", roomNumber: "C2.2", iconLabel: "C22", type: "fixed_schedule", building: "", floor: "", capacity: 0, responsibleTeacherId: "t1", active: true },
      { id: "r3", name: "Sall C3.1", roomNumber: "C3.1", iconLabel: "C31", type: "fixed_schedule", building: "", floor: "", capacity: 0, responsibleTeacherId: "t2", active: true },
      { id: "r4", name: "Sall C4.1", roomNumber: "C4.1", iconLabel: "C41", type: "fixed_schedule", building: "", floor: "", capacity: 0, responsibleTeacherId: "t5", active: true },
      { id: "r5", name: "Foerderraum", roomNumber: "F1", iconLabel: "FO", type: "free_booking", building: "", floor: "", capacity: 0, responsibleTeacherId: null, active: true },
      { id: "r6", name: "Musikraum", roomNumber: "M1", iconLabel: "MU", type: "free_booking", building: "", floor: "", capacity: 0, responsibleTeacherId: null, active: true },
      { id: "r7", name: "Informatikraum", roomNumber: "I1", iconLabel: "IT", type: "free_booking", building: "", floor: "", capacity: 0, responsibleTeacherId: null, active: true },
      { id: "r8", name: "Besprechungsraum", roomNumber: "B1", iconLabel: "BE", type: "free_booking", building: "", floor: "", capacity: 0, responsibleTeacherId: null, active: true },
      { id: "r9", name: "Bibliothek", roomNumber: "BIB", iconLabel: "BI", type: "free_booking", building: "", floor: "", capacity: 0, responsibleTeacherId: null, active: true },
      { id: "r10", name: "Mehrzweckraum", roomNumber: "MZR", iconLabel: "MZ", type: "free_booking", building: "", floor: "", capacity: 0, responsibleTeacherId: null, active: true }
    ],
    roomTeachers: [
      { roomId: "r1", teacherId: "t3", relationType: "responsible" },
      { roomId: "r2", teacherId: "t1", relationType: "responsible" },
      { roomId: "r3", teacherId: "t2", relationType: "responsible" },
      { roomId: "r4", teacherId: "t5", relationType: "responsible" }
    ],
    fixedSchedule: buildFixedSchedule(),
    recurringReleases: [
      { id: "rr1", roomId: "r1", day: "Freitag", slotId: "row1", reason: "Schwimmen", createdBy: "t3", validFrom: "2025-09-15", validUntil: "2026-07-15" },
      { id: "rr2", roomId: "r1", day: "Freitag", slotId: "row2", reason: "Schwimmen", createdBy: "t3", validFrom: "2025-09-15", validUntil: "2026-07-15" },
      { id: "rr3", roomId: "r2", day: "Dienstag", slotId: "row3", reason: "Turnen", createdBy: "t1", validFrom: "2025-09-15", validUntil: "2026-07-15" },
      { id: "rr4", roomId: "r3", day: "Donnerstag", slotId: "row4", reason: "Musik in anderem Raum", createdBy: "t2", validFrom: "2025-09-15", validUntil: "2026-07-15" }
    ],
    manualReleases: [
      { id: "rel1", roomId: "r4", date: formatDate(addDays(nextMonday, 2)), day: "Mittwoch", slotId: "row5", reason: "Ausflug", note: "Klasse ist ausser Haus.", createdBy: "t5" }
    ],
    reservations: [
      { id: "res1", roomId: "r5", teacherId: "t1", secondPerson: "Frau Becker", date: formatDate(currentMonday), day: "Montag", slotId: "row1", note: "Foerdergruppe 1", createdAt: new Date().toISOString() },
      { id: "res2", roomId: "r6", teacherId: "t2", secondPerson: "Herr Klein", date: formatDate(addDays(currentMonday, 1)), day: "Dienstag", slotId: "row3", note: "Chorprobe", createdAt: new Date().toISOString() },
      { id: "res3", roomId: "r9", teacherId: "t3", secondPerson: "Frau Mueller", date: formatDate(addDays(currentMonday, 3)), day: "Donnerstag", slotId: "row2", note: "Leseprojekt", createdAt: new Date().toISOString() }
    ],
    roomBlocks: [
      { id: "block1", roomId: "r8", date: formatDate(addDays(currentMonday, 2)), day: "Mittwoch", slotId: "row4", reason: "Reinigung", createdBy: "admin" }
    ],
    schoolHolidays: [
      { id: "h1", name: "Sommerferien", startDate: "2026-07-16", endDate: "2026-09-13", createdBy: "admin" },
      { id: "h2", name: "Herbstferien", startDate: "2026-10-26", endDate: "2026-10-30", createdBy: "admin" }
    ],
    calendarEvents: [
      { id: "evt1", title: "Paedagogischer Tag", date: formatDate(addDays(currentMonday, 10)), slotId: "row1", note: "Schulinterne Weiterbildung", createdBy: "admin" }
    ],
    materials: [
      { id: "mat1", name: "iPad-Koffer", code: "IPAD", iconLabel: "IP", active: true },
      { id: "mat2", name: "Beamer mobil", code: "BEAM", iconLabel: "BM", active: true },
      { id: "mat3", name: "Lautsprecher", code: "AUDIO", iconLabel: "LS", active: true },
      { id: "mat4", name: "Blue-Bots", code: "BBOT", iconLabel: "BB", active: true },
      { id: "mat5", name: "Kamera", code: "CAM", iconLabel: "KA", active: true },
      { id: "mat6", name: "Sportmaterial", code: "SPORT", iconLabel: "SP", active: true },
      { id: "mat7", name: "Buecherkiste", code: "BOOK", iconLabel: "BK", active: true },
      { id: "mat8", name: "Experimentierbox", code: "EXP", iconLabel: "EX", active: true },
      { id: "mat9", name: "Moderationsmaterial", code: "MOD", iconLabel: "MO", active: true }
    ],
    materialReservations: [],
    teacherTimetables: []
  };
}

function buildFixedSchedule() {
  const subjects = {
    Montag: ["Deutsch", "Rechnen", "Rechnen", "Deutsch", "Sciences", "Sciences"],
    Dienstag: ["Deutsch", "Deutsch", "Rechnen", "Luxemburgisch", "Musik", ""],
    Mittwoch: ["Deutsch Fr", "Rechnen", "Deutsch", "Deutsch", "Vieso", "Vieso"],
    Donnerstag: ["Sport", "Rechnen", "Rechnen", "Deutsch", "Sciences", ""],
    Freitag: ["Schwimmen", "Schwimmen", "Deutsch", "Deutsch", "Basteln", "Basteln"]
  };
  const roomIds = ["r1", "r2", "r3", "r4"];
  const teacherCycle = ["t3", "t1", "t2", "t4", "t5", "t6"];
  const lessonSlotIds = SLOT_ROWS.filter((slot) => slot.kind === "lesson").map((slot) => slot.id);
  const schedule = [];

  roomIds.forEach((roomId, roomIndex) => {
    DAYS.slice(0, 5).forEach((day) => {
      lessonSlotIds.forEach((slotId, slotIndex) => {
        const subject = subjects[day][slotIndex] || "";
        if (!subject) return;
        schedule.push({
          roomId,
          day,
          slotId,
          subject,
          teacherId: teacherCycle[(slotIndex + roomIndex) % teacherCycle.length],
          status: "fix_belegt"
        });
      });
    });
  });

  return schedule;
}

function getSlotForDay(day, slotId) {
  const row = SLOT_ROWS.find((slot) => slot.id === slotId);
  if (!row) return null;
  const template = day === "Dienstag" || day === "Donnerstag" ? BLUE_DAY_TIMES : BLACK_DAY_TIMES;
  const [start, end] = template[slotId];
  return { ...row, start, end };
}

function getSlotsForDay(day) {
  return SLOT_ROWS.map((slot) => getSlotForDay(day, slot.id));
}

function getMonday(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
