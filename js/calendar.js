/* ════════════════════════════════════════════════
   js/calendar.js
   Event Calendar — Year/Month/Week views with Day View Panel
════════════════════════════════════════════════ */

let currentCalendarDate = new Date();
let currentCalendarView = 'month'; // 'year', 'month', 'week'
let currentSelectedDate = null;

// Event type configurations
const EVENT_TYPES = {
    holiday: { label: '🎉 Holiday', color: '#f05252', bg: 'rgba(240,82,82,0.15)' },
    meeting: { label: '📅 Meeting', color: '#4f6ef7', bg: 'rgba(79,110,247,0.15)' },
    deadline: { label: '⏰ Deadline', color: '#f0a832', bg: 'rgba(240,168,50,0.15)' },
    travel: { label: '✈️ Travel', color: '#a84ff7', bg: 'rgba(168,79,247,0.15)' },
    reminder: { label: '📝 Reminder', color: '#22c97a', bg: 'rgba(34,201,122,0.15)' },
    other: { label: '📌 Other', color: '#8888a8', bg: 'rgba(136,136,168,0.15)' }
};

// Reminder options
const REMINDER_OPTIONS = [
    { value: 1, label: '1 day before' },
    { value: 3, label: '3 days before' },
    { value: 5, label: '5 days before' },
    { value: 7, label: '7 days before' },
    { value: 10, label: '10 days before' },
    { value: 14, label: '14 days before' }
];

/* ════════════════════════════════════════════════
   DB FUNCTIONS
════════════════════════════════════════════════ */
async function dbGetAllEvents() {
    return await sbFetch('events?select=*&order=event_date.asc');
}

async function dbGetEvent(id) {
    const rows = await sbFetch(`events?id=eq.${id}`);
    return rows?.[0] || null;
}

async function dbAddEvent(data) {
    const [event] = await sbFetch('events', {
        method: 'POST',
        body: JSON.stringify({
            name: data.name,
            event_date: data.event_date,
            event_type: data.event_type || 'other',
            custom_type: data.custom_type || null,
            color: data.color || EVENT_TYPES[data.event_type]?.color || '#8888a8',
            reminder_days: data.reminder_days || 5,
            is_noticed: false,
            notes: data.notes || null,
            is_recurring: data.is_recurring || false,
            created_by: window.CURRENT_USER_NAME || window.CURRENT_USER_EMAIL
        })
    });
    return event;
}

