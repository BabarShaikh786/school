// ========================================
// AI ASSISTANT MODULE
// ========================================

let aiPanelOpen = false;

// Toggle AI Assistant Panel
function toggleAIAssistant() {
    const panel = document.getElementById('ai-assistant-panel');
    const btn = document.getElementById('ai-assistant-btn');
    
    if (!panel || !btn) return;

    aiPanelOpen = !aiPanelOpen;

    if (aiPanelOpen) {
        panel.style.display = 'flex';
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            document.getElementById('ai-input')?.focus();
        }, 300);
    } else {
        panel.style.display = 'none';
        btn.style.transform = 'scale(1)';
    }
}

// Quick command buttons
function quickCommand(command) {
    const input = document.getElementById('ai-input');
    if (input) {
        input.value = command;
        sendAIMessage();
    }
}

// Send AI message
async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';

    // Show typing indicator
    showTypingIndicator();

    // Process the command
    await processAICommand(message);

    // Remove typing indicator
    hideTypingIndicator();
}

// Add message to chat
function addMessageToChat(message, sender) {
    const chatMessages = document.getElementById('ai-chat-messages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-message-container';
    
    if (sender === 'user') {
        messageDiv.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 16px;';
        messageDiv.innerHTML = `
            <div style="
                background: var(--color-primary);
                color: var(--text-inverted);
                padding: 12px 16px;
                border-radius: 12px;
                max-width: 280px;
                font-size: 14px;
                line-height: 1.5;
            ">${message}</div>
        `;
    } else {
        messageDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 16px;';
        messageDiv.innerHTML = `
            <div style="
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: var(--color-primary);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-inverted);
                flex-shrink: 0;
            ">
                <i class='bx bx-bot'></i>
            </div>
            <div style="
                background: var(--bg-primary);
                padding: 12px 16px;
                border-radius: 12px;
                max-width: 280px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                font-size: 14px;
                line-height: 1.5;
            ">${message}</div>
        `;
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('ai-chat-messages');
    if (!chatMessages) return;

    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'ai-message-container';
    typingDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 16px;';
    typingDiv.innerHTML = `
        <div style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-primary);
            flex-shrink: 0;
        ">
            <i class='bx bx-bot'></i>
        </div>
        <div style="
            background: var(--bg-primary);
            padding: 12px 16px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        ">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Process AI command
async function processAICommand(message) {
    const lowerMessage = message.toLowerCase();

    try {
        // Wait for DataManager
        if (!window.DataManager || !window.DataManager.userId) {
            addMessageToChat('⚠️ Please wait, still loading...', 'ai');
            return;
        }

        // ==================== ADD TASK ====================
        if (lowerMessage.includes('add task') || lowerMessage.includes('create task') || lowerMessage.includes('new task')) {
            await handleAddTask(message);
        }
        
        // ==================== ADD SUBJECT ====================
        else if (lowerMessage.includes('add subject') || lowerMessage.includes('create subject') || lowerMessage.includes('new subject')) {
            await handleAddSubject(message);
        }
        
        // ==================== ADD EVENT ====================
        else if (lowerMessage.includes('add event') || lowerMessage.includes('create event') || lowerMessage.includes('schedule')) {
            await handleAddEvent(message);
        }
        
        // ==================== ADD HABIT ====================
        else if (lowerMessage.includes('add habit') || lowerMessage.includes('create habit') || lowerMessage.includes('new habit')) {
            await handleAddHabit(message);
        }
        
        // ==================== ADD EXPENSE ====================
        else if (lowerMessage.includes('add expense') || lowerMessage.includes('spent') || lowerMessage.includes('expense')) {
            await handleAddExpense(message);
        }
        
        // ==================== SHOW TASKS ====================
        else if (lowerMessage.includes('show tasks') || lowerMessage.includes('list tasks') || lowerMessage.includes('my tasks')) {
            await handleShowTasks();
        }
        
        // ==================== SHOW SUBJECTS ====================
        else if (lowerMessage.includes('show subjects') || lowerMessage.includes('list subjects') || lowerMessage.includes('my subjects')) {
            await handleShowSubjects();
        }
        
        // ==================== HELP ====================
        else if (lowerMessage.includes('help') || lowerMessage === 'what can you do') {
            showHelp();
        }
        else if (lowerMessage.includes('hi') || lowerMessage === 'hello') {
            showHelp();
        }
        // ==================== UNKNOWN COMMAND ====================
        else {
            addMessageToChat(
                `I'm not sure what you mean. Try commands like:<br>
                • "Add task [name] on [date]"<br>
                • "Create subject [name]"<br>
                • "Add event [name] at [time]"<br>
                • "Show my tasks"<br>
                Type "help" for more examples.`,
                'ai'
            );
        }

    } catch (error) {
        console.error('AI Command Error:', error);
        addMessageToChat('❌ Sorry, something went wrong. Please try again.', 'ai');
    }
}

// ==================== HANDLE ADD TASK ====================
async function handleAddTask(message) {
    try {
        // Extract task name and date
        const taskMatch = message.match(/(?:add|create|new)\s+task\s+(.+?)(?:\s+(?:on|for|by)\s+(.+))?$/i);
        
        if (!taskMatch) {
            addMessageToChat('Please specify a task. Example: "Add task study for exam on Friday"', 'ai');
            return;
        }

        const taskName = taskMatch[1].replace(/\s+(?:on|for|by)\s+.+$/i, '').trim();
        const dateText = taskMatch[2];

        // Parse date
        let taskDate = '';
        if (dateText) {
            taskDate = parseDate(dateText);
        }

        // Get subjects for categorization
        const subjects = await window.DataManager.getSubjects();
        let subjectId = null;
        let subjectName = 'No Subject';

        // Try to match subject from task name
        for (const subject of subjects) {
            if (taskName.toLowerCase().includes(subject.name.toLowerCase())) {
                subjectId = subject.id;
                subjectName = subject.name;
                break;
            }
        }

        // Create task
        const taskData = {
            title: taskName,
            priority: 'medium',
            date: taskDate,
            subjectId: subjectId,
            subjectName: subjectName,
            completed: false
        };

        const taskId = await window.DataManager.addTask(taskData);

        // Create calendar event if date is set
        if (taskDate) {
            await window.DataManager.addCalendarEvent({
                title: `📋 ${taskName}`,
                date: taskDate,
                time: '23:59',
                description: `Task deadline - ${subjectName}`,
                type: 'task',
                taskId: taskId
            });
        }

        // Reload tasks
        if (typeof loadTasks === 'function') {
            loadTasks();
        }
        if (typeof loadCalendarEvents === 'function') {
            loadCalendarEvents();
        }

        // Response
        let response = `✅ Task created: "${taskName}"`;
        if (taskDate) response += `<br>📅 Due: ${new Date(taskDate).toLocaleDateString()}`;
        if (subjectId) response += `<br>📚 Subject: ${subjectName}`;
        
        addMessageToChat(response, 'ai');

    } catch (error) {
        console.error('Add task error:', error);
        addMessageToChat('❌ Failed to create task. Please try again.', 'ai');
    }
}

// ==================== HANDLE ADD SUBJECT ====================
async function handleAddSubject(message) {
    try {
        const subjectMatch = message.match(/(?:add|create|new)\s+subject\s+(.+)$/i);
        
        if (!subjectMatch) {
            addMessageToChat('Please specify a subject name. Example: "Create subject Mathematics"', 'ai');
            return;
        }

        const subjectName = subjectMatch[1].trim();

        // Random color
        const colors = ['#FF3B30', '#34C759', '#007AFF', '#AF52DE', '#FFCC00', '#1d1d1f'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const subjectData = {
            name: subjectName,
            color: randomColor,
            notes: [],
            createdAt: new Date().toISOString()
        };

        await window.DataManager.addSubject(subjectData);

        // Reload subjects
        if (typeof st_loadData === 'function') {
            st_loadData();
        }
        if (typeof loadTasks === 'function') {
            loadTasks();
        }

        addMessageToChat(`✅ Subject created: "${subjectName}" 📚`, 'ai');

    } catch (error) {
        console.error('Add subject error:', error);
        addMessageToChat('❌ Failed to create subject. Please try again.', 'ai');
    }
}

// ==================== HANDLE ADD EVENT ====================
async function handleAddEvent(message) {
    try {
        // Extract event name, date, and time
        const eventMatch = message.match(/(?:add|create|schedule)\s+event\s+(.+?)(?:\s+(?:at|on)\s+(.+))?$/i);
        
        if (!eventMatch) {
            addMessageToChat('Please specify an event. Example: "Add event team meeting at 3pm today"', 'ai');
            return;
        }

        const eventName = eventMatch[1].replace(/\s+(?:at|on)\s+.+$/i, '').trim();
        const dateTimeText = eventMatch[2];

        let eventDate = '';
        let eventTime = '12:00';

        if (dateTimeText) {
            // Extract time
            const timeMatch = dateTimeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = timeMatch[2] || '00';
                const meridiem = timeMatch[3];

                if (meridiem && meridiem.toLowerCase() === 'pm' && hours < 12) {
                    hours += 12;
                } else if (meridiem && meridiem.toLowerCase() === 'am' && hours === 12) {
                    hours = 0;
                }

                eventTime = `${String(hours).padStart(2, '0')}:${minutes}`;
            }

            // Extract date
            eventDate = parseDate(dateTimeText);
        }

        if (!eventDate) {
            eventDate = new Date().toISOString().split('T')[0];
        }

        const eventData = {
            title: eventName,
            date: eventDate,
            time: eventTime,
            description: 'Created by AI Assistant',
            type: 'manual'
        };

        await window.DataManager.addCalendarEvent(eventData);

        if (typeof loadCalendarEvents === 'function') {
            loadCalendarEvents();
        }

        addMessageToChat(
            `✅ Event created: "${eventName}"<br>📅 ${new Date(eventDate).toLocaleDateString()} at ${eventTime}`,
            'ai'
        );

    } catch (error) {
        console.error('Add event error:', error);
        addMessageToChat('❌ Failed to create event. Please try again.', 'ai');
    }
}

// ==================== HANDLE ADD HABIT ====================
async function handleAddHabit(message) {
    try {
        const habitMatch = message.match(/(?:add|create|new)\s+habit\s+(.+)$/i);
        
        if (!habitMatch) {
            addMessageToChat('Please specify a habit. Example: "Add habit read 30 minutes daily"', 'ai');
            return;
        }

        const habitName = habitMatch[1].trim();

        const habitData = {
            name: habitName,
            category: 'growth',
            frequency: 'daily'
        };

        await window.DataManager.addHabit(habitData);

        // Reload habits
        if (typeof yu27_load_stored_data === 'function') {
            yu27_load_stored_data();
        }

        addMessageToChat(`✅ Habit created: "${habitName}" 🎯`, 'ai');

    } catch (error) {
        console.error('Add habit error:', error);
        addMessageToChat('❌ Failed to create habit. Please try again.', 'ai');
    }
}

// ==================== HANDLE ADD EXPENSE ====================
async function handleAddExpense(message) {
    try {
        // Extract amount and description
        const amountMatch = message.match(/(\d+(?:\.\d{2})?)/);
        const descMatch = message.match(/(?:expense|spent)\s+(?:on\s+)?(.+?)(?:\s+(?:for|of)\s+\d+)?/i);

        if (!amountMatch) {
            addMessageToChat('Please specify an amount. Example: "Add expense lunch for 500"', 'ai');
            return;
        }

        const amount = amountMatch[1];
        const description = descMatch ? descMatch[1].replace(/\d+(?:\.\d{2})?/, '').trim() : 'Expense';

        const expenseData = {
            title: description,
            description: '',
            amount: amount,
            category: 'other'
        };

        await window.DataManager.addExpense(expenseData);

        if (typeof loadExpenses === 'function') {
            loadExpenses();
        }

        addMessageToChat(`✅ Expense added: ${description} - PKR ${amount}`, 'ai');

    } catch (error) {
        console.error('Add expense error:', error);
        addMessageToChat('❌ Failed to add expense. Please try again.', 'ai');
    }
}

// ==================== HANDLE SHOW TASKS ====================
async function handleShowTasks() {
    try {
        const tasks = await window.DataManager.getTasks();
        const pendingTasks = tasks.filter(t => !t.completed);

        if (pendingTasks.length === 0) {
            addMessageToChat('🎉 You have no pending tasks!', 'ai');
            return;
        }

        let response = `📋 You have ${pendingTasks.length} pending task(s):<br><ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">`;
        
        pendingTasks.slice(0, 5).forEach(task => {
            response += `<li>${task.title}`;
            if (task.date) {
                response += ` <span style="color: #666;">(Due: ${new Date(task.date).toLocaleDateString()})</span>`;
            }
            response += `</li>`;
        });
        
        response += '</ul>';
        
        if (pendingTasks.length > 5) {
            response += `<div style="font-size: 12px; color: #666; margin-top: 8px;">...and ${pendingTasks.length - 5} more</div>`;
        }

        addMessageToChat(response, 'ai');

    } catch (error) {
        console.error('Show tasks error:', error);
        addMessageToChat('❌ Failed to load tasks.', 'ai');
    }
}

// ==================== HANDLE SHOW SUBJECTS ====================
async function handleShowSubjects() {
    try {
        const subjects = await window.DataManager.getSubjects();

        if (subjects.length === 0) {
            addMessageToChat('📚 You have no subjects yet.', 'ai');
            return;
        }

        let response = `📚 You have ${subjects.length} subject(s):<br><ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">`;
        
        subjects.forEach(subject => {
            response += `<li><span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${subject.color}; margin-right: 6px;"></span>${subject.name}</li>`;
        });
        
        response += '</ul>';

        addMessageToChat(response, 'ai');

    } catch (error) {
        console.error('Show subjects error:', error);
        addMessageToChat('❌ Failed to load subjects.', 'ai');
    }
}

// ==================== SHOW HELP ====================
function showHelp() {
    const helpMessage = `
        <div style="font-size: 13px;">
            <strong>Hello</strong><br><br>
            <strong>I can help you with:</strong><br><br>
            
            <strong>📋 Tasks:</strong><br>
            • "Add task study chemistry on Friday"<br>
            • "Create task review notes tomorrow"<br>
            • "Show my tasks"<br><br>
            
            <strong>📚 Subjects:</strong><br>
            • "Create subject Mathematics"<br>
            • "Add subject Biology"<br>
            • "Show my subjects"<br><br>
            
            <strong>📅 Events:</strong><br>
            • "Add event team meeting at 3pm today"<br>
            • "Schedule class at 10am tomorrow"<br><br>
            
            <strong>🎯 Habits:</strong><br>
            • "Add habit read 30 minutes daily"<br>
            • "Create habit exercise every morning"<br><br>
            
            <strong>💰 Expenses:</strong><br>
            • "Add expense lunch for 500"<br>
            • "Spent 1200 on books"
        </div>
    `;
    
    addMessageToChat(helpMessage, 'ai');
}

// ==================== PARSE DATE ====================
function parseDate(dateText) {
    const today = new Date();
    const lower = dateText.toLowerCase();

    if (lower.includes('today')) {
        return today.toISOString().split('T')[0];
    }
    
    if (lower.includes('tomorrow')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    // Days of week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
        if (lower.includes(days[i])) {
            const targetDay = i;
            const currentDay = today.getDay();
            let daysToAdd = targetDay - currentDay;
            if (daysToAdd <= 0) daysToAdd += 7;
            
            const date = new Date(today);
            date.setDate(date.getDate() + daysToAdd);
            return date.toISOString().split('T')[0];
        }
    }

    // Try to parse as actual date
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return '';
}

// Expose functions globally
window.toggleAIAssistant = toggleAIAssistant;
window.sendAIMessage = sendAIMessage;
window.quickCommand = quickCommand;