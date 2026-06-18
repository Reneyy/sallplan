let state = loadInitialData();
let currentUser = null;
let currentView = "rooms";
let selectedRoomId = null;
let selectedWeekStart = getMonday(new Date());
let supabaseClient = null;

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();
  await restoreSession();
});

function bindElements() {
  [
    "login-screen", "login-form", "login-username", "login-password", "login-message", "app",
    "current-user-pill", "storage-mode-pill", "logout-button", "room-overview", "room-grid",
    "room-type-filter", "room-search", "room-detail", "room-title",
    "room-meta", "room-tags", "week-label", "week-rule", "week-date-picker", "today-week-button", "prev-week",
    "next-week", "room-calendar", "back-to-rooms", "my-reservations-button",
    "my-reservations-view", "my-reservations-list", "admin-button",
    "admin-view", "toast", "modal", "modal-title", "modal-body",
    "modal-close", "page-subtitle", "schedule-actions", "edit-schedule-button",
    "recurring-release-button", "room-qr-link", "reset-data-button",
    "teacher-form", "teacher-list", "room-form", "admin-room-list",
    "holiday-form", "holiday-list", "room-responsible-select"
    , "block-form", "block-room-select", "block-slot-select", "block-list"
  ].forEach((id) => {
    els[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", logout);
  els.roomTypeFilter.addEventListener("change", renderRoomOverview);
  els.roomSearch.addEventListener("input", renderRoomOverview);
  els.backToRooms.addEventListener("click", () => showView("rooms"));
  els.myReservationsButton.addEventListener("click", () => showView("myReservations"));
  els.adminButton.addEventListener("click", () => showView("admin"));
  els.prevWeek.addEventListener("click", () => changeWeek(-7));
  els.nextWeek.addEventListener("click", () => changeWeek(7));
  els.weekDatePicker.addEventListener("change", () => {
    selectedWeekStart = clampWeekToSchoolYear(getMonday(parseDate(els.weekDatePicker.value)));
    renderCalendar();
  });
  els.todayWeekButton.addEventListener("click", () => {
    selectedWeekStart = clampWeekToSchoolYear(getMonday(new Date()));
    renderCalendar();
  });
  els.modalClose.addEventListener("click", closeModal);
  els.modal.addEventListener("click", (event) => {
    if (event.target === els.modal) closeModal();
  });
  els.editScheduleButton.addEventListener("click", openScheduleEditor);
  els.recurringReleaseButton.addEventListener("click", openRecurringReleaseForm);
  els.roomQrLink.addEventListener("click", copyRoomLink);
  els.resetDataButton.addEventListener("click", resetDataFromAdmin);
  els.teacherForm.addEventListener("submit", handleCreateTeacher);
  els.roomForm.addEventListener("submit", handleCreateRoom);
  els.holidayForm.addEventListener("submit", handleCreateHoliday);
  els.blockForm.addEventListener("submit", handleCreateBlock);
}

function loadInitialData() {
  if (isSupabaseMode()) return createDefaultState();
  return loadData();
}

function loadData() {
  const raw = localStorage.getItem(SALLPLAN_STORAGE_KEY);
  if (!raw) return createDefaultState();
  try {
    return JSON.parse(raw);
  } catch {
    return createDefaultState();
  }
}

function saveData() {
  if (isSupabaseMode()) return;
  localStorage.setItem(SALLPLAN_STORAGE_KEY, JSON.stringify(state));
}

function resetData() {
  state = createDefaultState();
  saveData();
}

function isSupabaseMode() {
  const config = window.SALLPLAN_CONFIG || {};
  return config.mode === "supabase" && Boolean(config.supabaseUrl) && Boolean(config.supabaseAnonKey);
}

function getSupabaseClient() {
  if (!isSupabaseMode()) return null;
  if (supabaseClient) return supabaseClient;
  if (!window.supabase?.createClient) return null;
  const config = window.SALLPLAN_CONFIG;
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseClient;
}

async function loadRemoteState() {
  const client = getSupabaseClient();
  if (!client) return false;

  const tables = [
    "teachers",
    "rooms",
    "fixed_schedule",
    "recurring_releases",
    "manual_releases",
    "reservations",
    "room_blocks",
    "school_holidays"
  ];

  const results = await Promise.all(tables.map((table) => client.from(table).select("*")));
  const failed = results.find((result) => result.error);
  if (failed) {
    showToast(`Supabase-Daten konnten nicht geladen werden: ${failed.error.message}`, "error");
    return false;
  }

  const byTable = Object.fromEntries(tables.map((table, index) => [table, results[index].data || []]));
  const fallback = createDefaultState();
  state = {
    meta: fallback.meta,
    teachers: byTable.teachers.map(mapTeacherFromDb),
    rooms: byTable.rooms.map(mapRoomFromDb),
    fixedSchedule: byTable.fixed_schedule.map(mapFixedScheduleFromDb),
    recurringReleases: byTable.recurring_releases.map(mapRecurringReleaseFromDb),
    manualReleases: byTable.manual_releases.map(mapManualReleaseFromDb),
    reservations: byTable.reservations.map(mapReservationFromDb),
    roomBlocks: byTable.room_blocks.map(mapRoomBlockFromDb),
    schoolHolidays: byTable.school_holidays.map(mapHolidayFromDb)
  };
  return true;
}

function mapTeacherFromDb(row) {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name,
    username: row.username,
    role: row.role,
    teacherType: row.teacher_type,
    active: row.active
  };
}

function mapRoomFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    building: row.building,
    floor: row.floor,
    capacity: row.capacity,
    responsibleTeacherId: row.responsible_teacher_id,
    active: row.active
  };
}

function mapFixedScheduleFromDb(row) {
  return {
    dbId: row.id,
    roomId: row.room_id,
    day: row.day,
    slotId: row.slot_id,
    subject: row.subject,
    teacherId: row.teacher_id || "",
    status: row.status
  };
}

function mapRecurringReleaseFromDb(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    day: row.day,
    slotId: row.slot_id,
    reason: row.reason,
    createdBy: row.created_by,
    validFrom: row.valid_from,
    validUntil: row.valid_until
  };
}

function mapManualReleaseFromDb(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    date: row.date,
    day: row.day,
    slotId: row.slot_id,
    reason: row.reason,
    note: row.note || "",
    createdBy: row.created_by
  };
}

function mapReservationFromDb(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    teacherId: row.teacher_id,
    secondPerson: row.second_person || "",
    date: row.date,
    day: row.day,
    slotId: row.slot_id,
    note: row.note || "",
    createdAt: row.created_at
  };
}

function mapRoomBlockFromDb(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    date: row.date,
    day: row.day,
    slotId: row.slot_id,
    reason: row.reason,
    createdBy: row.created_by
  };
}

function mapHolidayFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by
  };
}

async function remoteInsert(table, row) {
  if (!isSupabaseMode()) return { ok: true };
  const { error } = await getSupabaseClient().from(table).insert(row);
  return error ? { ok: false, message: error.message } : { ok: true };
}

