// Settings Side Panel JavaScript - FIXED VERSION

// Settings State
let settingsState = {
    pushNotifications: true,
    emailNotifications: false,
    summaryTime: '17:31',
    theme: 'light'
};

// ========================================
// OPEN/CLOSE SETTINGS PANEL
// ========================================
function openSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    
    if (panel && overlay) {
        panel.style.right = '0';
        overlay.style.display = 'block';
        loadSettingsData();
    }
}

function closeSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    
    if (panel && overlay) {
        panel.style.right = '-110vw';
        overlay.style.display = 'none';
    }
}

// ========================================
// LOAD SETTINGS DATA
// ========================================
async function loadSettingsData() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        // Display user email
        const emailDisplay = document.getElementById('user-email-display');
        if (emailDisplay) {
            emailDisplay.textContent = user.email;
        }

        // Load settings from Firebase
        const doc = await db.collection('users').doc(user.uid)
            .collection('settings').doc('preferences').get();

        if (doc.exists) {
            const data = doc.data();
            settingsState = {
                pushNotifications: data.pushNotifications !== false,
                emailNotifications: data.emailNotifications || false,
                summaryTime: data.summaryTime || '17:31',
                theme: data.theme || 'light'
            };
        } else {
            // If no settings exist, create default ones
            await saveSettings();
        }

        // Update UI
        updateSettingsUI();

    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// ========================================
// UPDATE SETTINGS UI
// ========================================
function updateSettingsUI() {
    // Update toggles
    const pushToggle = document.getElementById('push-notifications-toggle');
    const emailToggle = document.getElementById('email-notifications-toggle');
    const summarySelect = document.getElementById('summary-time-select');

    if (pushToggle) pushToggle.checked = settingsState.pushNotifications;
    if (emailToggle) emailToggle.checked = settingsState.emailNotifications;
    if (summarySelect) summarySelect.value = settingsState.summaryTime;

    // Update theme buttons
    const lightBtn = document.getElementById('light-theme-btn');
    const darkBtn = document.getElementById('dark-theme-btn');

    if (lightBtn && darkBtn) {
        if (settingsState.theme === 'light') {
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        } else {
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        }
    }

    // Apply theme
    applyTheme(settingsState.theme);
}

// ========================================
// SAVE SETTINGS
// ========================================
async function saveSettings() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        await db.collection('users').doc(user.uid)
            .collection('settings').doc('preferences')
            .set(settingsState, { merge: true });

        console.log('✅ Settings saved:', settingsState);

    } catch (error) {
        console.error('❌ Error saving settings:', error);
    }
}

// ========================================
// TOGGLE PUSH NOTIFICATIONS
// ========================================
async function togglePushNotifications(enabled) {
    settingsState.pushNotifications = enabled;
    await saveSettings();
    showSettingsToast(
        enabled ? 'Push notifications enabled' : 'Push notifications disabled',
        'success'
    );
}

// ========================================
// TOGGLE EMAIL NOTIFICATIONS
// ========================================
async function toggleEmailNotifications(enabled) {
    settingsState.emailNotifications = enabled;
    await saveSettings();
    // Register/deregister with Node.js server scheduler
    if (typeof registerEmailSchedule === 'function') {
        await registerEmailSchedule(enabled, settingsState.summaryTime);
    }
    showSettingsToast(
        enabled 
            ? `Daily email enabled at ${settingsState.summaryTime}` 
            : 'Daily email disabled',
        'success'
    );
}

// ========================================
// UPDATE SUMMARY TIME
// ========================================
async function updateSummaryTime(time) {
    settingsState.summaryTime = time;
    await saveSettings();
    // Update server scheduler if email is enabled
    if (settingsState.emailNotifications && typeof registerEmailSchedule === 'function') {
        await registerEmailSchedule(true, time);
    }
    showSettingsToast(`Daily summary time set to ${time}`, 'success');
}