async function dbUpdateEvent(id, data) {
    const [event] = await sbFetch(`events?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
            name: data.name,
            event_date: data.event_date,
            event_type: data.event_type || 'other',
            custom_type: data.custom_type || null,
            color: data.color || EVENT_TYPES[data.event_type]?.color || '#8888a8',
            reminder_days: data.reminder_days || 5,
            notes: data.notes || null,
            is_recurring: data.is_recurring || false
        })
    });
    return event;
}

async function dbDeleteEvent(id) {
    await sbFetch(`events?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}

async function dbToggleNoticed(id, isNoticed) {
    const [event] = await sbFetch(`events?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_noticed: isNoticed })
    });
    return event;
}

async function dbGetUpcomingEvents() {
    const today = new Date().toISOString().slice(0, 10);
    return await sbFetch(`events?event_date=gte.${today}&order=event_date.asc`);
}

/* ════════════════════════════════════════════════
   DAY VIEW PANEL
════════════════════════════════════════════════ */
async function openDayView(date) {
    currentSelectedDate = date;
    const overlay = document.getElementById('day-view-overlay');
    const dateDisplay = document.getElementById('day-view-date');
    const body = document.getElementById('day-view-body');
    
    if (!overlay || !dateDisplay || !body) return;
    
    // Format date for display
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    dateDisplay.textContent = formattedDate;
    
    overlay.classList.add('open');
    body.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading events...</p></div>`;
    
    try {
        const allEvents = await dbGetAllEvents();
        const dayEvents = allEvents.filter(e => e.event_date === date);
        
        renderDayViewBody(dayEvents, date);
    } catch (err) {
        body.innerHTML = `<p style="color:var(--danger);padding:20px">Error: ${err.message}</p>`;
    }
}

function renderDayViewBody(events, date) {
    const body = document.getElementById('day-view-body');
    const isAdmin = window.USER_ROLE === 'admin';
    
    if (!body) return;
    
    if (events.length === 0) {
        body.innerHTML = `
            <div class="empty-state" style="padding:40px 20px">
                <div class="empty-icon">📅</div>
                <p>No events on this day</p>
                ${isAdmin ? '<button class="btn btn-primary" id="day-view-add-new" style="margin-top:16px">+ Add Event</button>' : ''}
            </div>
        `;
        if (isAdmin) {
            document.getElementById('day-view-add-new')?.addEventListener('click', () => {
                closeDayView();
                openEventModal(null, date);
            });
        }
        return;
    }
    
    body.innerHTML = `
        <div class="day-view-header">
            <div class="day-view-count">${events.length} event${events.length !== 1 ? 's' : ''}</div>
            ${isAdmin ? `<button class="btn btn-sm btn-primary" id="day-view-add-event">+ Add Event</button>` : ''}
        </div>
        <div class="day-view-events">
            ${events.map(event => buildEventCard(event, isAdmin)).join('')}
        </div>
    `;
    
    // Bind add event button
    if (isAdmin) {
        document.getElementById('day-view-add-event')?.addEventListener('click', () => {
            closeDayView();
            openEventModal(null, date);
        });
    }
    
    // Bind edit, delete, and notice buttons
    body.querySelectorAll('.event-card-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = parseInt(btn.dataset.id);
            closeDayView();
            openEventModal(eventId);
        });
    });
    
    body.querySelectorAll('.event-card-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const eventId = parseInt(btn.dataset.id);
            const eventName = btn.dataset.name;
            if (confirm(`Delete "${eventName}"? This cannot be undone.`)) {
                await dbDeleteEvent(eventId);
                showToast(`🗑 ${eventName} deleted`);
                closeDayView();
                renderCalendar();
                if (typeof checkEventNotifications === 'function') checkEventNotifications();
            }
        });
    });
    
    body.querySelectorAll('.event-card-notice').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const eventId = parseInt(btn.dataset.id);
            const isNoticed = btn.dataset.noticed === 'true';
            await dbToggleNoticed(eventId, !isNoticed);
            showToast(isNoticed ? '✓ Marked as not noticed' : '✓ Marked as noticed');
            // Refresh the day view
            const allEvents = await dbGetAllEvents();
            const dayEvents = allEvents.filter(e => e.event_date === date);
            renderDayViewBody(dayEvents, date);
            renderCalendar();
            if (typeof checkEventNotifications === 'function') checkEventNotifications();
        });
    });
}

function buildEventCard(event, isAdmin) {
    const eventType = EVENT_TYPES[event.event_type] || EVENT_TYPES.other;
    const isNoticed = event.is_noticed;
    const isPast = event.event_date < new Date().toISOString().slice(0, 10);
    
    return `
        <div class="event-card" style="border-left-color: ${event.color || eventType.color}">
            <div class="event-card-header">
                <div class="event-card-title">
                    <span class="event-card-icon">${eventType.label.split(' ')[0]}</span>
                    <span class="event-card-name">${escapeHtml(event.name)}</span>
                    ${isPast ? '<span class="event-card-past">(Past)</span>' : ''}
                </div>
                <div class="event-card-status">
                    <span class="status-badge ${isNoticed ? 'status-noticed' : 'status-unnoticed'}">
                        ${isNoticed ? '✅ Noticed' : '🔴 Not Noticed'}
                    </span>
                </div>
            </div>
            <div class="event-card-details">
                <div class="event-card-type">${eventType.label}</div>
                <div class="event-card-meta">Added by ${escapeHtml(event.created_by || 'Unknown')}</div>
                ${event.notes ? `<div class="event-card-notes">📝 ${escapeHtml(event.notes)}</div>` : ''}
                <div class="event-card-reminder">⏰ Reminder: ${getReminderLabel(event.reminder_days || 5)}</div>
            </div>
            ${isAdmin ? `
                <div class="event-card-actions">
                    <button class="btn btn-sm event-card-notice" data-id="${event.id}" data-noticed="${isNoticed}">
                        ${isNoticed ? 'Mark as Not Noticed' : 'Mark as Noticed'}
                    </button>
                    <button class="btn btn-sm btn-ghost event-card-edit" data-id="${event.id}">Edit</button>
                    <button class="btn btn-sm btn-ghost event-card-delete" data-id="${event.id}" data-name="${escapeHtml(event.name)}" style="color:var(--danger)">Delete</button>
                </div>
            ` : ''}
        </div>
    `;
}

