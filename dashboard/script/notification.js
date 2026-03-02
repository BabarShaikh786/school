// ========================================
// NOTIFICATIONS MODULE - FIXED VERSION
// ========================================

let notificationData = null;
let emailCheckInterval = null;

// Initialize EmailJS - REPLACE WITH YOUR ACTUAL KEYS
const EMAILJS_PUBLIC_KEY = 'Op9XfG6rozqzDPCzI'; // Your public key
const EMAILJS_SERVICE_ID = 'service_8xl6bpa'; // Your service ID
const EMAILJS_TEMPLATE_ID = 'template_jugpqtk'; // Your template ID

// Initialize EmailJS on load (guarded — we now use server-side email)
(function() {
    try {
        if (typeof emailjs !== 'undefined') emailjs.init(EMAILJS_PUBLIC_KEY);
    } catch(e) {
        console.warn('EmailJS not loaded — using server-side email instead.');
    }
})();

// Open notification panel
async function openNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    const overlay = document.getElementById('notification-overlay');
    
    if (!panel || !overlay) return;

    panel.style.right = '0';
    overlay.style.display = 'block';
    await loadNotificationData();
}

// Close notification panel
function closeNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    const overlay = document.getElementById('notification-overlay');
    
    if (panel) panel.style.right = '-110vw';
    if (overlay) overlay.style.display = 'none';
}

// Load notification data
async function loadNotificationData() {
    const content = document.getElementById('notification-content');
    if (!content) return;

    content.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
            <i class='bx bx-loader-alt' style="font-size: 48px; animation: spin 1s linear infinite;"></i>
            <p style="margin-top: 16px;">Loading your overview...</p>
        </div>
    `;

    try {
        if (!window.DataManager || !window.DataManager.userId) {
            setTimeout(loadNotificationData, 500);
            return;
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const allTasks = await window.DataManager.getTasks();
        const todayTasks = allTasks.filter(task => {
            return task.date === todayStr && !task.completed;
        });

        const allEvents = await window.DataManager.getCalendarEvents();
        const todayEvents = allEvents.filter(event => event.date === todayStr);

        const allDocs = await window.DataManager.getDocuments();
        const recentDocs = allDocs
            .filter(doc => doc.lastOpened)
            .sort((a, b) => {
                const dateA = a.lastOpened?.toDate ? a.lastOpened.toDate() : new Date(a.lastOpened);
                const dateB = b.lastOpened?.toDate ? b.lastOpened.toDate() : new Date(b.lastOpened);
                return dateB - dateA;
            })
            .slice(0, 2);

        const recentNotes = await getRecentNotes();

        notificationData = {
            tasks: todayTasks,
            events: todayEvents,
            documents: recentDocs,
            notes: recentNotes,
            date: today
        };

        renderNotificationContent(notificationData);
        updateNotificationBadge(todayTasks.length + todayEvents.length);

    } catch (error) {
        console.error('Error loading notification data:', error);
        content.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #e74c3c;">
                <i class='bx bx-error-circle' style="font-size: 48px;"></i>
                <p style="margin-top: 16px;">Failed to load overview</p>
            </div>
        `;
    }
}

// Get recent notes from subjects
async function getRecentNotes() {
    try {
        const subjects = await window.DataManager.getSubjects();
        const allNotes = [];

        subjects.forEach(subject => {
            if (subject.notes && subject.notes.length > 0) {
                subject.notes.forEach((note, index) => {
                    allNotes.push({
                        title: note.title || 'Untitled Note',
                        subjectName: subject.name,
                        subjectId: subject.id,
                        subjectColor: subject.color,
                        noteIndex: index,
                        createdAt: note.createdAt || new Date().toISOString()
                    });
                });
            }
        });

        return allNotes
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 2);

    } catch (error) {
        console.error('Error getting recent notes:', error);
        return [];
    }
}

