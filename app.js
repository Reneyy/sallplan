let state = loadData();
let currentUser = null;
let currentView = "rooms";
let selectedRoomId = null;
let selectedWeekStart = getMonday(new Date());

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  restoreSession();
});

function bindElements() {
  [
    "login-screen", "login-form", "login-username", "login-password", "app",
    "current-user-pill", "logout-button", "room-overview", "room-grid",
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
  localStorage.setItem(SALLPLAN_STORAGE_KEY, JSON.stringify(state));
}

function resetData() {
  state = createDefaultState();
  saveData();
}

function restoreSession() {
  const savedUserId = sessionStorage.getItem("sallplan.currentUserId");
  if (savedUserId) {
    currentUser = findTeacher(savedUserId);
  }

  if (currentUser) {
    startApp();
  } else {
    els.loginScreen.classList.remove("hidden");
    els.app.classList.add("hidden");
  }
}

function handleLogin(event) {
  event.preventDefault();
  const username = els.loginUsername.value.trim().toLowerCase();
  const password = els.loginPassword.value;
  const user = state.teachers.find((teacher) => teacher.username.toLowerCase() === username && teacher.password === password);

  if (!user) {
    showToast("Login fehlgeschlagen. Bitte Benutzername und Passwort pruefen.", "error");
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
  els.adminButton.classList.toggle("hidden", !isAdmin());

  const roomFromUrl = new URLSearchParams(window.location.search).get("roomId");
  if (roomFromUrl && state.rooms.some((room) => room.id === roomFromUrl)) {
    openRoom(roomFromUrl);
  } else {
    showView("rooms");
  }
}

function logout() {
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

function handleCreateReservation(event, roomId, date, day, slotId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const note = String(formData.get("note") || "").trim();
  const secondPerson = String(formData.get("secondPerson") || "").trim();
  const result = createReservation(roomId, date, day, slotId, currentUser.id, secondPerson, note);
  if (result.ok) {
    closeModal();
    showToast("Der Raum wurde reserviert.", "success");
    refreshCurrentView();
  } else {
    showToast(result.message, "error");
  }
}

function createReservation(roomId, date, day, slotId, teacherId, secondPerson, note) {
  if (!note.trim()) return { ok: false, message: "Bitte gib eine kurze Notiz fuer die Reservierung ein." };
  const bookingCheck = canBook(roomId, date, day, slotId, teacherId);
  if (!bookingCheck.ok) return bookingCheck;

  state.reservations.push({
    id: uniqueId("res"),
    roomId,
    teacherId,
    secondPerson,
    date,
    day,
    slotId,
    note,
    createdAt: new Date().toISOString()
  });
  saveData();
  return { ok: true };
}

function deleteReservation(reservationId, currentTeacherId) {
  const reservation = state.reservations.find((item) => item.id === reservationId);
  if (!reservation) return;
  if (!isAdmin() && reservation.teacherId !== currentTeacherId) {
    showToast("Du darfst diese Reservierung nicht loeschen.", "error");
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

  document.getElementById("manual-release-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const result = releaseFixedScheduleSlot(room.id, date, day, slotId, data.get("reason"), data.get("note"), currentUser.id);
    if (result.ok) {
      closeModal();
      showToast("Die Stunde wurde freigegeben.", "success");
      refreshCurrentView();
    } else {
      showToast(result.message, "error");
    }
  });
}

function releaseFixedScheduleSlot(roomId, date, day, slotId, reason, note, currentTeacherId) {
  const room = findRoom(roomId);
  if (!room || room.type !== "fixed_schedule") return { ok: false, message: "Nur Klassensaele koennen freigegeben werden." };
  if (!canReleaseSlot(room)) return { ok: false, message: "Du darfst diesen Klassensaal nicht freigeben." };
  if (findReservation(roomId, date, slotId)) return { ok: false, message: "Diese Stunde wurde bereits reserviert." };

  state.manualReleases = state.manualReleases.filter((release) => !(release.roomId === roomId && release.date === date && release.slotId === slotId));
  state.manualReleases.push({
    id: uniqueId("rel"),
    roomId,
    date,
    day,
    slotId,
    reason: String(reason),
    note: String(note || ""),
    createdBy: currentTeacherId
  });
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

  document.getElementById("schedule-editor-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    DAYS.forEach((day) => {
      getSlotsForDay(day).filter((slot) => slot.kind === "lesson").forEach((slot) => {
        const subject = String(formData.get(`${day}|${slot.id}|subject`) || "").trim();
        const teacherId = String(formData.get(`${day}|${slot.id}|teacherId`) || "");
        const existing = state.fixedSchedule.find((item) => item.roomId === room.id && item.day === day && item.slotId === slot.id);
        if (!subject) {
          state.fixedSchedule = state.fixedSchedule.filter((item) => !(item.roomId === room.id && item.day === day && item.slotId === slot.id));
          return;
        }
        if (existing) {
          existing.subject = subject;
          existing.teacherId = teacherId;
        } else {
          state.fixedSchedule.push({ roomId: room.id, day, slotId: slot.id, subject, teacherId, status: "fix_belegt" });
        }
      });
    });
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

  document.getElementById("recurring-release-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    state.recurringReleases.push({
      id: uniqueId("rr"),
      roomId: room.id,
      day: data.get("day"),
      slotId: data.get("slotId"),
      reason: data.get("reason"),
      validFrom: data.get("validFrom"),
      validUntil: data.get("validUntil"),
      createdBy: currentUser.id
    });
    saveData();
    closeModal();
    showToast("Die dauerhafte Freigabe wurde gespeichert.", "success");
    renderCalendar();
  });

  els.modalBody.querySelectorAll("[data-delete-recurring]").forEach((button) => {
    button.addEventListener("click", () => {
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
    button.addEventListener("click", () => {
      const room = findRoom(button.dataset.toggleRoom);
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
    button.addEventListener("click", () => {
      state.roomBlocks = state.roomBlocks.filter((block) => block.id !== button.dataset.deleteBlock);
      saveData();
      renderBlockTools();
      refreshCurrentView();
      showToast("Die Sperrung wurde geloescht.", "success");
    });
  });
}

function handleCreateTeacher(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const roleValue = data.get("role");
  state.teachers.push({
    id: uniqueId("t"),
    name: data.get("name"),
    username: String(data.get("username")).trim(),
    password: String(data.get("password")),
    role: roleValue === "admin" ? "admin" : "teacher",
    teacherType: roleValue
  });
  saveData();
  event.target.reset();
  renderAdmin();
  showToast("Die Lehrperson wurde angelegt.", "success");
}

function deleteTeacher(teacherId) {
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

function updateTeacherRole(teacherId, roleValue) {
  const teacher = findTeacher(teacherId);
  if (!teacher || teacher.id === "admin") return;

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

function handleCreateRoom(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  state.rooms.push({
    id: uniqueId("r"),
    name: data.get("name"),
    type: data.get("type"),
    building: data.get("building") || "Hauptgebaeude",
    floor: data.get("floor") || "",
    capacity: Number(data.get("capacity")) || 0,
    responsibleTeacherId: data.get("responsibleTeacherId") || null,
    active: true
  });
  saveData();
  event.target.reset();
  renderAdmin();
  showToast("Der Raum wurde angelegt.", "success");
}

function deleteRoom(roomId) {
  const room = findRoom(roomId);
  if (!room) return;

  const reservationCount = state.reservations.filter((reservation) => reservation.roomId === roomId).length;
  const confirmed = window.confirm(
    `${room.name} wirklich loeschen?\n\n` +
    `${reservationCount} Reservierung(en), Stundenplaneintraege, Freigaben und Sperrungen fuer diesen Raum werden entfernt.`
  );
  if (!confirmed) return;

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

function handleCreateHoliday(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  state.schoolHolidays.push({
    id: uniqueId("h"),
    name: data.get("name"),
    startDate: data.get("startDate"),
    endDate: data.get("endDate"),
    createdBy: currentUser.id
  });
  saveData();
  event.target.reset();
  renderHolidayList();
  refreshCurrentView();
  showToast("Die Ferien wurden eingetragen.", "success");
}

function deleteHoliday(holidayId) {
  const holiday = state.schoolHolidays.find((item) => item.id === holidayId);
  if (!holiday) return;
  const confirmed = window.confirm(`${holiday.name} wirklich loeschen?`);
  if (!confirmed) return;
  state.schoolHolidays = state.schoolHolidays.filter((item) => item.id !== holidayId);
  saveData();
  renderHolidayList();
  refreshCurrentView();
  showToast("Die Ferien wurden geloescht.", "success");
}

function handleCreateBlock(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const date = String(data.get("date"));
  const day = getDayName(parseDate(date));
  state.roomBlocks.push({
    id: uniqueId("block"),
    roomId: data.get("roomId"),
    date,
    day,
    slotId: data.get("slotId"),
    reason: data.get("reason"),
    createdBy: currentUser.id
  });
  saveData();
  event.target.reset();
  renderBlockTools();
  refreshCurrentView();
  showToast("Der Raum wurde gesperrt.", "success");
}

function resetDataFromAdmin() {
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