async function remoteUpsert(table, row, onConflict) {
  if (!isSupabaseMode()) return { ok: true };
  const { error } = await getSupabaseClient().from(table).upsert(row, onConflict ? { onConflict } : undefined);
  return error ? { ok: false, message: error.message } : { ok: true };
}

async function remoteUpdate(table, values, match) {
  if (!isSupabaseMode()) return { ok: true };
  let query = getSupabaseClient().from(table).update(values);
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { error } = await query;
  return error ? { ok: false, message: error.message } : { ok: true };
}

async function remoteDelete(table, match) {
  if (!isSupabaseMode()) return { ok: true };
  let query = getSupabaseClient().from(table).delete();
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { error } = await query;
  return error ? { ok: false, message: error.message } : { ok: true };
}

async function restoreSession() {
  if (isSupabaseMode()) {
    const client = getSupabaseClient();
    if (!client) {
      showLogin();
      showToast("Supabase konnte nicht geladen werden. Bitte Verbindung pruefen.", "error");
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (!error && data.session?.user) {
      const loaded = await loadRemoteState();
      currentUser = loaded ? state.teachers.find((teacher) => teacher.authUserId === data.session.user.id && teacher.active !== false) : null;
      if (currentUser) {
        startApp();
        return;
      }
    }

    showLogin();
    return;
  }

  const savedUserId = sessionStorage.getItem("sallplan.currentUserId");
  if (savedUserId) {
    currentUser = findTeacher(savedUserId);
  }

  if (currentUser) {
    startApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  els.loginScreen.classList.remove("hidden");
  els.app.classList.add("hidden");
}

function showLoginMessage(message) {
  if (els.loginMessage) els.loginMessage.textContent = message;
  showToast(message, "error");
}

async function handleLogin(event) {
  event.preventDefault();
  const username = els.loginUsername.value.trim().toLowerCase();
  const password = els.loginPassword.value;

  if (isSupabaseMode()) {
    const client = getSupabaseClient();
    if (!client) {
      showLoginMessage("Supabase ist nicht erreichbar.");
      return;
    }

    const email = username.includes("@") ? username : `${username}@sallplan.local`;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      showLoginMessage(error?.message || "Login fehlgeschlagen. Bitte Benutzername und Passwort pruefen.");
      return;
    }

    const loaded = await loadRemoteState();
    if (!loaded) return;
    currentUser = state.teachers.find((teacher) => teacher.authUserId === data.user.id && teacher.active !== false);
    if (!currentUser) {
      await client.auth.signOut();
      showLoginMessage("Dieser Login ist noch keiner Lehrperson zugeordnet.");
      return;
    }
    startApp();
    return;
  }

  const user = state.teachers.find((teacher) => teacher.username.toLowerCase() === username && teacher.password === password);

  if (!user) {
    showLoginMessage("Login fehlgeschlagen. Bitte Benutzername und Passwort pruefen.");
    return;
  }

  currentUser = user;
  sessionStorage.setItem("sallplan.currentUserId", user.id);
  startApp();
}

function startApp() {
  els.loginScreen.classList.add("hidden");
  els.app.classList.remove("hidden");
  els.currentUserPill.textContent = `${currentUser.name} · ${getRoleLabel(currentUser)}`;
  els.storageModePill.textContent = getStorageModeLabel();
  els.adminButton.classList.toggle("hidden", !isAdmin());

  const roomFromUrl = new URLSearchParams(window.location.search).get("roomId");
  if (roomFromUrl && state.rooms.some((room) => room.id === roomFromUrl)) {
    openRoom(roomFromUrl);
  } else {
    showView("rooms");
  }
}

async function logout() {
  if (isSupabaseMode()) {
    await getSupabaseClient()?.auth.signOut();
  }
  currentUser = null;
  sessionStorage.removeItem("sallplan.currentUserId");
  els.app.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
}

function showView(view) {
  currentView = view;
  els.roomOverview.classList.toggle("hidden", view !== "rooms");
  els.roomDetail.classList.toggle("hidden", view !== "roomDetail");
  els.myReservationsView.classList.toggle("hidden", view !== "myReservations");
  els.adminView.classList.toggle("hidden", view !== "admin");
  els.backToRooms.classList.toggle("hidden", view === "rooms");

  if (view === "rooms") {
    selectedRoomId = null;
    els.pageSubtitle.textContent = "Raeume";
    renderRoomOverview();
  }
  if (view === "myReservations") {
    els.pageSubtitle.textContent = "Meine Reservierungen";
    renderMyReservations();
  }
  if (view === "admin") {
    els.pageSubtitle.textContent = "Adminbereich";
    renderAdmin();
  }
}

function renderRoomOverview() {
  const type = els.roomTypeFilter.value;
  const search = els.roomSearch.value.trim().toLowerCase();
  const rooms = state.rooms
    .filter((room) => type === "all" || room.type === type)
    .filter((room) => {
      const haystack = `${room.name} ${room.building} ${room.floor}`.toLowerCase();
      return !search || haystack.includes(search);
    });

  els.roomGrid.innerHTML = rooms.map((room) => {
    const freeCount = countBookableSlots(room.id, selectedWeekStart);
    const teacher = findTeacher(room.responsibleTeacherId);
    const icon = getRoomIcon(room);
    return `
      <button class="room-card ${room.active ? "" : "is-inactive"}" type="button" data-room-id="${room.id}">
        <span class="room-icon">${icon}</span>
        <span class="room-card-title">${escapeHtml(room.name)}</span>
        <span class="room-card-type">${room.type === "fixed_schedule" ? "Klassensaal" : "Buchbarer Raum"}</span>
        <span class="room-card-meta">${escapeHtml(room.building)}, ${escapeHtml(room.floor || "-")}</span>
        <span class="room-card-meta">${room.capacity || "-"} Plaetze</span>
        ${teacher ? `<span class="room-card-meta">Klassenlehrer/in: ${escapeHtml(teacher.name)}</span>` : ""}
        <span class="availability-pill">${room.active ? `${freeCount} buchbare Stunden diese Woche` : "Inaktiv"}</span>
      </button>
    `;
  }).join("");

  els.roomGrid.querySelectorAll("[data-room-id]").forEach((card) => {
    card.addEventListener("click", () => openRoom(card.dataset.roomId));
  });
}

function openRoom(roomId) {
  selectedRoomId = roomId;
  selectedWeekStart = clampWeekToSchoolYear(getMonday(new Date()));
  showRoomDetail();
}

function showRoomDetail() {
  showView("roomDetail");
  const room = findRoom(selectedRoomId);
  const teacher = findTeacher(room.responsibleTeacherId);
  els.pageSubtitle.textContent = room.name;
  els.roomTitle.textContent = room.name;
  els.roomMeta.textContent = `${room.type === "fixed_schedule" ? "Klassensaal mit fixem Stundenplan" : "Frei buchbarer Raum"} · ${room.building} · ${room.floor || "-"} · ${room.capacity || "-"} Plaetze`;
  els.roomTags.innerHTML = [
    teacher ? `Zustaendig: ${teacher.name}` : null,
    room.active ? "Aktiv" : "Inaktiv"
  ].filter(Boolean).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  els.scheduleActions.classList.toggle("hidden", room.type !== "fixed_schedule" || !canEditRoomSchedule(room));
  renderCalendar();
}

function renderCalendar() {
  const room = findRoom(selectedRoomId);
  const weekDates = getWeekDates(selectedWeekStart);
  const editableWeek = canModifyWeek(selectedWeekStart);
  renderDatePicker();
  els.weekLabel.textContent = `${formatUiDate(weekDates[0])} - ${formatUiDate(weekDates[6])}`;
  els.weekRule.textContent = editableWeek ? "Aktuelle/naechste Woche: Buchungen moeglich" : "Nur Ansicht: Buchungen erst in aktueller oder naechster Woche moeglich";
  els.prevWeek.disabled = formatDate(selectedWeekStart) <= formatDate(getSchoolYearFirstWeek());
  els.nextWeek.disabled = formatDate(selectedWeekStart) >= formatDate(getSchoolYearLastWeek());

  const header = `
    <thead>
      <tr>
        <th>Zeit</th>
        ${DAYS.map((day, index) => `<th>${day}<span>${formatUiDate(weekDates[index])}</span></th>`).join("")}
      </tr>
    </thead>
  `;

  const body = SLOT_ROWS.map((slotRow) => `
    <tr>
      <th class="slot-header">${slotRow.label}<span>${getSlotKindLabel(slotRow.kind)}</span></th>
      ${DAYS.map((day, dayIndex) => {
        const date = formatDate(weekDates[dayIndex]);
        const daySlot = getSlotForDay(day, slotRow.id);
        const cell = getCellStatus(room.id, date, day, slotRow.id);
        const canReserve = canBook(room.id, date, day, slotRow.id, currentUser.id).ok;
        return `
          <td>
            <button class="calendar-cell ${cell.cssClass}" type="button"
              data-date="${date}" data-day="${day}" data-slot-id="${slotRow.id}">
              <span class="cell-time">${daySlot.start}-${daySlot.end}</span>
              <span class="cell-status">${cell.label}</span>
              <span class="cell-main">${escapeHtml(cell.title)}</span>
              <span class="cell-note">${escapeHtml(cell.detail || "")}</span>
              ${canReserve ? `<span class="cell-action">Reservieren</span>` : ""}
            </button>
          </td>
        `;
      }).join("")}
    </tr>
  `).join("");

  els.roomCalendar.innerHTML = `${header}<tbody>${body}</tbody>`;
  els.roomCalendar.querySelectorAll(".calendar-cell").forEach((cell) => {
    cell.addEventListener("click", () => openCellDialog({
      room,
      date: cell.dataset.date,
      day: cell.dataset.day,
      slotId: cell.dataset.slotId
    }));
  });
}

function openCellDialog({ room, date, day, slotId }) {
  const slot = getSlotForDay(day, slotId);
  const status = getCellStatus(room.id, date, day, slotId);
  const bookingCheck = canBook(room.id, date, day, slotId, currentUser.id);
  const reservation = findReservation(room.id, date, slotId);
  const canRelease = canReleaseSlot(room);

  let html = `
    <div class="detail-grid">
      <span>Raum</span><strong>${escapeHtml(room.name)}</strong>
      <span>Termin</span><strong>${day}, ${formatUiDate(parseDate(date))}, ${slot.start}-${slot.end}</strong>
      <span>Status</span><strong>${escapeHtml(status.title)}</strong>
      ${status.detail ? `<span>Hinweis</span><strong>${escapeHtml(status.detail)}</strong>` : ""}
    </div>
  `;

  if (reservation) {
    const owner = findTeacher(reservation.teacherId);
    html += `
      <div class="detail-grid">
        <span>Reserviert von</span><strong>${escapeHtml(owner?.name || "-")}</strong>
        <span>Zweite Person</span><strong>${escapeHtml(reservation.secondPerson || "-")}</strong>
        <span>Notiz</span><strong>${escapeHtml(reservation.note || "-")}</strong>
      </div>
    `;
    if (canDeleteReservation(reservation)) {
      html += `<button class="danger-button full-width" data-action="delete-reservation" data-id="${reservation.id}">Reservierung loeschen</button>`;
    }
  } else if (bookingCheck.ok) {
    html += reservationFormHtml(room.id, date, day, slotId);
  } else {
    html += `<p class="notice">${escapeHtml(bookingCheck.message)}</p>`;
  }

  if (!reservation && room.type === "fixed_schedule" && canRelease && canModifyWeek(getMonday(parseDate(date))) && status.kind === "fixed") {
    html += `<button class="secondary-button full-width" data-action="release-slot">Diese Stunde einmalig freigeben</button>`;
  }

  openModal(`${room.name} · ${slot.label}`, html);

  const form = document.getElementById("reservation-form");
  if (form) {
    form.addEventListener("submit", (event) => handleCreateReservation(event, room.id, date, day, slotId));
  }
  const deleteButton = els.modalBody.querySelector("[data-action='delete-reservation']");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      deleteReservation(deleteButton.dataset.id, currentUser.id);
      closeModal();
    });
  }
  const releaseButton = els.modalBody.querySelector("[data-action='release-slot']");
  if (releaseButton) {
    releaseButton.addEventListener("click", () => replaceModalWithManualRelease(room, date, day, slotId));
  }
}

