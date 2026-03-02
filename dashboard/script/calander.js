// Enhanced calendar.js with Task Deadline Sync
// Save as: script/calander.js

(() => {
  const daysEl = document.getElementById('calxDays');
  const titleEl = document.getElementById('calxTitle');
  const sidebar = document.getElementById('calxSidebar');

  const prevBtn = document.getElementById('calxPrev');
  const nextBtn = document.getElementById('calxNext');
  const closeBtn = document.getElementById('calxClose');

  const form = document.getElementById('calxForm');
  const titleInput = document.getElementById('calxTitleInput');
  const dateInput = document.getElementById('calxDateInput');
  const timeInput = document.getElementById('calxTimeInput');

  let current = new Date();
  let events = {};
  let tasks = [];

  // Load events and tasks from Firebase
  async function loadEvents() {
    try {
      // Load calendar events
      const calendarEvents = await DataManager.getCalendarEvents();
      events = {};
      
      calendarEvents.forEach(event => {
        const dateKey = event.date || new Date(event.timestamp?.seconds * 1000).toISOString().split('T')[0];
        if (!events[dateKey]) events[dateKey] = [];
        events[dateKey].push({
          title: event.title,
          time: event.time,
          type: 'event',
          id: event.id
        });
      });

      // Load tasks with deadlines
      tasks = await DataManager.getTasks();
      tasks.forEach(task => {
        if (task.date) {
          const dateKey = task.date;
          if (!events[dateKey]) events[dateKey] = [];
          events[dateKey].push({
            title: task.title,
            time: null,
            type: 'task',
            completed: task.completed,
            priority: task.priority,
            subjectName: task.subjectName,
            id: task.id
          });
        }
      });

      render();
    } catch (error) {
      console.error('Error loading calendar events:', error);
      render();
    }
  }

  function render() {
    daysEl.innerHTML = '';
    const y = current.getFullYear();
    const m = current.getMonth();

    titleEl.textContent = current.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const firstDay = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'calx-day other';
      daysEl.appendChild(empty);
    }

    for (let d = 1; d <= totalDays; d++) {
      const cell = document.createElement('div');
      cell.className = 'calx-day';

      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cell.innerHTML = `<strong>${d}</strong>`;

      if (new Date().toDateString() === new Date(y,m,d).toDateString()) {
        cell.classList.add('today');
      }

      if (events[dateStr]) {
        const dayEvents = events[dateStr].slice(0, 3); // Show max 3 items
        dayEvents.forEach(ev => {
          const eventEl = document.createElement('div');
          
          if (ev.type === 'task') {
            // Task styling
            eventEl.className = 'calx-event calx-task';
            if (ev.completed) {
              eventEl.style.textDecoration = 'line-through';
              eventEl.style.opacity = '0.6';
            }
            
            // Priority colors
            const priorityColors = {
              high: '#ff3535',
              medium: '#ff9100',
              low: '#34C759'
            };
            eventEl.style.background = priorityColors[ev.priority] || '#ff9100';
            eventEl.textContent = '✓ ' + ev.title;
            
            if (ev.subjectName) {
              eventEl.title = ev.subjectName + ': ' + ev.title;
            }
          } else {
            // Regular event styling
            eventEl.className = 'calx-event';
            eventEl.textContent = ev.title;
          }
          
          cell.appendChild(eventEl);
        });

        // Show "more" indicator if there are more events
        if (events[dateStr].length > 3) {
          const moreEl = document.createElement('div');
          moreEl.className = 'calx-event-more';
          moreEl.textContent = `+${events[dateStr].length - 3} more`;
          moreEl.style.fontSize = '10px';
          moreEl.style.color = '#666';
          moreEl.style.marginTop = '2px';
          cell.appendChild(moreEl);
        }
      }

      cell.onclick = () => {
        sidebar.classList.add('open');
        dateInput.value = dateStr;
      };

      daysEl.appendChild(cell);
    }

    // Update home page event count
    updateEventCount();
    // Render the flat list below calendar
    renderEventList();
  }

  function updateEventCount() {
    const today = new Date().toISOString().split('T')[0];
    const eventCountEl = document.getElementById('eventCount');
    if (eventCountEl) {
      const todayEvents = events[today] ? events[today].length : 0;
      eventCountEl.textContent = todayEvents;
    }
  }

  prevBtn.onclick = () => {
    current.setMonth(current.getMonth() - 1);
    render();
  };

  nextBtn.onclick = () => {
    current.setMonth(current.getMonth() + 1);
    render();
  };

  closeBtn.onclick = () => sidebar.classList.remove('open');

  form.onsubmit = async (e) => {
    e.preventDefault();

    const date = dateInput.value;
    const eventData = {
      title: titleInput.value,
      time: timeInput.value,
      date: date,
      timestamp: firebase.firestore.Timestamp.fromDate(new Date(date))
    };

    try {
      await DataManager.addCalendarEvent(eventData);
      await loadEvents();
      form.reset();
      sidebar.classList.remove('open');
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Failed to add event. Please try again.');
    }
  };

  // ── Render the flat events list below the calendar ────────
  function renderEventList() {
    const listEl = document.getElementById('calxEventList');
    const titleEl2 = document.getElementById('calxListTitle');
    if (!listEl) return;

    const y = current.getFullYear();
    const m = current.getMonth();
    const monthName = current.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (titleEl2) titleEl2.textContent = `Events — ${monthName}`;

    // Gather all events/tasks for this month, sorted by date
    const items = [];
    const totalDays = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (events[dateStr]) {
        events[dateStr].forEach(ev => items.push({ ...ev, dateStr, day: d }));
      }
    }

    if (items.length === 0) {
      listEl.innerHTML = '<div class="calx-list-empty">No events or tasks this month</div>';
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    let html = '';
    let lastDate = '';

    items.forEach(item => {
      // Date separator
      if (item.dateStr !== lastDate) {
        lastDate = item.dateStr;
        const d = new Date(item.dateStr + 'T00:00:00');
        const label = item.dateStr === today
          ? 'Today'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const todayCls = item.dateStr === today ? ' is-today' : '';
        html += `<div class="calx-list-day-sep${todayCls}">${label}</div>`;
      }

      if (item.type === 'task') {
        const priorityColors = { high: '#ef4444', medium: '#f97316', low: '#22c55e' };
        const dotColor = priorityColors[item.priority] || '#f97316';
        const doneCls = item.completed ? ' done' : '';
        const badgeCls = item.priority === 'high' ? 'task high' : item.priority === 'low' ? 'task low' : 'task';
        const badgeLabel = item.priority ? item.priority : 'task';
        html += `
        <div class="calx-list-item">
          <div class="calx-list-dot" style="background:${dotColor}"></div>
          <div class="calx-list-info">
            <div class="calx-list-name${doneCls}">✓ ${item.title}</div>
            <div class="calx-list-meta">${item.subjectName || 'No subject'}</div>
          </div>
          <span class="calx-list-badge ${badgeCls}">${badgeLabel}</span>
        </div>`;
      } else {
        html += `
        <div class="calx-list-item">
          <div class="calx-list-dot" style="background:#6366f1"></div>
          <div class="calx-list-info">
            <div class="calx-list-name">${item.title}</div>
            <div class="calx-list-meta">${item.time || 'All day'}</div>
          </div>
          <span class="calx-list-badge event">event</span>
        </div>`;
      }
    });

    listEl.innerHTML = html;
  }


  // Initialize
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      setTimeout(() => {
        loadEvents();
      }, 1000);
    }
  });

  // Refresh when tasks are updated
  window.refreshCalendar = loadEvents;
})();