// Render notification content — theme-aware
function renderNotificationContent(data) {
    const content = document.getElementById('notification-content');
    if (!content) return;

    const { tasks, events, documents, notes, date } = data;
    const isDark = document.body.classList.contains('dark-theme');

    // Theme tokens
    const T = {
        text:      isDark ? '#e5e7eb' : '#1a1a1a',
        text2:     isDark ? '#9ca3af' : '#6b7280',
        text3:     isDark ? '#6b7280' : '#9ca3af',
        section:   isDark ? 'rgba(255,255,255,0.06)' : '#f8f8f8',
        border:    isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
        taskBg:    isDark ? 'rgba(239,68,68,0.12)' : '#fff5f5',
        taskBord:  '#ef4444',
        eventBg:   isDark ? 'rgba(59,130,246,0.12)' : '#f0f9ff',
        eventBord: '#3b82f6',
        docBg:     isDark ? 'rgba(99,102,241,0.1)' : '#f5f3ff',
        docBord:   '#8b5cf6',
        noteBg:    isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4',
        noteBord:  '#10b981',
        emptyCol:  isDark ? '#4b5563' : '#d1d5db',
    };

    const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const sectionLabel = (icon, label) => `
        <div style="font-size:11px;font-weight:700;color:${T.text2};text-transform:uppercase;
            letter-spacing:0.8px;margin-bottom:12px;display:flex;align-items:center;gap:7px;
            padding-bottom:8px;border-bottom:1px solid ${T.border};">
            <i class='bx ${icon}' style="font-size:15px;color:#818cf8"></i>
            ${label}
        </div>`;

    const emptyRow = (msg) => `
        <div style="padding:14px 0;text-align:center;color:${T.emptyCol};font-size:13px;">${msg}</div>`;

    let html = `
        <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid ${T.border};">
            <div style="font-size:12px;color:${T.text2};margin-bottom:3px;">${getGreeting()}</div>
            <div style="font-size:17px;font-weight:700;color:${T.text};line-height:1.3;">${dateStr}</div>
        </div>`;

    // ── Tasks ──────────────────────────────────────────────
    html += `<div style="margin-bottom:24px;">
        ${sectionLabel('bx-task', `Today's Tasks (${tasks.length})`)}`;
    if (tasks.length > 0) {
        tasks.forEach(t => {
            const pri = t.priority || 'medium';
            const priCol = pri === 'high' ? '#ef4444' : pri === 'medium' ? '#f59e0b' : '#10b981';
            html += `
            <div onclick="navigateToTaskFromNotif('${t.id}')" style="
                padding:11px 13px;background:${T.taskBg};border-left:3px solid ${T.taskBord};
                border-radius:8px;margin-bottom:8px;cursor:pointer;transition:opacity 0.15s"
                onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
                <div style="font-size:13px;font-weight:600;color:${T.text};margin-bottom:3px;">${t.title}</div>
                <div style="font-size:11px;color:${T.text2};display:flex;align-items:center;gap:6px;">
                    <span>${t.subjectName || 'No subject'}</span>
                    <span>·</span>
                    <span style="color:${priCol};font-weight:600;text-transform:capitalize">${pri}</span>
                </div>
            </div>`;
        });
    } else {
        html += emptyRow('No tasks due today');
    }
    html += '</div>';

    // ── Events ─────────────────────────────────────────────
    html += `<div style="margin-bottom:24px;">
        ${sectionLabel('bx-calendar', `Today's Events (${events.length})`)}`;
    if (events.length > 0) {
        events.forEach(ev => {
            html += `
            <div style="padding:11px 13px;background:${T.eventBg};border-left:3px solid ${T.eventBord};
                border-radius:8px;margin-bottom:8px;">
                <div style="font-size:13px;font-weight:600;color:${T.text};margin-bottom:3px;">${ev.title}</div>
                <div style="font-size:11px;color:${T.text2};">
                    ${ev.time || ''}${ev.description ? ' · ' + ev.description : ''}
                </div>
            </div>`;
        });
    } else {
        html += emptyRow('No events scheduled today');
    }
    html += '</div>';

    // ── Documents — styled like AI brain tab ───────────────
    html += `<div style="margin-bottom:24px;">
        ${sectionLabel('bx-file', `Recent Documents (${documents.length})`)}`;
    if (documents.length > 0) {
        documents.forEach(doc => {
            const lastOpened = doc.lastOpened?.toDate ? doc.lastOpened.toDate() : new Date(doc.lastOpened);
            const ext = (doc.title || 'doc').split('.').pop().toUpperCase();
            const extColors = { PDF:'#ef4444', DOCX:'#3b82f6', TXT:'#10b981', MD:'#f59e0b' };
            const extCol = extColors[ext] || '#8b5cf6';
            html += `
            <div onclick="navigateToDocFromNotif('${doc.id}')" style="
                display:flex;align-items:center;gap:12px;
                padding:11px 13px;
                background:${isDark ? 'rgba(255,255,255,0.04)' : '#fff'};
                border:1px solid ${T.border};
                border-radius:10px;margin-bottom:8px;cursor:pointer;
                transition:all 0.15s;"
                onmouseover="this.style.borderColor='#818cf8';this.style.background='${T.docBg}'"
                onmouseout="this.style.borderColor='${T.border}';this.style.background='${isDark ? 'rgba(255,255,255,0.04)' : '#fff'}'">
                <div style="width:36px;height:36px;border-radius:9px;flex-shrink:0;
                    background:${T.docBg};border:1px solid rgba(139,92,246,0.2);
                    display:flex;align-items:center;justify-content:center;">
                    <i class='bx bx-file' style="font-size:18px;color:#8b5cf6"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;color:${T.text};
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">
                        ${doc.title || 'Untitled'}
                    </div>
                    <div style="font-size:11px;color:${T.text2};">
                        ${doc.subjectName || 'No subject'} · Opened ${getTimeAgo(lastOpened)}
                    </div>
                </div>
                <i class='bx bx-chevron-right' style="color:${T.text3};font-size:18px;flex-shrink:0"></i>
            </div>`;
        });
    } else {
        html += emptyRow('No recent documents');
    }
    html += '</div>';

    // ── Notes ──────────────────────────────────────────────
    html += `<div style="margin-bottom:16px;">
        ${sectionLabel('bx-note', `Recent Notes (${notes.length})`)}`;
    if (notes.length > 0) {
        notes.forEach(note => {
            const col = note.subjectColor || '#10b981';
            html += `
            <div onclick="navigateToNoteFromNotif('${note.subjectId}', ${note.noteIndex})" style="
                padding:11px 13px;background:${T.noteBg};border-left:3px solid ${col};
                border-radius:8px;margin-bottom:8px;cursor:pointer;transition:opacity 0.15s"
                onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
                <div style="font-size:13px;font-weight:600;color:${T.text};margin-bottom:3px;">${note.title}</div>
                <div style="font-size:11px;color:${T.text2};">${note.subjectName}</div>
            </div>`;
        });
    } else {
        html += emptyRow('No recent notes');
    }
    html += '</div>';

    content.innerHTML = html;
}