function reservationFormHtml(roomId, date, day, slotId) {
  const otherTeachers = state.teachers
    .filter((teacher) => teacher.id !== currentUser.id)
    .map((teacher) => `<option value="${escapeHtml(teacher.name)}">${escapeHtml(teacher.name)}</option>`)
    .join("");

  return `
    <form id="reservation-form" class="form-stack">
      <input type="hidden" name="roomId" value="${roomId}">
      <input type="hidden" name="date" value="${date}">
      <input type="hidden" name="day" value="${day}">
      <input type="hidden" name="slotId" value="${slotId}">
      <label>
        Reserviert von
        <input value="${escapeHtml(currentUser.name)}" disabled>
      </label>
      <label>
        Zweite Person
        <input name="secondPerson" list="teacher-options" placeholder="Name der zweiten Person">
        <datalist id="teacher-options">${otherTeachers}</datalist>
      </label>
      <label>
        Kurze Notiz
        <textarea name="note" rows="3" placeholder="z. B. Foerdergruppe, Elterngespraech, Projekt ..." required></textarea>
      </label>
      <button class="primary-button full-width" type="submit">Reservierung speichern</button>
    </form>
  `;
}

async function handleCreateReservation(event, roomId, date, day, slotId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const note = String(formData.get("note") || "").trim();
  const secondPerson = String(formData.get("secondPerson") || "").trim();
  const result = await createReservation(roomId, date, day, slotId, currentUser.id, secondPerson, note);
  if (result.ok) {
    closeModal();
    showToast("Der Raum wurde reserviert.", "success");
    refreshCurrentView();
  } else {
    showToast(result.message, "error");
  }
}