function getReminderLabel(days) {
    const option = REMINDER_OPTIONS.find(o => o.value === days);
    return option ? option.label : `${days} days before`;
}

function closeDayView() {
    const overlay = document.getElementById('day-view-overlay');
    if (overlay) overlay.classList.remove('open');
    currentSelectedDate = null;
}

/* ════════════════════════════════════════════════
   RENDER CALENDAR
════════════════════════════════════════════════ */
async function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading calendar...</p></div>`;
    
    try {
        const events = await dbGetAllEvents();
        
        // Auto-mark past events as noticed — single batch call, not a loop
        const today = new Date().toISOString().slice(0, 10);
        const pastUnnoticed = events.filter(e => e.event_date < today && !e.is_noticed);
        if (pastUnnoticed.length > 0) {
            try {
                // One PATCH call to mark all past unnoticed events at once
                await sbFetch(
                    'events?event_date=lt.' + today + '&is_noticed=eq.false',
                    { method: 'PATCH', body: JSON.stringify({ is_noticed: true }) }
                );
                // Update local data too so UI is correct without re-fetching
                events.forEach(e => {
                    if (e.event_date < today) e.is_noticed = true;
                });
            } catch(e) {
                console.warn('Batch auto-mark failed:', e.message);
            }
        }

        renderCalendarView(container, events);
    } catch (err) {
        container.innerHTML = `<p style="color:var(--danger);padding:20px">Error: ${err.message}</p>`;
    }
}

function renderCalendarView(container, events) {
    if (currentCalendarView === 'year') {
        renderYearView(container, events);
    } else if (currentCalendarView === 'week') {
        renderWeekView(container, events);
    } else {
        renderMonthView(container, events);
    }
    
    // Bind view toggle buttons
    document.querySelectorAll('.calendar-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentCalendarView);
        btn.addEventListener('click', () => {
            currentCalendarView = btn.dataset.view;
            renderCalendar();
        });
    });
}

/* ── MONTH VIEW ── */
function renderMonthView(container, events) {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    let startOffset = startWeekday === 0 ? 6 : startWeekday - 1;
    
    const weeks = [];
    let currentDay = 1;
    
    for (let week = 0; week < 6; week++) {
        const days = [];
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            if (week === 0 && dayOfWeek < startOffset) {
                days.push(null);
            } else if (currentDay > daysInMonth) {
                days.push(null);
            } else {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
                const dayEvents = events.filter(e => e.event_date === dateStr);
                const isToday = dateStr === new Date().toISOString().slice(0, 10);
                
                days.push({
                    day: currentDay,
                    date: dateStr,
                    events: dayEvents,
                    isToday: isToday
                });
                currentDay++;
            }
        }
        if (days.some(d => d !== null)) {
            weeks.push(days);
        }
        if (currentDay > daysInMonth) break;
    }
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const isAdmin = window.USER_ROLE === 'admin';
    
    container.innerHTML = `
        <div class="calendar-container">
            <div class="calendar-nav">
                <button class="btn btn-ghost" id="calendar-prev">← Prev</button>
                <h2>${monthNames[month]} ${year}</h2>
                <button class="btn btn-ghost" id="calendar-next">Next →</button>
            </div>
            
            <div class="calendar-view-toggle">
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'year' ? 'active' : ''}" data-view="year">Year</button>
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'month' ? 'active' : ''}" data-view="month">Month</button>
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'week' ? 'active' : ''}" data-view="week">Week</button>
            </div>
            
            <div class="calendar-grid">
                <div class="calendar-weekdays">
                    ${weekDays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
                </div>
                <div class="calendar-days">
                    ${weeks.map(week => `
                        <div class="calendar-week">
                            ${week.map(day => {
                                if (!day) return `<div class="calendar-day empty"></div>`;
                                
                                const hasUnnoticed = day.events.some(e => !e.is_noticed && e.event_date >= new Date().toISOString().slice(0, 10));
                                const statusClass = hasUnnoticed ? 'has-unnoticed' : '';
                                
                                return `
                                    <div class="calendar-day ${statusClass} ${day.isToday ? 'calendar-today' : ''}" data-date="${day.date}">
                                        <div class="calendar-day-number">${day.day}</div>
                                        <div class="calendar-day-events">
                                            ${day.events.slice(0, 2).map(e => `
                                                <div class="calendar-event-dot" style="background:${e.color}" title="${escapeHtml(e.name)} (${EVENT_TYPES[e.event_type]?.label || 'Event'})"></div>
                                            `).join('')}
                                            ${day.events.length > 2 ? `<div class="calendar-event-more">+${day.events.length - 2}</div>` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="calendar-legend">
                ${Object.entries(EVENT_TYPES).map(([key, val]) => `
                    <div class="legend-item"><span class="legend-dot" style="background:${val.color}"></span> ${val.label}</div>
                `).join('')}
                <div class="legend-item"><span class="legend-dot" style="background:var(--danger)"></span> ⚠️ Unnoticed</div>
            </div>
            
            ${isAdmin ? `
                <div class="calendar-actions">
                    <button class="btn btn-primary" id="add-event-btn">+ Add Event</button>
                </div>
            ` : ''}
        </div>
    `;
    
    bindCalendarEvents(container, events);
}

/* ── YEAR VIEW ── */
function renderYearView(container, events) {
    const year = currentCalendarDate.getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const isAdmin = window.USER_ROLE === 'admin';
    
    const months = [];
    for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const monthEvents = events.filter(e => new Date(e.event_date).getMonth() === m && new Date(e.event_date).getFullYear() === year);
        const hasUnnoticed = monthEvents.some(e => !e.is_noticed && e.event_date >= new Date().toISOString().slice(0, 10));
        
        months.push({
            name: monthNames[m],
            days: daysInMonth,
            events: monthEvents,
            hasUnnoticed
        });
    }
    
    container.innerHTML = `
        <div class="calendar-container">
            <div class="calendar-nav">
                <button class="btn btn-ghost" id="calendar-prev">← Prev Year</button>
                <h2>${year}</h2>
                <button class="btn btn-ghost" id="calendar-next">Next Year →</button>
            </div>
            
            <div class="calendar-view-toggle">
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'year' ? 'active' : ''}" data-view="year">Year</button>
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'month' ? 'active' : ''}" data-view="month">Month</button>
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'week' ? 'active' : ''}" data-view="week">Week</button>
            </div>
            
            <div class="year-view-grid">
                ${months.map((month, idx) => `
                    <div class="year-month-card ${month.hasUnnoticed ? 'has-unnoticed' : ''}" data-month="${idx}" data-year="${year}">
                        <div class="year-month-name">${month.name}</div>
                        <div class="year-month-events">
                            ${month.events.slice(0, 3).map(e => `
                                <div class="year-event-item" style="border-left-color:${e.color}" title="${escapeHtml(e.name)}" data-event-id="${e.id}">
                                    <span>${e.name.substring(0, 20)}${e.name.length > 20 ? '...' : ''}</span>
                                    ${!e.is_noticed && e.event_date >= new Date().toISOString().slice(0, 10) ? '<span class="unnoticed-badge">!</span>' : ''}
                                </div>
                            `).join('')}
                            ${month.events.length > 3 ? `<div class="year-event-more">+${month.events.length - 3} more</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="calendar-legend">
                ${Object.entries(EVENT_TYPES).map(([key, val]) => `
                    <div class="legend-item"><span class="legend-dot" style="background:${val.color}"></span> ${val.label}</div>
                `).join('')}
            </div>
            
            ${isAdmin ? `
                <div class="calendar-actions">
                    <button class="btn btn-primary" id="add-event-btn">+ Add Event</button>
                </div>
            ` : ''}
        </div>
    `;
    
    // Month click to switch to month view
    document.querySelectorAll('.year-month-card').forEach(card => {
        card.addEventListener('click', () => {
            const month = parseInt(card.dataset.month);
            const year = parseInt(card.dataset.year);
            currentCalendarDate = new Date(year, month, 1);
            currentCalendarView = 'month';
            renderCalendar();
        });
    });
    
    // Event click to open edit modal
    document.querySelectorAll('.year-event-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = parseInt(el.dataset.eventId);
            if (eventId) openEventModal(eventId);
        });
    });
    
    bindCalendarEvents(container, events);
}

/* ── WEEK VIEW ── */
function renderWeekView(container, events) {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const currentDayOfMonth = currentCalendarDate.getDate();
    
    const currentDate = new Date(year, month, currentDayOfMonth);
    const dayOfWeek = currentDate.getDay();
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - startOffset);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        const dayEvents = events.filter(e => e.event_date === dateStr);
        const isToday = dateStr === new Date().toISOString().slice(0, 10);
        
        weekDays.push({
            date: dateStr,
            day: date.getDate(),
            month: date.getMonth() + 1,
            dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
            events: dayEvents,
            isToday
        });
    }
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const isAdmin = window.USER_ROLE === 'admin';
    
    container.innerHTML = `
        <div class="calendar-container">
            <div class="calendar-nav">
                <button class="btn btn-ghost" id="calendar-prev">← Prev Week</button>
                <h2>${monthNames[weekStart.getMonth()]} ${weekStart.getFullYear()}</h2>
                <button class="btn btn-ghost" id="calendar-next">Next Week →</button>
            </div>
            
            <div class="calendar-view-toggle">
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'year' ? 'active' : ''}" data-view="year">Year</button>
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'month' ? 'active' : ''}" data-view="month">Month</button>
                <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'week' ? 'active' : ''}" data-view="week">Week</button>
            </div>
            
            <div class="week-view-grid">
                ${weekDays.map(day => `
                    <div class="week-day-card ${day.isToday ? 'week-today' : ''}" data-date="${day.date}">
                        <div class="week-day-header">
                            <div class="week-day-name">${day.dayName}</div>
                            <div class="week-day-date">${day.month}/${day.day}</div>
                        </div>
                        <div class="week-day-events">
                            ${day.events.map(e => `
                                <div class="week-event-item" style="border-left-color:${e.color}; background:${EVENT_TYPES[e.event_type]?.bg || 'transparent'}" data-event-id="${e.id}">
                                    <div class="week-event-name">${escapeHtml(e.name)}</div>
                                    <div class="week-event-meta">
                                        <span class="event-type-badge" style="color:${e.color}">${EVENT_TYPES[e.event_type]?.label || 'Event'}</span>
                                        ${!e.is_noticed && e.event_date >= new Date().toISOString().slice(0, 10) ? '<span class="unnoticed-badge-small">!</span>' : ''}
                                    </div>
                                </div>
                            `).join('')}
                            ${day.events.length === 0 ? '<div class="week-event-empty">No events</div>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="calendar-legend">
                ${Object.entries(EVENT_TYPES).map(([key, val]) => `
                    <div class="legend-item"><span class="legend-dot" style="background:${val.color}"></span> ${val.label}</div>
                `).join('')}
            </div>
            
            ${isAdmin ? `
                <div class="calendar-actions">
                    <button class="btn btn-primary" id="add-event-btn">+ Add Event</button>
                </div>
            ` : ''}
        </div>
    `;
    
    // Event click to open edit modal
    container.querySelectorAll('.week-event-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = parseInt(el.dataset.eventId);
            if (eventId) openEventModal(eventId);
        });
    });
    
    bindCalendarEvents(container, events);
}