// ========================================
// SET THEME
// ========================================
async function setTheme(theme) {
    console.log('Setting theme to:', theme);
    
    settingsState.theme = theme;
    await saveSettings();
    
    // Update button states
    const lightBtn = document.getElementById('light-theme-btn');
    const darkBtn = document.getElementById('dark-theme-btn');

    if (lightBtn && darkBtn) {
        if (theme === 'light') {
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        } else {
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        }
    }

    // Apply theme
    applyTheme(theme);
    showSettingsToast(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme applied`, 'success');
}

// ========================================
// APPLY THEME - FIXED VERSION
// ========================================
function applyTheme(theme) {
    const body = document.body;
    
    console.log('Applying theme:', theme);
    
    // Remove both classes first
    body.classList.remove('light-theme', 'dark-theme');
    
    // Add the appropriate class
    if (theme === 'dark') {
        body.classList.add('dark-theme');
        console.log('✅ Dark theme applied');
    } else {
        body.classList.add('light-theme');
        console.log('✅ Light theme applied');
    }
    
    // Store in localStorage for persistence across page loads
    localStorage.setItem('theme', theme);
}

// ========================================
// LOAD THEME ON PAGE LOAD
// ========================================
function loadThemeOnStartup() {
    // Try to get theme from localStorage first
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
        console.log('Loading saved theme:', savedTheme);
        applyTheme(savedTheme);
        settingsState.theme = savedTheme;
    } else {
        // Default to light theme
        applyTheme('light');
    }
}

// Call this when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadThemeOnStartup();
});

// ========================================
// SEND TEST EMAIL
// ========================================
async function sendTestEmail() {
    const btn = event.target;
    const originalHTML = btn.innerHTML;
    
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Sending...';
    btn.disabled = true;

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            showSettingsToast('Please login first', 'error');
            return;
        }

        // Use the notification module to send email
        // Use server-side email (no EmailJS)
        if (typeof sendTestEmailViaServer === 'function') {
            await sendTestEmailViaServer();
        } else {
            showSettingsToast('Email function not available', 'error');
        }
        
    } catch (error) {
        console.error('Error sending test email:', error);
        showSettingsToast('Failed to send email', 'error');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// ========================================
// LOGOUT
// ========================================
function handleSettingsLogout() {
    if (confirm('Are you sure you want to logout?')) {
        firebase.auth().signOut().then(() => {
            window.location.href = 'signup.html';
        }).catch((error) => {
            console.error('Logout error:', error);
            showSettingsToast('Logout failed', 'error');
        });
    }
}

// ========================================
// SHOW TOAST NOTIFICATION
// ========================================
function showSettingsToast(message, type = 'info') {
    // Remove any existing toasts
    const existingToast = document.querySelector('.settings-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `settings-toast ${type}`;
    toast.innerHTML = `
        <i class='bx ${type === 'success' ? 'bx-check-circle' : type === 'error' ? 'bx-error-circle' : 'bx-info-circle'}'></i>
        <span>${message}</span>
    `;
    
    // Add styles
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: -400px;
        background: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        font-size: 14px;
        font-weight: 500;
        transition: right 0.3s ease;
        z-index: 3000;
        display: flex;
        align-items: center;
        gap: 12px;
        border-left: 4px solid ${type === 'success' ? '#2e7d32' : type === 'error' ? '#d32f2f' : '#1a73e8'};
        color: ${type === 'success' ? '#2e7d32' : type === 'error' ? '#d32f2f' : '#1a73e8'};
    `;
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.right = '20px';
    }, 10);
    
    setTimeout(() => {
        toast.style.right = '-400px';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// INITIALIZE ON PAGE LOAD
// ========================================
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // Load settings when user is authenticated
        loadSettingsData();
    }
});

// Expose functions globally
window.openSettingsPanel = openSettingsPanel;
window.closeSettingsPanel = closeSettingsPanel;
window.togglePushNotifications = togglePushNotifications;
window.toggleEmailNotifications = toggleEmailNotifications;
window.updateSummaryTime = updateSummaryTime;
window.setTheme = setTheme;
window.sendTestEmail = sendTestEmail;
window.handleSettingsLogout = handleSettingsLogout;