// Helper: Get greeting based on time based on time
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning! ☀️';
    if (hour < 17) return 'Good Afternoon! 👋';
    return 'Good Evening! 🌙';
}

// Helper: Get time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hrs ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    
    return date.toLocaleDateString();
}

// Update notification badge
function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Navigation functions
function navigateToTaskFromNotif(taskId) {
    closeNotificationPanel();
    const tasksBtn = document.querySelector('[data-target="tasks"]');
    if (tasksBtn) tasksBtn.click();
}

function navigateToDocFromNotif(docId) {
    closeNotificationPanel();
    const aiBtn = document.querySelector('[data-target="ai"]');
    if (aiBtn) aiBtn.click();
}

function navigateToNoteFromNotif(subjectId, noteIndex) {
    closeNotificationPanel();
    const subjectsBtn = document.querySelector('[data-target="subjects"]');
    if (subjectsBtn) subjectsBtn.click();
}

// Send email notification
async function sendEmailNotification() {
    if (!notificationData) {
        alert('Please wait for data to load');
        return;
    }

    const user = window.firebase.auth().currentUser;
    if (!user) {
        alert('Please login to send email');
        return;
    }

    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="bx bx-loader-alt" style="animation: spin 1s linear infinite;"></i> Sending...';
    button.disabled = true;

    try {
        const templateParams = {
            to_email: user.email,
            to_name: user.displayName || user.email.split('@')[0],
            date: notificationData.date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            tasks_count: notificationData.tasks.length,
            events_count: notificationData.events.length,
            tasks_list: notificationData.tasks.length > 0 
                ? notificationData.tasks.map(t => `• ${t.title} (${t.subjectName || 'No subject'})`).join('\n')
                : '',
            events_list: notificationData.events.length > 0
                ? notificationData.events.map(e => `• ${e.title} at ${e.time}`).join('\n')
                : '',
            docs_list: notificationData.documents.length > 0
                ? notificationData.documents.map(d => `• ${d.title || 'Untitled'}`).join('\n')
                : '',
            notes_list: notificationData.notes.length > 0
                ? notificationData.notes.map(n => `• ${n.title} (${n.subjectName})`).join('\n')
                : ''
        };

        if (typeof emailjs !== "undefined") await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams); else throw new Error("EmailJS not available — use server email");
        
        button.innerHTML = '<i class="bx bx-check"></i> Sent!';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Email error:', error);
        button.innerHTML = originalText;
        button.disabled = false;
        alert('Failed to send email. Please try again.');
    }
}

// ========================================
// SCHEDULED EMAIL AT 6 AM
// ========================================

// ========================================
// SCHEDULED EMAIL AT SPECIFIED TIME - FIXED
// ========================================