async function createReservation(roomId, date, day, slotId, teacherId, secondPerson, note) {
  if (!note.trim()) return { ok: false, message: "Bitte gib eine kurze Notiz fuer die Reservierung ein." };
  const bookingCheck = canBook(roomId, date, day, slotId, teacherId);
  if (!bookingCheck.ok) return bookingCheck;

  const reservation = {
    id: uniqueId("res"),
    roomId,
    teacherId,
    secondPerson,
    date,
    day,
    slotId,
    note,
    createdAt: new Date().toISOString()
  };
  const remote = await remoteInsert("reservations", {
    id: reservation.id,
    room_id: roomId,
    teacher_id: teacherId,
    second_person: secondPerson,
    date,
    day,
    slot_id: slotId,
    note
  });
  if (!remote.ok) return { ok: false, message: remote.message };

  state.reservations.push(reservation);
  saveData();
  return { ok: true };
}

async function deleteReservation(reservationId, currentTeacherId) {
  const reservation = state.reservations.find((item) => item.id === reservationId);
  if (!reservation) return;
  if (!isAdmin() && reservation.teacherId !== currentTeacherId) {
    showToast("Du darfst diese Reservierung nicht loeschen.", "error");
    return;
  }
  const remote = await remoteDelete("reservations", { id: reservationId });
  if (!remote.ok) {
    showToast(remote.message, "error");
    return;
  }
  state.reservations = state.reservations.filter((item) => item.id !== reservationId);
  saveData();
  showToast("Die Reservierung wurde geloescht.", "success");
  refreshCurrentView();
}

function replaceModalWithManualRelease(room, date, day, slotId) {
  openModal("Stunde freigeben", `
    <form id="manual-release-form" class="form-stack">
      <label>
        Grund
        <select name="reason" required>
          <option value="Turnen">Turnen</option>
          <option value="Schwimmen">Schwimmen</option>
          <option value="Ausflug">Ausflug</option>
          <option value="Bibliothek">Bibliothek</option>
          <option value="Projekt ausserhalb">Projekt ausserhalb</option>
          <option value="Informatik in anderem Raum">Informatik in anderem Raum</option>
          <option value="Musik in anderem Raum">Musik in anderem Raum</option>
          <option value="Sonstiges">Sonstiges</option>
        </select>
      </label>
      <label>
        Notiz
        <input name="note" placeholder="Optional">
      </label>
      <button class="primary-button full-width" type="submit">Stunde freigeben</button>
    </form>
  `);

  document.getElementById("manual-release-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const result = await releaseFixedScheduleSlot(room.id, date, day, slotId, data.get("reason"), data.get("note"), currentUser.id);
    if (result.ok) {
      closeModal();
      showToast("Die Stunde wurde freigegeben.", "success");
      refreshCurrentView();
    } else {
      showToast(result.message, "error");
    }
  });
}

async function releaseFixedScheduleSlot(roomId, date, day, slotId, reason, note, currentTeacherId) {
  const room = findRoom(roomId);
  if (!room || room.type !== "fixed_schedule") return { ok: false, message: "Nur Klassensaele koennen freigegeben werden." };
  if (!canReleaseSlot(room)) return { ok: false, message: "Du darfst diesen Klassensaal nicht freigeben." };
  if (findReservation(roomId, date, slotId)) return { ok: false, message: "Diese Stunde wurde bereits reserviert." };

  const release = {
    id: uniqueId("rel"),
    roomId,
    date,
    day,
    slotId,
    reason: String(reason),
    note: String(note || ""),
    createdBy: currentTeacherId
  };

  if (isSupabaseMode()) {
    await remoteDelete("manual_releases", { room_id: roomId, date, slot_id: slotId });
  }
  const remote = await remoteInsert("manual_releases", {
    id: release.id,
    room_id: roomId,
    date,
    day,
    slot_id: slotId,
    reason: release.reason,
    note: release.note,
    created_by: currentTeacherId
  });
  if (!remote.ok) return { ok: false, message: remote.message };

  state.manualReleases = state.manualReleases.filter((item) => !(item.roomId === roomId && item.date === date && item.slotId === slotId));
  state.manualReleases.push(release);
  saveData();
  return { ok: true };
}

function openScheduleEditor() {
  const room = findRoom(selectedRoomId);
  if (!canEditRoomSchedule(room)) return;

  const rows = DAYS.map((day) => `
    <h3>${day}</h3>
    ${getSlotsForDay(day).filter((slot) => slot.kind === "lesson").map((slot) => {
      const entry = state.fixedSchedule.find((item) => item.roomId === room.id && item.day === day && item.slotId === slot.id);
      return `
        <div class="schedule-edit-row">
          <label>
            ${slot.label} (${slot.start}-${slot.end})
            <input name="${day}|${slot.id}|subject" value="${escapeHtml(entry?.subject || "")}" placeholder="Fach oder Aktivitaet">
          </label>
          <label>
            Lehrperson
            <select name="${day}|${slot.id}|teacherId">
              <option value="">Keine Zuordnung</option>
              ${teacherOptions(entry?.teacherId)}
            </select>
          </label>
        </div>
      `;
    }).join("")}
  `).join("");

  openModal("Stundenplan bearbeiten", `
    <form id="schedule-editor-form" class="form-stack schedule-editor">
      ${rows}
      <button class="primary-button full-width" type="submit">Stundenplan speichern</button>
    </form>
  `);

  document.getElementById("schedule-editor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    for (const day of DAYS) {
      for (const slot of getSlotsForDay(day).filter((item) => item.kind === "lesson")) {
        const subject = String(formData.get(`${day}|${slot.id}|subject`) || "").trim();
        const teacherId = String(formData.get(`${day}|${slot.id}|teacherId`) || "");
        const existing = state.fixedSchedule.find((item) => item.roomId === room.id && item.day === day && item.slotId === slot.id);
        if (!subject) {
          const remote = await remoteDelete("fixed_schedule", { room_id: room.id, day, slot_id: slot.id });
          if (!remote.ok) {
            showToast(remote.message, "error");
            return;
          }
          state.fixedSchedule = state.fixedSchedule.filter((item) => !(item.roomId === room.id && item.day === day && item.slotId === slot.id));
          continue;
        }
        const remote = await remoteUpsert("fixed_schedule", {
          room_id: room.id,
          day,
          slot_id: slot.id,
          subject,
          teacher_id: teacherId || null,
          status: "fix_belegt"
        }, "room_id,day,slot_id");
        if (!remote.ok) {
          showToast(remote.message, "error");
          return;
        }
        if (existing) {
          existing.subject = subject;
          existing.teacherId = teacherId;
        } else {
          state.fixedSchedule.push({ roomId: room.id, day, slotId: slot.id, subject, teacherId, status: "fix_belegt" });
        }
      }
    }
    saveData();
    closeModal();
    showToast("Der Stundenplan wurde gespeichert.", "success");
    renderCalendar();
  });
}