function bindCalendarEvents(container, events) {
    // Navigation buttons
    document.getElementById('calendar-prev')?.addEventListener('click', () => {
        if (currentCalendarView === 'year') {
            currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() - 1);
        } else if (currentCalendarView === 'week') {
            currentCalendarDate.setDate(currentCalendarDate.getDate() - 7);
        } else {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        }
        renderCalendar();
    });
    
    document.getElementById('calendar-next')?.addEventListener('click', () => {
        if (currentCalendarView === 'year') {
            currentCalendarDate.setFullYear(currentCalendarDate.getFullYear() + 1);
        } else if (currentCalendarView === 'week') {
            currentCalendarDate.setDate(currentCalendarDate.getDate() + 7);
        } else {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        }
        renderCalendar();
    });
    
    // Today button
    document.getElementById('calendar-today-btn')?.addEventListener('click', () => {
        currentCalendarDate = new Date();
        renderCalendar();
    });
    
    // Day click to open day view panel
    document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const date = el.dataset.date;
            if (date) openDayView(date);
        });
    });
    
    // Week day click to open day view
    document.querySelectorAll('.week-day-card[data-date]').forEach(el => {
        el.addEventListener('click', () => {
            const date = el.dataset.date;
            if (date) openDayView(date);
        });
    });
    
    // Add event button
    document.getElementById('add-event-btn')?.addEventListener('click', () => openEventModal());
}

