// ========================================
// DISCIPLINE TRACKER MODULE - Firebase Version
// ========================================

let fl62_habits_storage = [];
let qm84_completions_storage = {};
const wn35_day_names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Load data from Firebase
async function yu27_load_stored_data() {
    try {
        // Wait for DataManager
        if (!window.DataManager || !window.DataManager.userId) {
            setTimeout(yu27_load_stored_data, 500);
            return;
        }

        console.log('🎯 Loading habits from Firebase...');

        // Get habits
        const habits = await window.DataManager.getHabits();
        fl62_habits_storage = habits;

        // Get completions
        const completions = await window.DataManager.getCompletions();
        qm84_completions_storage = completions;

        console.log('✅ Habits loaded:', fl62_habits_storage.length);
        console.log('📊 Completions loaded:', Object.keys(qm84_completions_storage).length);

        pr68_render_today_habits();
        sd49_update_current_date();

    } catch (error) {
        console.error('Error loading habits:', error);
        fl62_habits_storage = [];
        qm84_completions_storage = {};
        pr68_render_today_habits();
    }
}

// Save data to Firebase
async function ol37_persist_to_storage() {
    try {
        await window.DataManager.saveCompletions(qm84_completions_storage);
        console.log('✅ Habits saved to Firebase');
    } catch (error) {
        console.error('Error saving habits:', error);
    }
}

function tk91_initialize_application() {
    yu27_load_stored_data();
    sd49_update_current_date();
    ux73_setup_event_bindings();
}

function ux73_setup_event_bindings() {
    const navButtons = document.querySelectorAll('.jf5_nav_interactive_button');
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            lb45_switch_active_view(view);
        });
    });

    const addBtn = document.getElementById('np54_add_habit_trigger');
    const cancelBtn = document.getElementById('ik29_cancel_modal_button');
    const saveBtn = document.getElementById('sw76_save_habit_button');
    const modalOverlay = document.getElementById('zw31_modal_overlay_container');

    if (addBtn) addBtn.addEventListener('click', mn82_open_habit_modal);
    if (cancelBtn) cancelBtn.addEventListener('click', qv19_close_habit_modal);
    if (saveBtn) saveBtn.addEventListener('click', fh34_save_new_habit);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                qv19_close_habit_modal();
            }
        });
    }
}

function lb45_switch_active_view(view) {
    document.querySelectorAll('.jf5_nav_interactive_button').forEach(el => el.classList.remove('zx1_state_is_active'));
    document.querySelectorAll('.mg8_content_view_container').forEach(el => el.classList.remove('zx1_state_is_active'));
    
    const targetBtn = document.querySelector(`[data-view="${view}"]`);
    if (targetBtn) targetBtn.classList.add('zx1_state_is_active');

    const panelId = view === 'today' ? 'vc47_today_view_panel' : 
                    view === 'week' ? 'kl28_week_view_panel' : 
                    'nv15_month_view_panel';
    
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('zx1_state_is_active');

    if (view === 'week') ng57_render_weekly_analytics();
    if (view === 'month') dp23_render_monthly_analytics();
}

function sd49_update_current_date() {
    const today = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('tj19_current_date_string');
    if (dateEl) {
        dateEl.textContent = today.toLocaleDateString('en-US', options);
    }
}