function openRecurringReleaseForm() {
  const room = findRoom(selectedRoomId);
  if (!canEditRoomSchedule(room)) return;

  openModal("Dauerhafte Freigabe", `
    <form id="recurring-release-form" class="form-stack">
      <label>
        Wochentag
        <select name="day">${DAYS.map((day) => `<option value="${day}">${day}</option>`).join("")}</select>
      </label>
      <label>
        Stunde
        <select name="slotId">${bookableSlotRows().map((slot) => `<option value="${slot.id}">${slot.label}</option>`).join("")}</select>
      </label>
      <label>
        Grund
        <input name="reason" placeholder="z. B. Schwimmen" required>
      </label>
      <div class="two-col">
        <label>
          Gueltig von
          <input name="validFrom" type="date" value="${state.meta.schoolYearStart}" required>
        </label>
        <label>
          Gueltig bis
          <input name="validUntil" type="date" value="${state.meta.schoolYearEnd}" required>
        </label>
      </div>
      <button class="primary-button full-width" type="submit">Dauerhafte Freigabe speichern</button>
    </form>
    <div class="compact-list">
      ${state.recurringReleases.filter((release) => release.roomId === room.id).map((release) => `
        <div class="compact-item">
          <strong>${release.day}, ${findSlotRow(release.slotId).label}</strong>
          <span>${escapeHtml(release.reason)} · ${formatUiDate(parseDate(release.validFrom))}-${formatUiDate(parseDate(release.validUntil))}</span>
          <button class="text-danger" data-delete-recurring="${release.id}" type="button">Loeschen</button>
        </div>
      `).join("") || `<p class="muted">Noch keine dauerhaften Freigaben.</p>`}
    </div>
  `);

  document.getElementById("recurring-release-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const release = {
      id: uniqueId("rr"),
      roomId: room.id,
      day: data.get("day"),
      slotId: data.get("slotId"),
      reason: data.get("reason"),
      validFrom: data.get("validFrom"),
      validUntil: data.get("validUntil"),
      createdBy: currentUser.id
    };
    const remote = await remoteInsert("recurring_releases", {
      id: release.id,
      room_id: release.roomId,
      day: release.day,
      slot_id: release.slotId,
      reason: release.reason,
      valid_from: release.validFrom,
      valid_until: release.validUntil,
      created_by: release.createdBy
    });
    if (!remote.ok) {
      showToast(remote.message, "error");
      return;
    }
    state.recurringReleases.push(release);
    saveData();
    closeModal();
    showToast("Die dauerhafte Freigabe wurde gespeichert.", "success");
    renderCalendar();
  });

  els.modalBody.querySelectorAll("[data-delete-recurring]").forEach((button) => {
    button.addEventListener("click", async () => {
      const remote = await remoteDelete("recurring_releases", { id: button.dataset.deleteRecurring });
      if (!remote.ok) {
        showToast(remote.message, "error");
        return;
      }
      state.recurringReleases = state.recurringReleases.filter((release) => release.id !== button.dataset.deleteRecurring);
      saveData();
      closeModal();
      showToast("Die dauerhafte Freigabe wurde geloescht.", "success");
      renderCalendar();
    });
  });
}

function renderMyReservations() {
  const reservations = state.reservations
    .filter((reservation) => reservation.teacherId === currentUser.id || isAdmin())
    .sort((a, b) => a.date.localeCompare(b.date));

  els.myReservationsList.innerHTML = reservations.map((reservation) => {
    const room = findRoom(reservation.roomId);
    const slot = getSlotForDay(reservation.day, reservation.slotId);
    const teacher = findTeacher(reservation.teacherId);
    return `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(room?.name || "-")}</strong>
          <span>${escapeHtml(reservation.day)}, ${formatUiDate(parseDate(reservation.date))}, ${slot.start}-${slot.end}</span>
          <span>${escapeHtml(teacher?.name || "-")} · ${escapeHtml(reservation.secondPerson || "keine zweite Person")}</span>
          <span>${escapeHtml(reservation.note || "")}</span>
        </div>
        <button class="danger-button" data-delete="${reservation.id}" type="button">Loeschen</button>
      </div>
    `;
  }).join("") || `<p class="muted">Keine Reservierungen vorhanden.</p>`;

  els.myReservationsList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteReservation(button.dataset.delete, currentUser.id));
  });
}

function renderAdmin() {
  if (!isAdmin()) {
    showView("rooms");
    return;
  }
  renderTeacherSelect();
  renderTeacherList();
  renderAdminRoomList();
  renderHolidayList();
  renderBlockTools();
}

function renderTeacherSelect() {
  els.roomResponsibleSelect.innerHTML = `<option value="">Keine zustaendige Lehrperson</option>` + state.teachers
    .filter((teacher) => teacher.teacherType === "class_teacher")
    .map((teacher) => `<option value="${teacher.id}">${escapeHtml(teacher.name)}</option>`)
    .join("");
}

function renderTeacherList() {
  els.teacherList.innerHTML = state.teachers.map((teacher) => `
    <div class="compact-item">
      <div>
        <strong>${escapeHtml(teacher.name)}</strong>
        <span>${escapeHtml(teacher.username)} · ${getRoleLabel(teacher)}</span>
      </div>
      <div class="compact-actions">
        <select data-role-teacher="${teacher.id}" ${teacher.id === "admin" ? "disabled" : ""} aria-label="Rolle fuer ${escapeHtml(teacher.name)}">
          <option value="subject_teacher" ${teacher.teacherType === "subject_teacher" ? "selected" : ""}>Nebenfachlehrer/in</option>
          <option value="class_teacher" ${teacher.teacherType === "class_teacher" ? "selected" : ""}>Klassenlehrer/in</option>
          <option value="admin" ${teacher.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
        ${teacher.id === "admin" ? "" : `<button class="text-danger" data-delete-teacher="${teacher.id}" type="button">Loeschen</button>`}
      </div>
    </div>
  `).join("");

  els.teacherList.querySelectorAll("[data-role-teacher]").forEach((select) => {
    select.addEventListener("change", () => updateTeacherRole(select.dataset.roleTeacher, select.value));
  });

  els.teacherList.querySelectorAll("[data-delete-teacher]").forEach((button) => {
    button.addEventListener("click", () => deleteTeacher(button.dataset.deleteTeacher));
  });
}

