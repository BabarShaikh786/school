    // Time-based greeting
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greetingText');

    if (hour < 12) greetingEl.textContent = 'Good Morning';
    else if (hour < 17) greetingEl.textContent = 'Good Afternoon';
    else greetingEl.textContent = 'Good Evening';

    // Card click handler (replace with routing logic)
    function handleCard(type) {
      alert(type + ' clicked');
    }
    // Enhanced home.js with Live Counts and Navigation
// Save as: script/home.js

const HomePage = {
    init() {
        this.setGreeting();
        this.setupCardNavigation();
        this.updateCounts();
        
        // Update counts every 30 seconds
        setInterval(() => this.updateCounts(), 30000);
    },

    setGreeting() {
        const hour = new Date().getHours();
        const greetingEl = document.getElementById('greetingText');
        
        if (hour < 12) greetingEl.textContent = 'Good Morning';
        else if (hour < 17) greetingEl.textContent = 'Good Afternoon';
        else greetingEl.textContent = 'Good Evening';
    },

    setupCardNavigation() {
        // Quick Access Cards - click to navigate
        document.querySelectorAll('.card[data-target]').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.getAttribute('data-target');
                const navButton = document.querySelector(`.nav button[data-target="${target}"]`);
                if (navButton) {
                    navButton.click();
                }
            });
            
            // Add cursor pointer
            card.style.cursor = 'pointer';
        });

        // Greeting action buttons
        const taskButton = document.querySelector('.greeting-actions .btn:first-child');
        if (taskButton) {
            taskButton.onclick = () => {
                const navButton = document.querySelector('.nav button[data-target="tasks"]');
                if (navButton) navButton.click();
            };
        }

        const aiButton = document.querySelector('.greeting-actions .btn.secondary');
        if (aiButton) {
            aiButton.onclick = () => {
                const navButton = document.querySelector('.nav button[data-target="ai"]');
                if (navButton) navButton.click();
            };
        }
    },

    async updateCounts() {
        try {
            // Update task counts
            await this.updateTaskCounts();
            
            // Update calendar event counts
            await this.updateCalendarCounts();
            
            // Update subject counts
            await this.updateSubjectCounts();
            
            // Update expense counts
            await this.updateExpenseCounts();
            
            // Update greeting stats
            await this.updateGreetingStats();
        } catch (error) {
            console.error('Error updating counts:', error);
        }
    },

    async updateTaskCounts() {
        const tasks = await DataManager.getTasks();
        const incompleteTasks = tasks.filter(t => !t.completed);
        
        // Update quick access card
        const taskCard = document.querySelector('.card[data-target="tasks"] .count');
        if (taskCard) {
            taskCard.textContent = incompleteTasks.length;
        }

        // Update tasks due today in greeting
        const today = new Date().toISOString().split('T')[0];
        const dueToday = incompleteTasks.filter(t => t.date === today);
        
        const taskCountEl = document.getElementById('taskCount');
        if (taskCountEl) {
            taskCountEl.textContent = dueToday.length;
        }
    },

    async updateCalendarCounts() {
        const events = await DataManager.getCalendarEvents();
        const today = new Date().toISOString().split('T')[0];
        
        // Count events today
        const todayEvents = events.filter(e => {
            const eventDate = e.date || new Date(e.timestamp?.seconds * 1000).toISOString().split('T')[0];
            return eventDate === today;
        });

        const eventCountEl = document.getElementById('eventCount');
        if (eventCountEl) {
            eventCountEl.textContent = todayEvents.length;
        }

        // Update calendar card count (upcoming events this week)
        const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        const upcomingEvents = events.filter(e => {
            const eventDate = e.date || new Date(e.timestamp?.seconds * 1000).toISOString().split('T')[0];
            return eventDate >= today && eventDate <= weekEnd;
        });

        const calendarCard = document.querySelector('.card .calendar').parentElement.querySelector('.count');
        if (calendarCard) {
            calendarCard.textContent = upcomingEvents.length;
        }
    },

    async updateSubjectCounts() {
        const subjects = await DataManager.getSubjects();
        
        const subjectCard = document.querySelector('.card .subjects').parentElement.querySelector('.count');
        if (subjectCard) {
            subjectCard.textContent = subjects.length;
        }
    },

    async updateExpenseCounts() {
        const expenses = await DataManager.getExpenses();
        
        // Count expenses this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const thisMonthExpenses = expenses.filter(e => {
            const expenseDate = new Date(e.date.seconds * 1000);
            return expenseDate >= monthStart;
        });

        const expenseCard = document.querySelector('.card .expenses').parentElement.querySelector('.count');
        if (expenseCard) {
            expenseCard.textContent = thisMonthExpenses.length;
        }
    },

    async updateGreetingStats() {
        // Get completion percentage
        const tasks = await DataManager.getTasks();
        if (tasks.length === 0) return;
        
        const completed = tasks.filter(t => t.completed).length;
        const percentage = Math.round((completed / tasks.length) * 100);
        
        // Update greeting subtitle with productivity stats
        const greetingSub = document.querySelector('.greeting-sub');
        const taskCount = document.getElementById('taskCount').textContent;
        const eventCount = document.getElementById('eventCount').textContent;
        
        if (greetingSub) {
            greetingSub.innerHTML = `
                You have <span id="taskCount">${taskCount}</span> tasks due today and 
                <span id="eventCount">${eventCount}</span> events scheduled.
                <br>
                <small style="color: #666; margin-top: 8px; display: block;">
                    Overall progress: ${percentage}% of tasks completed
                </small>
            `;
        }
    },

    // Quick stats for dashboard
    async getQuickStats() {
        const tasks = await DataManager.getTasks();
        const subjects = await DataManager.getSubjects();
        const events = await DataManager.getCalendarEvents();
        
        const today = new Date().toISOString().split('T')[0];
        
        return {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.completed).length,
            dueToday: tasks.filter(t => t.date === today && !t.completed).length,
            overdue: tasks.filter(t => t.date && new Date(t.date) < new Date(today) && !t.completed).length,
            totalSubjects: subjects.length,
            eventsToday: events.filter(e => {
                const eventDate = e.date || new Date(e.timestamp?.seconds * 1000).toISOString().split('T')[0];
                return eventDate === today;
            }).length,
            completionRate: tasks.length > 0 
                ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
                : 0
        };
    }
};

// Initialize when user is authenticated
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        setTimeout(() => {
            HomePage.init();
        }, 1500);
    }
});

window.HomePage = HomePage;