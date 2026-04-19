/* ════════════════════════════════════════════════
    js/calendar.js
    Event Calendar — Year/Month/Week views with Day View Panel
    UPDATED: All days in year view now have consistent uniform size
    FIXED: Event saving button stuck on "Saving..." issue
    ════════════════════════════════════════════════ */

    let currentCalendarDate = new Date();
    let currentCalendarView = 'year'; // 'year', 'month', 'week'
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
        
        if (isAdmin) {
            document.getElementById('day-view-add-event')?.addEventListener('click', () => {
                closeDayView();
                openEventModal(null, date);
            });
        }
        
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
            
            const today = new Date().toISOString().slice(0, 10);
            for (const event of events) {
                if (event.event_date < today && !event.is_noticed) {
                    await dbToggleNoticed(event.id, true);
                    event.is_noticed = true;
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

    /* ── YEAR VIEW — COMPACT: 4 months per row, UNIFORM day sizes ── */
    function renderYearView(container, events) {
        const year = currentCalendarDate.getFullYear();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const isAdmin = window.USER_ROLE === 'admin';
        const todayStr = new Date().toISOString().slice(0, 10);
        
        // Build data for all 12 months
        const monthsData = [];
        for (let month = 0; month < 12; month++) {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            let startWeekday = firstDay.getDay();
            const startOffset = startWeekday === 0 ? 6 : startWeekday - 1;
            const daysInMonth = lastDay.getDate();
            
            const monthDays = [];
            let currentDay = 1;
            
            for (let week = 0; week < 6; week++) {
                const weekDaysArr = [];
                for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                    if (week === 0 && dayOfWeek < startOffset) {
                        weekDaysArr.push(null);
                    } else if (currentDay > daysInMonth) {
                        weekDaysArr.push(null);
                    } else {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
                        const dayEvents = events.filter(e => e.event_date === dateStr);
                        const isToday = dateStr === todayStr;
                        const hasUnnoticed = dayEvents.some(e => !e.is_noticed && e.event_date >= todayStr);
                        
                        weekDaysArr.push({
                            day: currentDay,
                            date: dateStr,
                            events: dayEvents,
                            isToday: isToday,
                            hasUnnoticed: hasUnnoticed,
                            eventCount: dayEvents.length
                        });
                        currentDay++;
                    }
                }
                if (weekDaysArr.some(d => d !== null)) {
                    monthDays.push(weekDaysArr);
                }
                if (currentDay > daysInMonth) break;
            }
            
            monthsData.push({
                month: month,
                name: monthNames[month],
                days: monthDays,
                totalEvents: events.filter(e => {
                    const eDate = new Date(e.event_date);
                    return eDate.getFullYear() === year && eDate.getMonth() === month;
                }).length
            });
        }
        
        // Build HTML with CSS Grid - 4 months per row
        let monthsHtml = '<div class="year-months-grid" style="display:grid; grid-template-columns:repeat(6, 1fr); gap:8px;">';
        
        for (let i = 0; i < monthsData.length; i++) {
            monthsHtml += buildCompactMonthGrid(monthsData[i], weekDays, year);
        }
        
        monthsHtml += '</div>';
        
        container.innerHTML = `
            <div class="calendar-container">
                <div class="calendar-nav" style="margin-bottom:16px;">
                    <button class="btn btn-ghost" id="calendar-prev">← ${year - 1}</button>
                    <h2 style="font-size:20px;">${year}</h2>
                    <button class="btn btn-ghost" id="calendar-next">${year + 1} →</button>
                </div>
                
                <div class="calendar-view-toggle" style="margin-bottom:16px;">
                    <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'year' ? 'active' : ''}" data-view="year">Year</button>
                    <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'month' ? 'active' : ''}" data-view="month">Month</button>
                    <button class="btn btn-sm calendar-view-btn ${currentCalendarView === 'week' ? 'active' : ''}" data-view="week">Week</button>
                </div>
                
                <div class="year-full-calendar">
                    ${monthsHtml}
                </div>
                
                <div class="calendar-legend" style="margin-top:16px; padding:8px 12px; gap:12px; flex-wrap:wrap;">
                    ${Object.entries(EVENT_TYPES).slice(0, 3).map(([key, val]) => `
                        <div class="legend-item"><span class="legend-dot" style="background:${val.color}"></span> ${val.label}</div>
                    `).join('')}
                    <div class="legend-item"><span style="width:10px;height:10px;border-radius:2px;background:var(--ac-soft);display:inline-block;"></span> Has events</div>
                    <div class="legend-item"><span style="width:10px;height:10px;border-radius:50%;background:var(--danger);display:inline-block;"></span> Unnoticed</div>
                    <div class="legend-item"><span style="width:10px;height:10px;border-radius:2px;background:var(--accent);display:inline-block;"></span> Today</div>
                </div>
                
                ${isAdmin ? `
                    <div class="calendar-actions" style="margin-top:16px;">
                        <button class="btn btn-primary" id="add-event-btn">+ Add Event</button>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Bind click events for all day cells
        container.querySelectorAll('.year-cal-day').forEach(dayEl => {
            dayEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const date = dayEl.dataset.date;
                if (date) openDayView(date);
            });
        });
        
        // Month name click to switch to month view
        container.querySelectorAll('.year-month-header').forEach(header => {
            header.addEventListener('click', () => {
                const month = parseInt(header.dataset.month);
                currentCalendarDate = new Date(year, month, 1);
                currentCalendarView = 'month';
                renderCalendar();
            });
        });
        
        bindCalendarEvents(container, events);
    }

    function buildCompactMonthGrid(monthData, weekDays, year) {
        const hasEvents = monthData.totalEvents > 0;
        
        // Calculate consistent cell size - all cells (including empty) get same dimensions
        // Using min-width and fixed aspect ratio ensures uniform sizing
        
        return `
            <div class="year-month-grid" style="background:var(--bg3); border:1px solid var(--border); border-radius:var(--r2); overflow:hidden;">
                <div class="year-month-header" data-month="${monthData.month}" 
                    style="background:var(--bg2); padding:4px 6px; text-align:center; font-family:'Syne',sans-serif; font-weight:700; font-size:11px; border-bottom:1px solid var(--border); cursor:pointer; transition:all var(--ease);">
                    ${monthData.name} ${year}
                    ${hasEvents ? `<span style="font-size:9px; margin-left:4px; background:var(--ac-soft); padding:1px 5px; border-radius:12px; color:var(--accent);">${monthData.totalEvents}</span>` : ''}
                </div>
                <div style="padding:4px;">
                    <!-- Weekday headers - compact -->
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; margin-bottom:2px;">
                        ${weekDays.map(day => `
                            <div style="text-align:center; font-size:7px; font-weight:600; color:var(--tx3); padding:2px 0;">${day}</div>
                        `).join('')}
                    </div>
                    <!-- Days grid - ALL cells have UNIFORM size -->
                    <div style="display:flex; flex-direction:column; gap:1px;">
                        ${monthData.days.map(week => `
                            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:1px;">
                                ${week.map(day => {
                                    if (!day) {
                                        // Empty cell - same size as day cells
                                        return `<div style="aspect-ratio:1; background:transparent; border-radius:4px;"></div>`;
                                    }
                                    
                                    const isToday = day.date === new Date().toISOString().slice(0, 10);
                                    const hasEvent = day.eventCount > 0;
                                    
                                    // All day cells have EXACT same dimensions (aspect-ratio:1 ensures square)
                                    let dayStyle = 'aspect-ratio:1; background:var(--bg); border:1px solid var(--border); border-radius:4px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:all var(--ease); position:relative;';
                                    if (hasEvent) dayStyle = 'aspect-ratio:1; background:var(--ac-soft); border:1px solid var(--accent); border-radius:4px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:all var(--ease); position:relative;';
                                    if (isToday) dayStyle = 'aspect-ratio:1; background:var(--accent); border:1px solid var(--accent); border-radius:4px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:all var(--ease); position:relative;';
                                    
                                    return `
                                        <div class="year-cal-day" data-date="${day.date}" data-day="${day.day}"
                                            style="${dayStyle}">
                                            <div style="font-size:9px; font-weight:${isToday ? '700' : '500'}; color:${isToday ? 'white' : 'var(--tx)'};">${day.day}</div>
                                            ${hasEvent && !isToday ? `<div style="position:absolute; bottom:3px; left:50%; transform:translateX(-50%); width:4px; height:4px; border-radius:50%; background:${day.events[0]?.color || 'var(--accent)'};"></div>` : ''}
                                            ${day.hasUnnoticed && !isToday ? `<div style="position:absolute; top:1px; right:1px; width:8px; height:8px; background:var(--danger); border-radius:50%; font-size:6px; color:white; display:flex; align-items:center; justify-content:center;">!</div>` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
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
        
        document.getElementById('calendar-today-btn')?.addEventListener('click', () => {
            currentCalendarDate = new Date();
            renderCalendar();
        });
        
        document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const date = el.dataset.date;
                if (date) openDayView(date);
            });
        });
        
        document.querySelectorAll('.week-day-card[data-date]').forEach(el => {
            el.addEventListener('click', () => {
                const date = el.dataset.date;
                if (date) openDayView(date);
            });
        });
        
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
    EVENT MODAL (Add/Edit) - FIXED: Saving issue resolved
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
        
        // IMPORTANT: Reset save button to original state
        const saveBtn = document.getElementById('event-save-btn');
        if (saveBtn) {
            saveBtn.textContent = 'Save Event';
            saveBtn.disabled = false;
        }
        
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
                if (saveBtn) saveBtn.textContent = 'Save Changes';
            }
        } else {
            document.getElementById('event-modal-title').textContent = 'Add Event';
            document.getElementById('event-modal-sub').textContent = 'Schedule an event';
            if (saveBtn) saveBtn.textContent = 'Save Event';
        }
        
        overlay.classList.add('open');
        setTimeout(() => document.getElementById('event-name').focus(), 100);
    }

    function closeEventModal() {
        const overlay = document.getElementById('event-modal-overlay');
        if (overlay) overlay.classList.remove('open');
        
        // IMPORTANT: Reset button when modal closes
        const saveBtn = document.getElementById('event-save-btn');
        if (saveBtn) {
            saveBtn.textContent = 'Save Event';
            saveBtn.disabled = false;
        }
    }

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
        
        let finalEventType = eventType;
        let finalName = name;
        if (eventType === 'other' && customType) {
            finalName = `[${customType}] ${name}`;
        }
        
        const btn = document.getElementById('event-save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;
        
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
            
            // Close modal FIRST
            closeEventModal();
            
            // Then refresh calendar
            await renderCalendar();
            
            if (typeof checkEventNotifications === 'function') {
                checkEventNotifications();
            }
            
            // Reset button (though modal is closed, this is safe)
            btn.textContent = originalText;
            btn.disabled = false;
            
        } catch (err) {
            console.error('Save error:', err);
            showToast('⚠️ Error: ' + (err.message || 'Failed to save event'));
            // Reset button on error - keep modal open so user can try again
            btn.textContent = originalText;
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

    function addYearViewStyles() {
        const styleId = 'year-view-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .year-cal-day:hover {
                transform: translateY(-1px);
                filter: brightness(0.95);
            }
            .year-month-header:hover {
                background: var(--ac-soft) !important;
                color: var(--accent) !important;
            }
            @media (max-width: 1400px) {
                .year-months-grid {
                    grid-template-columns: repeat(4, 1fr) !important;
                }
            }
            @media (max-width: 1000px) {
                .year-months-grid {
                    grid-template-columns: repeat(2, 1fr) !important;
                }
            }
            @media (max-width: 600px) {
                .year-months-grid {
                    grid-template-columns: 1fr !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindEventModal();
            bindDayViewPanel();
            addYearViewStyles();
        });
    } else {
        bindEventModal();
        bindDayViewPanel();
        addYearViewStyles();
    }