function getEventTypeLabel(type) {
    return EVENT_TYPES[type]?.label || EVENT_TYPES.other.label;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/* ════════════════════════════════════════════════
   EVENT MODAL (Add/Edit)
════════════════════════════════════════════════ */
async function openEventModal(editId = null, presetDate = null) {
    const overlay = document.getElementById('event-modal-overlay');
    if (!overlay) return;
    
    // Reset form
    document.getElementById('event-id').value = '';
    document.getElementById('event-name').value = '';
    document.getElementById('event-date').value = presetDate || new Date().toISOString().slice(0, 10);
    document.getElementById('event-type').value = 'holiday';
    document.getElementById('event-custom-type-wrap').style.display = 'none';
    document.getElementById('event-custom-type').value = '';
    document.getElementById('event-reminder').value = '5';
    document.getElementById('event-notes').value = '';
    document.getElementById('event-recurring').checked = false;
    document.getElementById('event-delete-btn').style.display = 'none';
    
    // Populate reminder dropdown with options
    const reminderSelect = document.getElementById('event-reminder');
    if (reminderSelect) {
        reminderSelect.innerHTML = REMINDER_OPTIONS.map(opt => 
            `<option value="${opt.value}" ${opt.value === 5 ? 'selected' : ''}>${opt.label}</option>`
        ).join('');
    }
    
    if (editId) {
        const event = await dbGetEvent(editId);
        if (event) {
            document.getElementById('event-id').value = event.id;
            document.getElementById('event-name').value = event.name;
            document.getElementById('event-date').value = event.event_date;
            document.getElementById('event-type').value = event.event_type;
            if (event.event_type === 'other' && event.custom_type) {
                document.getElementById('event-custom-type-wrap').style.display = 'block';
                document.getElementById('event-custom-type').value = event.custom_type;
            }
            document.getElementById('event-reminder').value = event.reminder_days || '5';
            document.getElementById('event-notes').value = event.notes || '';
            document.getElementById('event-recurring').checked = event.is_recurring || false;
            document.getElementById('event-delete-btn').style.display = 'inline-flex';
            document.getElementById('event-modal-title').textContent = 'Edit Event';
            document.getElementById('event-modal-sub').textContent = 'Update event details';
        }
    } else {
        document.getElementById('event-modal-title').textContent = 'Add Event';
        document.getElementById('event-modal-sub').textContent = 'Schedule an event';
    }
    
    overlay.classList.add('open');
    setTimeout(() => document.getElementById('event-name').focus(), 100);
}

function closeEventModal() {
    document.getElementById('event-modal-overlay')?.classList.remove('open');
}

// Show/hide custom type input based on selection
function bindEventTypeToggle() {
    const typeSelect = document.getElementById('event-type');
    const customWrap = document.getElementById('event-custom-type-wrap');
    if (typeSelect && customWrap) {
        typeSelect.addEventListener('change', () => {
            customWrap.style.display = typeSelect.value === 'other' ? 'block' : 'none';
        });
    }
}

async function handleSaveEvent() {
    const name = document.getElementById('event-name').value.trim();
    const eventDate = document.getElementById('event-date').value;
    let eventType = document.getElementById('event-type').value;
    const customType = document.getElementById('event-custom-type').value.trim();
    const reminderDays = parseInt(document.getElementById('event-reminder').value);
    const notes = document.getElementById('event-notes').value.trim() || null;
    const isRecurring = document.getElementById('event-recurring').checked;
    
    if (!name) {
        showToast('⚠️ Please enter an event name');
        return;
    }
    if (!eventDate) {
        showToast('⚠️ Please select a date');
        return;
    }
    
    // If type is 'other' and custom type provided, use that as name prefix
    let finalEventType = eventType;
    let finalName = name;
    if (eventType === 'other' && customType) {
        finalName = `[${customType}] ${name}`;
    }
    
    const btn = document.getElementById('event-save-btn');
    btn.textContent = 'Saving...'; btn.disabled = true;
    
    try {
        const id = document.getElementById('event-id').value;
        if (id) {
            await dbUpdateEvent(parseInt(id), { 
                name: finalName, 
                event_date: eventDate, 
                event_type: finalEventType,
                custom_type: finalEventType === 'other' ? customType : null,
                reminder_days: reminderDays, 
                notes, 
                is_recurring: isRecurring 
            });
            showToast('✓ Event updated');
        } else {
            await dbAddEvent({ 
                name: finalName, 
                event_date: eventDate, 
                event_type: finalEventType,
                custom_type: finalEventType === 'other' ? customType : null,
                reminder_days: reminderDays, 
                notes, 
                is_recurring: isRecurring 
            });
            showToast('✓ Event added');
        }
        closeEventModal();
        renderCalendar();
        
        // Refresh workspace notification check
        if (typeof checkEventNotifications === 'function') {
            checkEventNotifications();
        }
    } catch (err) {
        showToast('⚠️ ' + err.message);
    } finally {
        btn.textContent = id ? 'Save Changes' : 'Save Event';
        btn.disabled = false;
    }
}

async function handleDeleteEvent() {
    const id = document.getElementById('event-id').value;
    if (!id) return;
    if (!confirm('Delete this event? This cannot be undone.')) return;
    
    const btn = document.getElementById('event-delete-btn');
    btn.textContent = 'Deleting...'; btn.disabled = true;
    
    try {
        await dbDeleteEvent(parseInt(id));
        showToast('🗑 Event deleted');
        closeEventModal();
        renderCalendar();
    } catch (err) {
        showToast('⚠️ ' + err.message);
    } finally {
        btn.textContent = 'Delete';
        btn.disabled = false;
    }
}

// Bind event modal events
function bindEventModal() {
    const overlay = document.getElementById('event-modal-overlay');
    if (!overlay) return;
    
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeEventModal();
    });
    
    document.getElementById('event-cancel-btn')?.addEventListener('click', closeEventModal);
    document.getElementById('event-save-btn')?.addEventListener('click', handleSaveEvent);
    document.getElementById('event-delete-btn')?.addEventListener('click', handleDeleteEvent);
    
    bindEventTypeToggle();
}

// Bind day view panel events
function bindDayViewPanel() {
    const overlay = document.getElementById('day-view-overlay');
    if (!overlay) return;
    
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeDayView();
    });
    
    document.getElementById('day-view-close')?.addEventListener('click', closeDayView);
    document.getElementById('day-view-add-btn')?.addEventListener('click', () => {
        if (currentSelectedDate) {
            closeDayView();
            openEventModal(null, currentSelectedDate);
        }
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bindEventModal();
        bindDayViewPanel();
    });
} else {
    bindEventModal();
    bindDayViewPanel();
}