async function checkAndSendScheduledEmail() {
    try {
        // Ensure EmailJS is initialized
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS not loaded');
            return;
        }

        // Get user settings
        const user = firebase.auth().currentUser;
        if (!user) {
            console.log('No user logged in');
            return;
        }

        const settingsDoc = await db.collection('users').doc(user.uid)
            .collection('settings').doc('preferences').get();

        if (!settingsDoc.exists) {
            console.log('No settings document found');
            return;
        }

        const settings = settingsDoc.data();
        
        // Check if email notifications are enabled
        if (!settings.emailNotifications) {
            console.log('Email notifications disabled in settings');
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const scheduledTime = settings.summaryTime || '06:00';
        
        // Parse scheduled time
        const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);

        console.log(`Current time: ${currentTime}, Scheduled: ${scheduledTime}`);

        // Check if current time matches scheduled time (with 1-minute window)
        const isTimeToSend = (currentHour === scheduledHour) && 
                            (currentMinute === scheduledMinute || currentMinute === scheduledMinute + 1);

        if (!isTimeToSend) {
            return; // Not time yet
        }

        // Check if we already sent today
        const lastSentKey = `lastEmailSent_${user.uid}`;
        const lastSent = localStorage.getItem(lastSentKey);
        const today = now.toISOString().split('T')[0];

        if (lastSent === today) {
            console.log('✅ Email already sent today');
            return;
        }

        console.log('📧 Time to send scheduled email!');

        // Load notification data first
        await loadNotificationData();
        
        // Wait a bit for data to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!notificationData) {
            console.error('❌ Notification data not loaded');
            return;
        }

        // Prepare email template parameters
        const templateParams = {
            to_email: user.email,
            to_name: user.displayName || user.email.split('@')[0],
            date: notificationData.date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            tasks_count: notificationData.tasks.length,
            events_count: notificationData.events.length,
            tasks_list: notificationData.tasks.length > 0 
                ? notificationData.tasks.map(t => `• ${t.title} (${t.subjectName || 'No subject'})`).join('\n')
                : 'No tasks for today',
            events_list: notificationData.events.length > 0
                ? notificationData.events.map(e => `• ${e.title} at ${e.time}`).join('\n')
                : 'No events scheduled',
            docs_list: notificationData.documents.length > 0
                ? notificationData.documents.map(d => `• ${d.title || 'Untitled'}`).join('\n')
                : 'No recent documents',
            notes_list: notificationData.notes.length > 0
                ? notificationData.notes.map(n => `• ${n.title} (${n.subjectName})`).join('\n')
                : 'No recent notes'
        };

        // Get credentials - ensure they exist
        const serviceId = typeof EMAILJS_SERVICE_ID !== 'undefined' ? EMAILJS_SERVICE_ID : 'service_v43j0yn';
        const templateId = typeof EMAILJS_TEMPLATE_ID !== 'undefined' ? EMAILJS_TEMPLATE_ID : 'template_jugpqtk';
        
        console.log('📧 Attempting to send with:');
        console.log('Service ID:', serviceId);
        console.log('Template ID:', templateId);
        
        // Send email using EmailJS
        if (typeof emailjs === 'undefined') throw new Error('EmailJS not loaded');
        const response = await emailjs.send(serviceId, templateId, templateParams);
        
        console.log('📧 Email send response:', response);
        
        // Mark as sent today
        localStorage.setItem(lastSentKey, today);
        console.log('✅ Scheduled email sent successfully at', currentTime);
        
        // Show success notification (optional)
        if (typeof showSettingsToast === 'function') {
            showSettingsToast('Daily summary email sent!', 'success');
        }

    } catch (error) {
        console.error('❌ Error in scheduled email:', error);
        console.error('Error details:', error.message);
        console.error('Full error:', error);
    }
}

// Start checking for scheduled emails every minute
function startEmailScheduler() {
    // Clear any existing interval
    if (emailCheckInterval) {
        clearInterval(emailCheckInterval);
    }

    console.log('📧 Email scheduler starting...');
    
    // Check immediately on start
    checkAndSendScheduledEmail();

    // Then check every minute (60000ms)
    emailCheckInterval = setInterval(() => {
        console.log('⏰ Checking scheduled email time...');
        checkAndSendScheduledEmail();
    }, 60000);
    
    console.log('✅ Email scheduler started - checking every minute');
}

// Stop the scheduler (useful for cleanup)
function stopEmailScheduler() {
    if (emailCheckInterval) {
        clearInterval(emailCheckInterval);
        emailCheckInterval = null;
        console.log('📧 Email scheduler stopped');
    }
}

// Initialize when authenticated
if (window.firebase && window.firebase.auth) {
    window.firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('🔐 User authenticated, starting scheduler in 2 seconds...');
            setTimeout(() => {
                loadNotificationData();
                startEmailScheduler();
            }, 2000);
        } else {
            console.log('🔓 User logged out, stopping scheduler');
            stopEmailScheduler();
        }
    });
}

// Expose functions globally
window.startEmailScheduler = startEmailScheduler;
window.stopEmailScheduler = stopEmailScheduler;
// Expose functions globally
window.openNotificationPanel = openNotificationPanel;
window.closeNotificationPanel = closeNotificationPanel;
window.sendEmailNotification = sendEmailNotification;
window.navigateToTaskFromNotif = navigateToTaskFromNotif;
window.navigateToDocFromNotif = navigateToDocFromNotif;
window.navigateToNoteFromNotif = navigateToNoteFromNotif;