function renderAdminRoomList() {
  els.adminRoomList.innerHTML = state.rooms.map((room) => `
    <div class="compact-item">
      <div>
        <strong>${escapeHtml(room.name)}</strong>
        <span>${room.type === "fixed_schedule" ? "Klassensaal" : "Buchbarer Raum"} · ${room.active ? "aktiv" : "inaktiv"}</span>
      </div>
      <div class="compact-actions">
        <button class="secondary-button" data-toggle-room="${room.id}" type="button">${room.active ? "Deaktivieren" : "Aktivieren"}</button>
        <button class="text-danger" data-delete-room="${room.id}" type="button">Loeschen</button>
      </div>
    </div>
  `).join("");

  els.adminRoomList.querySelectorAll("[data-toggle-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      const room = findRoom(button.dataset.toggleRoom);
      const remote = await remoteUpdate("rooms", { active: !room.active }, { id: room.id });
      if (!remote.ok) {
        showToast(remote.message, "error");
        return;
      }
      room.active = !room.active;
      saveData();
      renderAdminRoomList();
      renderRoomOverview();
    });
  });

  els.adminRoomList.querySelectorAll("[data-delete-room]").forEach((button) => {
    button.addEventListener("click", () => deleteRoom(button.dataset.deleteRoom));
  });
}

function renderHolidayList() {
  els.holidayList.innerHTML = state.schoolHolidays.map((holiday) => `
    <div class="compact-item">
      <div>
        <strong>${escapeHtml(holiday.name)}</strong>
        <span>${formatUiDate(parseDate(holiday.startDate))}-${formatUiDate(parseDate(holiday.endDate))}</span>
      </div>
      <button class="text-danger" data-delete-holiday="${holiday.id}" type="button">Loeschen</button>
    </div>
  `).join("") || `<p class="muted">Keine Ferien eingetragen.</p>`;

  els.holidayList.querySelectorAll("[data-delete-holiday]").forEach((button) => {
    button.addEventListener("click", () => deleteHoliday(button.dataset.deleteHoliday));
  });
}

function renderBlockTools() {
  els.blockRoomSelect.innerHTML = state.rooms
    .map((room) => `<option value="${room.id}">${escapeHtml(room.name)}</option>`)
    .join("");
  els.blockSlotSelect.innerHTML = bookableSlotRows()
    .map((slot) => `<option value="${slot.id}">${slot.label}</option>`)
    .join("");
  els.blockList.innerHTML = state.roomBlocks
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((block) => {
      const room = findRoom(block.roomId);
      const slot = getSlotForDay(block.day, block.slotId);
      return `
        <div class="compact-item">
          <strong>${escapeHtml(room?.name || "-")}</strong>
          <span>${escapeHtml(block.day)}, ${formatUiDate(parseDate(block.date))}, ${slot.start}-${slot.end} · ${escapeHtml(block.reason)}</span>
          <button class="text-danger" data-delete-block="${block.id}" type="button">Loeschen</button>
        </div>
      `;
    }).join("") || `<p class="muted">Keine Sperrungen eingetragen.</p>`;

  els.blockList.querySelectorAll("[data-delete-block]").forEach((button) => {
    button.addEventListener("click", async () => {
      const remote = await remoteDelete("room_blocks", { id: button.dataset.deleteBlock });
      if (!remote.ok) {
        showToast(remote.message, "error");
        return;
      }
      state.roomBlocks = state.roomBlocks.filter((block) => block.id !== button.dataset.deleteBlock);
      saveData();
      renderBlockTools();
      refreshCurrentView();
      showToast("Die Sperrung wurde geloescht.", "success");
    });
  });
}

async function handleCreateTeacher(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const roleValue = data.get("role");

  if (isSupabaseMode()) {
    const { data: result, error } = await getSupabaseClient().functions.invoke("admin-create-teacher", {
      body: {
        name: data.get("name"),
        username: String(data.get("username")).trim(),
        password: String(data.get("password")),
        role: roleValue
      }
    });
    if (error || result?.error) {
      showToast(result?.error || error?.message || "Lehrperson konnte nicht angelegt werden.", "error");
      return;
    }
    await loadRemoteState();
  } else {
    state.teachers.push({
      id: uniqueId("t"),
      name: data.get("name"),
      username: String(data.get("username")).trim(),
      password: String(data.get("password")),
      role: roleValue === "admin" ? "admin" : "teacher",
      teacherType: roleValue
    });
  }
  saveData();
  event.target.reset();
  renderAdmin();
  showToast("Die Lehrperson wurde angelegt.", "success");
}

async function deleteTeacher(teacherId) {
  const teacher = findTeacher(teacherId);
  if (!teacher || teacher.id === "admin") {
    showToast("Das Admin-Konto kann nicht geloescht werden.", "error");
    return;
  }

  const reservationCount = state.reservations.filter((reservation) => reservation.teacherId === teacherId).length;
  const roomCount = state.rooms.filter((room) => room.responsibleTeacherId === teacherId).length;
  const confirmed = window.confirm(
    `${teacher.name} wirklich loeschen?\n\n` +
    `${reservationCount} Reservierung(en) werden entfernt.\n` +
    `${roomCount} Raum-Zustaendigkeit(en) werden geloest.`
  );
  if (!confirmed) return;

  const remote = await remoteDelete("teachers", { id: teacherId });
  if (!remote.ok) {
    showToast(remote.message, "error");
    return;
  }

  state.teachers = state.teachers.filter((item) => item.id !== teacherId);
  state.reservations = state.reservations.filter((reservation) => reservation.teacherId !== teacherId);
  state.rooms.forEach((room) => {
    if (room.responsibleTeacherId === teacherId) room.responsibleTeacherId = null;
  });
  state.fixedSchedule.forEach((entry) => {
    if (entry.teacherId === teacherId) entry.teacherId = "";
  });
  saveData();
  renderAdmin();
  refreshCurrentView();
  showToast("Die Lehrperson wurde geloescht.", "success");
}

async function updateTeacherRole(teacherId, roleValue) {
  const teacher = findTeacher(teacherId);
  if (!teacher || teacher.id === "admin") return;

  const remote = await remoteUpdate("teachers", {
    role: roleValue === "admin" ? "admin" : "teacher",
    teacher_type: roleValue
  }, { id: teacherId });
  if (!remote.ok) {
    showToast(remote.message, "error");
    renderAdmin();
    return;
  }

  teacher.role = roleValue === "admin" ? "admin" : "teacher";
  teacher.teacherType = roleValue;
  saveData();
  renderAdmin();
  els.adminButton.classList.toggle("hidden", !isAdmin());
  if (currentUser.id === teacherId) {
    currentUser = teacher;
    els.currentUserPill.textContent = `${currentUser.name} · ${getRoleLabel(currentUser)}`;
  }
  showToast("Die Rolle wurde aktualisiert.", "success");
}

async function handleCreateRoom(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const room = {
    id: uniqueId("r"),
    name: data.get("name"),
    type: data.get("type"),
    building: data.get("building") || "Hauptgebaeude",
    floor: data.get("floor") || "",
    capacity: Number(data.get("capacity")) || 0,
    responsibleTeacherId: data.get("responsibleTeacherId") || null,
    active: true
  };
  const remote = await remoteInsert("rooms", {
    id: room.id,
    name: room.name,
    type: room.type,
    building: room.building,
    floor: room.floor,
    capacity: room.capacity,
    responsible_teacher_id: room.responsibleTeacherId,
    active: true
  });
  if (!remote.ok) {
    showToast(remote.message, "error");
    return;
  }

  state.rooms.push(room);
  saveData();
  event.target.reset();
  renderAdmin();
  showToast("Der Raum wurde angelegt.", "success");
}