function pr68_render_today_habits() {
    const container = document.getElementById('mw73_habits_rendering_zone');
    if (!container) return;

    const today = jw76_get_date_key(new Date());

    if (fl62_habits_storage.length === 0) {
        container.innerHTML = `
            <div class="tw9_empty_state_placeholder_zone">
                <div class="vk5_empty_state_icon_symbol">○</div>
                <div class="bi8_empty_primary_message_text">No habits yet</div>
                <div class="lu1_empty_secondary_hint_text">Add your first habit to start building discipline</div>
            </div>
        `;
        ck58_update_discipline_score();
        return;
    }

    container.innerHTML = fl62_habits_storage.map((h, i) => {
        const done = qm84_completions_storage[today]?.includes(i) || false;
        return `
            <div class="lp2_individual_habit_card ${done ? 'wy7_completion_marked' : ''}" data-habit-index="${i}">
                <div class="uc3_circular_checkbox_indicator">
                    <svg class="ts4_checkmark_svg_icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="bv5_habit_text_content_area">
                    <div class="op6_primary_habit_title_text">${h.name}</div>
                    <div class="xk1_secondary_metadata_text">${h.frequency}</div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.lp2_individual_habit_card').forEach(habit => {
        habit.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-habit-index'));
            wt92_toggle_habit_completion(index);
        });
    });

    ck58_update_discipline_score();
}

function wt92_toggle_habit_completion(index) {
    const today = jw76_get_date_key(new Date());
    if (!qm84_completions_storage[today]) qm84_completions_storage[today] = [];

    const pos = qm84_completions_storage[today].indexOf(index);
    if (pos === -1) {
        qm84_completions_storage[today].push(index);
        vh51_show_celebration_popup();
    } else {
        qm84_completions_storage[today].splice(pos, 1);
    }

    ol37_persist_to_storage();
    pr68_render_today_habits();
}

function vh51_show_celebration_popup() {
    const cel = document.getElementById('cv48_celebration_popup');
    if (cel) {
        cel.classList.add('zx1_state_is_active');
        setTimeout(() => cel.classList.remove('zx1_state_is_active'), 800);
    }
}

function ck58_update_discipline_score() {
    const last7 = xp29_get_last_7_days();
    let total = 0, done = 0;

    last7.forEach(date => {
        const key = jw76_get_date_key(date);
        const completed = qm84_completions_storage[key]?.length || 0;
        done += completed;
        total += fl62_habits_storage.length;
    });

    const score = total > 0 ? Math.round((done / total) * 100) : 0;
    const scoreEl = document.getElementById('ds92_score_display_value');
    if (scoreEl) scoreEl.textContent = score;

    const msg = document.getElementById('fb38_dynamic_message_content');
    if (msg) {
        if (score >= 85) msg.textContent = 'Excellent discipline';
        else if (score >= 60) msg.textContent = 'Building momentum';
        else if (score >= 40) msg.textContent = 'Keep showing up';
        else msg.textContent = 'Start small, stay consistent';
    }
}

function ng57_render_weekly_analytics() {
    const last7 = xp29_get_last_7_days();
    let totalDone = 0, totalPossible = 0;
    let dayStats = {};

    const grid = document.getElementById('pw36_week_calendar_grid');
    if (!grid) return;

    grid.innerHTML = last7.map(date => {
        const key = jw76_get_date_key(date);
        const done = qm84_completions_storage[key]?.length || 0;
        const total = fl62_habits_storage.length;
        const dayName = wn35_day_names[date.getDay()];
        
        totalDone += done;
        totalPossible += total;
        dayStats[dayName] = done;

        let className = '';
        if (done === total && total > 0) className = 'fe1_fully_completed_state';
        else if (done > 0) className = 'mn3_partially_completed_state';

        return `
            <div class="qs8_individual_day_block_cell ${className}">
                <div class="uv4_abbreviated_day_name_label">${dayName}</div>
                <div class="px7_completion_count_number">${done}</div>
            </div>
        `;
    }).join('');

    const rate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
    
    const weeklyCountEl = document.getElementById('rx65_weekly_completion_count');
    const consistencyEl = document.getElementById('zy41_weekly_consistency_rate');
    const bestDayEl = document.getElementById('bh82_best_performing_day');

    if (weeklyCountEl) weeklyCountEl.textContent = totalDone;
    if (consistencyEl) consistencyEl.textContent = rate + '%';

    const best = Object.keys(dayStats).reduce((a, b) => dayStats[a] > dayStats[b] ? a : b, '—');
    if (bestDayEl) bestDayEl.textContent = best;

    mq64_render_weekly_insights(dayStats, rate);
}

function mq64_render_weekly_insights(stats, rate) {
    const insights = [];

    if (rate >= 70) {
        insights.push('You showed up consistently this week. That\'s real discipline.');
    }

    const best = Object.keys(stats).reduce((a, b) => stats[a] > stats[b] ? a : b);
    if (stats[best] > 0) {
        insights.push(`${best} is your strongest day. Use it for your most important work.`);
    }

    if (rate < 50 && fl62_habits_storage.length > 4) {
        insights.push('Consider fewer habits. Quality beats quantity every time.');
    }

    if (insights.length === 0) {
        insights.push('Start with one habit. Build from there.');
    }

    const insightsEl = document.getElementById('qt59_weekly_insights_area');
    if (insightsEl) {
        insightsEl.innerHTML = insights.map(text => 
            `<div class="dj6_single_insight_message_card">${text}</div>`
        ).join('');
    }
}

function dp23_render_monthly_analytics() {
    const last30 = er41_get_last_30_days();
    let totalDone = 0, totalPossible = 0;
    let streak = 0, temp = 0;

    last30.forEach(date => {
        const key = jw76_get_date_key(date);
        const done = qm84_completions_storage[key]?.length || 0;
        const total = fl62_habits_storage.length;
        
        totalDone += done;
        totalPossible += total;

        if (done > 0) {
            temp++;
            streak = Math.max(streak, temp);
        } else {
            temp = 0;
        }
    });

    const rate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

    const totalEl = document.getElementById('uf23_monthly_total_habits');
    const streakEl = document.getElementById('sg74_current_streak_days');
    const successEl = document.getElementById('dl96_monthly_success_percentage');

    if (totalEl) totalEl.textContent = totalDone;
    if (streakEl) streakEl.textContent = streak;
    if (successEl) successEl.textContent = rate + '%';

    ku72_render_monthly_insights(rate, streak);
}

function ku72_render_monthly_insights(rate, streak) {
    const insights = [];

    if (streak >= 7) {
        insights.push(`${streak} day streak. You're becoming who you want to be.`);
    }

    if (rate >= 70) {
        insights.push('This consistency is building your identity as a disciplined person.');
    } else if (rate >= 50) {
        insights.push('You\'re making progress. Keep the momentum going.');
    } else {
        insights.push('Discipline isn\'t perfection. It\'s showing up, even imperfectly.');
    }

    const insightsEl = document.getElementById('hk58_monthly_insights_area');
    if (insightsEl) {
        insightsEl.innerHTML = insights.map(text => 
            `<div class="dj6_single_insight_message_card">${text}</div>`
        ).join('');
    }
}

function mn82_open_habit_modal() {
    if (fl62_habits_storage.length >= 6) {
        alert('Maximum 6 habits. Focus on quality over quantity.');
        return;
    }
    const modal = document.getElementById('zw31_modal_overlay_container');
    const input = document.getElementById('oj67_habit_name_input');
    
    if (modal) modal.classList.add('zx1_state_is_active');
    if (input) input.focus();
}

function qv19_close_habit_modal() {
    const modal = document.getElementById('zw31_modal_overlay_container');
    const input = document.getElementById('oj67_habit_name_input');
    
    if (modal) modal.classList.remove('zx1_state_is_active');
    if (input) input.value = '';
}

async function fh34_save_new_habit() {
    const nameInput = document.getElementById('oj67_habit_name_input');
    const categorySelect = document.getElementById('mb45_category_selector');
    const frequencySelect = document.getElementById('yr83_frequency_selector');

    if (!nameInput) return;

    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a habit name');
        return;
    }

    const habitData = {
        name: name,
        category: categorySelect ? categorySelect.value : 'study',
        frequency: frequencySelect ? frequencySelect.value : 'daily'
    };

    try {
        await window.DataManager.addHabit(habitData);
        await yu27_load_stored_data();
        qv19_close_habit_modal();
        console.log('✅ Habit added');
    } catch (error) {
        console.error('Error adding habit:', error);
        alert('Failed to add habit');
    }
}

function jw76_get_date_key(date) {
    return date.toISOString().split('T')[0];
}

function xp29_get_last_7_days() {
    return Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
    });
}

function er41_get_last_30_days() {
    return Array.from({length: 30}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return d;
    });
}

// Initialize
tk91_initialize_application();