async function deleteRoom(roomId) {
  const room = findRoom(roomId);
  if (!room) return;

  const reservationCount = state.reservations.filter((reservation) => reservation.roomId === roomId).length;
  const confirmed = window.confirm(
    `${room.name} wirklich loeschen?\n\n` +
    `${reservationCount} Reservierung(en), Stundenplaneintraege, Freigaben und Sperrungen fuer diesen Raum werden entfernt.`
  );
  if (!confirmed) return;

  const remote = await remoteDelete("rooms", { id: roomId });
  if (!remote.ok) {
    showToast(remote.message, "error");
    return;
  }

  state.rooms = state.rooms.filter((item) => item.id !== roomId);
  state.fixedSchedule = state.fixedSchedule.filter((entry) => entry.roomId !== roomId);
  state.recurringReleases = state.recurringReleases.filter((release) => release.roomId !== roomId);
  state.manualReleases = state.manualReleases.filter((release) => release.roomId !== roomId);
  state.reservations = state.reservations.filter((reservation) => reservation.roomId !== roomId);
  state.roomBlocks = state.roomBlocks.filter((block) => block.roomId !== roomId);

  if (selectedRoomId === roomId) {
    selectedRoomId = null;
    currentView = "admin";
  }

  saveData();
  renderAdmin();
  renderRoomOverview();
  showToast("Der Raum wurde geloescht.", "success");
}

async function handleCreateHoliday(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const holiday = {
    id: uniqueId("h"),
    name: data.get("name"),
    startDate: data.get("startDate"),
    endDate: data.get("endDate"),
    createdBy: currentUser.id
  };
  const remote = await remoteInsert("school_holidays", {
    id: holiday.id,
    name: holiday.name,
    start_date: holiday.startDate,
    end_date: holiday.endDate,
    created_by: holiday.createdBy
  });
  if (!remote.ok) {
    showToast(remote.message, "error");
    return;
  }
  state.schoolHolidays.push(holiday);
  saveData();
  event.target.reset();
  renderHolidayList();
  refreshCurrentView();
  showToast("Die Ferien wurden eingetragen.", "success");
}

async function deleteHoliday(holidayId) {
  const holiday = state.schoolHolidays.find((item) => item.id === holidayId);
  if (!holiday) return;
  const confirmed = window.confirm(`${holiday.name} wirklich loeschen?`);
  if (!confirmed) return;
  const remote = await remoteDelete("school_holidays", { id: holidayId });
  if (!remote.ok) {
    showToast(remote.message, "error");
    return;
  }
  state.schoolHolidays = state.schoolHolidays.filter((item) => item.id !== holidayId);
  saveData();
  renderHolidayList();
  refreshCurrentView();
  showToast("Die Ferien wurden geloescht.", "success");
}

async function handleCreateBlock(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const date = String(data.get("date"));
  const day = getDayName(parseDate(date));
  const block = {
    id: uniqueId("block"),
    roomId: data.get("roomId"),
    date,
    day,
    slotId: data.get("slotId"),
    reason: data.get("reason"),
    createdBy: currentUser.id
  };
  const remote = await remoteInsert("room_blocks", {
    id: block.id,
    room_id: block.roomId,
    date: block.date,
    day: block.day,
    slot_id: block.slotId,
    reason: block.reason,
    created_by: block.createdBy
  });
  if (!remote.ok) {
    showToast(remote.message, "error");
    return;
  }
  state.roomBlocks.push(block);
  saveData();
  event.target.reset();
  renderBlockTools();
  refreshCurrentView();
  showToast("Der Raum wurde gesperrt.", "success");
}

function resetDataFromAdmin() {
  if (isSupabaseMode()) {
    showToast("In Supabase werden Daten nicht per Demo-Reset geloescht. Nutze dafuer die Datenbankverwaltung.", "error");
    return;
  }
  const confirmed = window.confirm("Beispieldaten wirklich zuruecksetzen? Lokale Aenderungen gehen verloren.");
  if (!confirmed) return;
  resetData();
  currentUser = state.teachers.find((teacher) => teacher.id === "admin");
  sessionStorage.setItem("sallplan.currentUserId", currentUser.id);
  startApp();
  showToast("Die Daten wurden zurueckgesetzt.", "success");
}

function getCellStatus(roomId, date, day, slotId) {
  const room = findRoom(roomId);
  const slot = getSlotForDay(day, slotId);
  const block = state.roomBlocks.find((item) => item.roomId === roomId && item.date === date && item.slotId === slotId);
  const reservation = findReservation(roomId, date, slotId);
  const holiday = getHolidayForDate(date);

  if (!room?.active) return status("inactive", "Inaktiv", "Raum deaktiviert", "Nicht buchbar", "status-blocked");
  if (block) return status("blocked", "Gesperrt", `Gesperrt: ${block.reason}`, "Nicht buchbar", "status-blocked");
  if (reservation) {
    const teacher = findTeacher(reservation.teacherId);
    const own = reservation.teacherId === currentUser?.id;
    return status("reserved", own ? "Eigene Reservierung" : "Reserviert", `Reserviert: ${teacher?.name || "-"}`, reservation.note, own ? "status-own-reservation" : "status-reserved");
  }
  if (slot?.kind === "short_break") return status("pause", "Pause", "Kleine Pause", "Nicht buchbar", "status-pause");
  if (holiday) return status("holiday_free", "Ferien", `Ferien: ${holiday.name}`, "Buchbar im Buchungsfenster", "status-holiday");
  if (slot?.kind === "lunch_break") return status("free_bookable", "Frei", "Mittagspause", "Buchbar", "status-free");
  if (room.type === "free_booking") return status("free_bookable", "Frei", "Frei buchbar", "Keine Buchung vorhanden", "status-free");

  const recurring = state.recurringReleases.find((item) => item.roomId === roomId && item.day === day && item.slotId === slotId && date >= item.validFrom && date <= item.validUntil);
  if (recurring) return status("released", "Freigegeben", `Frei wegen ${recurring.reason}`, "Dauerhafte Freigabe", "status-released");

  const manual = state.manualReleases.find((item) => item.roomId === roomId && item.date === date && item.slotId === slotId);
  if (manual) return status("released", "Freigegeben", `Frei wegen ${manual.reason}`, manual.note || "Einmalige Freigabe", "status-released");

  const fixed = state.fixedSchedule.find((item) => item.roomId === roomId && item.day === day && item.slotId === slotId);
  if (fixed) {
    const teacher = findTeacher(fixed.teacherId);
    return status("fixed", "Belegt", `Belegt: ${fixed.subject}`, teacher ? `Lehrperson: ${teacher.name}` : "Keine Lehrperson zugeordnet", "status-fixed");
  }

  return status("free_bookable", "Frei", "Frei buchbar", "Kein Unterricht eingetragen", "status-free");
}

function canBook(roomId, date, day, slotId, teacherId) {
  const room = findRoom(roomId);
  if (!room?.active) return { ok: false, message: "Dieser Raum ist deaktiviert." };
  if (!canModifyWeek(getMonday(parseDate(date)))) return { ok: false, message: "Nur die aktuelle und die naechste Woche sind buchbar." };
  const statusInfo = getCellStatus(roomId, date, day, slotId);
  if (statusInfo.kind === "blocked") return { ok: false, message: "Dieser Raum wurde gesperrt." };
  if (statusInfo.kind === "reserved") return { ok: false, message: "Dieser Raum ist zu dieser Zeit bereits reserviert." };
  if (statusInfo.kind === "pause") return { ok: false, message: "Kleine Pausen sind nicht buchbar." };
  if (["free_bookable", "released", "holiday_free"].includes(statusInfo.kind)) return { ok: true };
  if (isAdmin(findTeacher(teacherId)) && statusInfo.kind === "fixed") return { ok: true };
  if (statusInfo.kind === "fixed") return { ok: false, message: "Dieser Raum ist zu dieser Zeit fix belegt." };
  return { ok: false, message: "Dieser Slot ist nicht buchbar." };
}

function canModifyWeek(weekStart) {
  const currentMonday = getMonday(new Date());
  const nextMonday = addDays(currentMonday, 7);
  const key = formatDate(weekStart);
  return key === formatDate(currentMonday) || key === formatDate(nextMonday);
}

function canEditRoomSchedule(room) {
  return isAdmin() || (currentUser?.teacherType === "class_teacher" && room?.responsibleTeacherId === currentUser.id);
}

function canReleaseSlot(room) {
  return room.type === "fixed_schedule" && canEditRoomSchedule(room);
}

function canDeleteReservation(reservation) {
  return isAdmin() || reservation.teacherId === currentUser.id;
}

function isAdmin(user = currentUser) {
  return user?.role === "admin";
}

function refreshCurrentView() {
  if (currentView === "roomDetail") renderCalendar();
  if (currentView === "rooms") renderRoomOverview();
  if (currentView === "myReservations") renderMyReservations();
  if (currentView === "admin") renderAdmin();
}

function changeWeek(days) {
  selectedWeekStart = clampWeekToSchoolYear(addDays(selectedWeekStart, days));
  renderCalendar();
}

function countBookableSlots(roomId, weekStart) {
  let count = 0;
  const dates = getWeekDates(weekStart);
  DAYS.forEach((day, dayIndex) => {
    getSlotsForDay(day).forEach((slot) => {
      if (canBook(roomId, formatDate(dates[dayIndex]), day, slot.id, currentUser?.id).ok) count += 1;
    });
  });
  return count;
}

function getWeekDates(weekStart) {
  return DAYS.map((_, index) => addDays(weekStart, index));
}

function getHolidayForDate(date) {
  return state.schoolHolidays.find((holiday) => date >= holiday.startDate && date <= holiday.endDate);
}

function findRoom(id) {
  return state.rooms.find((room) => room.id === id);
}

function findTeacher(id) {
  return state.teachers.find((teacher) => teacher.id === id);
}

function findSlotRow(id) {
  return SLOT_ROWS.find((slot) => slot.id === id);
}

function findReservation(roomId, date, slotId) {
  return state.reservations.find((item) => item.roomId === roomId && item.date === date && item.slotId === slotId);
}

function getRoleLabel(user) {
  if (user.role === "admin") return "Admin";
  if (user.teacherType === "class_teacher") return "Klassenlehrer/in";
  return "Nebenfachlehrer/in";
}

function getStorageModeLabel() {
  const config = window.SALLPLAN_CONFIG || {};
  return config.mode === "supabase" ? "Supabase" : "Demo";
}

function bookableSlotRows() {
  return SLOT_ROWS.filter((slot) => slot.kind !== "short_break");
}

function getSlotKindLabel(kind) {
  if (kind === "short_break") return "nicht buchbar";
  if (kind === "lunch_break") return "buchbar";
  return "Unterricht";
}

function teacherOptions(selectedTeacherId) {
  return state.teachers
    .filter((teacher) => teacher.role !== "admin")
    .map((teacher) => `<option value="${teacher.id}" ${teacher.id === selectedTeacherId ? "selected" : ""}>${escapeHtml(teacher.name)}</option>`)
    .join("");
}

function renderDatePicker() {
  els.weekDatePicker.min = state.meta.schoolYearStart;
  els.weekDatePicker.max = state.meta.schoolYearEnd;
  els.weekDatePicker.value = formatDate(selectedWeekStart);
}

function getSchoolWeekStarts() {
  const first = getSchoolYearFirstWeek();
  const last = getSchoolYearLastWeek();
  const weeks = [];
  for (let cursor = new Date(first); formatDate(cursor) <= formatDate(last); cursor = addDays(cursor, 7)) {
    weeks.push(new Date(cursor));
  }
  return weeks;
}

function getSchoolYearFirstWeek() {
  return getMonday(parseDate(state.meta.schoolYearStart));
}

function getSchoolYearLastWeek() {
  return getMonday(parseDate(state.meta.schoolYearEnd));
}

function clampWeekToSchoolYear(weekStart) {
  const first = getSchoolYearFirstWeek();
  const last = getSchoolYearLastWeek();
  if (formatDate(weekStart) < formatDate(first)) return first;
  if (formatDate(weekStart) > formatDate(last)) return last;
  return weekStart;
}

function getDayName(date) {
  const index = date.getDay();
  return index === 0 ? "Sonntag" : DAYS[index - 1];
}

function getRoomIcon(room) {
  if (room.type === "fixed_schedule") return "KS";
  if (room.name.toLowerCase().includes("musik")) return "MU";
  if (room.name.toLowerCase().includes("informatik")) return "IT";
  if (room.name.toLowerCase().includes("bibliothek")) return "BI";
  if (room.name.toLowerCase().includes("besprech")) return "BE";
  return "FR";
}

function status(kind, label, title, detail, cssClass) {
  return { kind, label, title, detail, cssClass };
}

function openModal(title, html) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = html;
  els.modal.classList.remove("hidden");
}

function closeModal() {
  els.modal.classList.add("hidden");
  els.modalBody.innerHTML = "";
}

function showToast(message, type = "info") {
  els.toast.textContent = message;
  els.toast.className = `toast show ${type}`;
  window.setTimeout(() => {
    els.toast.className = "toast";
  }, 3200);
}

async function copyRoomLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("roomId", selectedRoomId);
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast("Der Raumlink wurde kopiert.", "success");
  } catch {
    showToast(url.toString(), "info");
  }
}

function uniqueId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatUiDate(date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toCamel(id) {
  return id.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
