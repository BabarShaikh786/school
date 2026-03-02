// Updated tasks.js with Firebase and Subject Integration
let tasks = [];
let currentFilter = 'all';
let selectedPriority = 'medium';
let editingTaskId = null;
let subjects = [];

// Load tasks from Firebase
async function loadTasks() {
    try {
        tasks = await DataManager.getTasks();
        subjects = await DataManager.getSubjects();
        updateCategoryDropdown();
        renderTasks();
        updateHomeStats();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Update category dropdown with subjects
function updateCategoryDropdown() {
    const dropdown = document.getElementById('taskCategory');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">No Subject</option>';
    
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        option.style.color = subject.color;
        dropdown.appendChild(option);
    });
}

// Toggle add form
function toggleAddForm() {
    const form = document.getElementById('addTaskForm');
    form.classList.toggle('active');
    if (!form.classList.contains('active')) {
        resetForm();
    }
}

// Reset form
function resetForm() {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDate').value = '';
    document.getElementById('taskCategory').value = '';
    selectedPriority = 'medium';
    editingTaskId = null;
    updatePriorityButtons();
}

// Add or update task
async function addTask() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;

    const date = document.getElementById('taskDate').value;
    const subjectId = document.getElementById('taskCategory').value;
    
    // Get subject name if subject is selected
    let subjectName = null;
    if (subjectId) {
        const subject = subjects.find(s => s.id === subjectId);
        subjectName = subject ? subject.name : null;
    }

    try {
        if (editingTaskId) {
            // Update existing task
            await DataManager.updateTask(editingTaskId, {
                title,
                priority: selectedPriority,
                date,
                subjectId: subjectId || null,
                subjectName: subjectName
            });
        } else {
            // Create new task
            await DataManager.addTask({
                title,
                priority: selectedPriority,
                date,
                subjectId: subjectId || null,
                subjectName: subjectName,
                category: 'Academic' // Legacy fallback
            });
        }

        await loadTasks();
        toggleAddForm();
    } catch (error) {
        console.error('Error saving task:', error);
        alert('Failed to save task. Please try again.');
    }
}

// Toggle task completion
async function toggleTask(id) {
    try {
        const task = tasks.find(t => t.id === id);
        if (task) {
            await DataManager.updateTask(id, {
                completed: !task.completed
            });
            await loadTasks();
        }
    } catch (error) {
        console.error('Error toggling task:', error);
    }
}

// Delete task
async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        await DataManager.deleteTask(id);
        await loadTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task. Please try again.');
    }
}

// Edit task
function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        editingTaskId = id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDate').value = task.date || '';
        document.getElementById('taskCategory').value = task.subjectId || '';
        selectedPriority = task.priority || 'medium';
        updatePriorityButtons();
        document.getElementById('addTaskForm').classList.add('active');
    }
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// Get subject color
function getSubjectColor(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.color : '#e0e0e0';
}

// Render tasks
function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;
    
    let filteredTasks = tasks;
    
    // Filter by subject
    if (currentFilter !== 'all') {
        filteredTasks = tasks.filter(t => {
            if (currentFilter === 'no-subject') {
                return !t.subjectId;
            }
            return t.subjectId === currentFilter;
        });
    }

    // Update stats
    const completed = tasks.filter(t => t.completed).length;
    const totalCount = document.getElementById('totalCount');
    const completedCount = document.getElementById('completedCount');
    if (totalCount) totalCount.textContent = tasks.length;
    if (completedCount) completedCount.textContent = completed;

    if (filteredTasks.length === 0) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <h3>No tasks yet</h3>
                <p>Add a task to get started</p>
            </div>
        `;
        return;
    }

    tasksList.innerHTML = filteredTasks.map(task => {
        const subjectBadge = task.subjectId 
            ? `<span class="task-subject-badge" style="background-color: ${getSubjectColor(task.subjectId)}20; color: ${getSubjectColor(task.subjectId)}; border: 1px solid ${getSubjectColor(task.subjectId)}">
                ${task.subjectName || 'Subject'}
               </span>`
            : '';
        
        return `
            <div class="task-item">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="toggleTask('${task.id}')"></div>
                <div class="task-content">
                    <div class="task-title ${task.completed ? 'completed' : ''}">${task.title}</div>
                    <div class="task-meta">
                        ${task.date ? `<span class="task-date">${formatDate(task.date)}</span>` : ''}
                        ${subjectBadge}
                        <span class="task-priority priority-${task.priority}">${task.priority}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="editTask('${task.id}')" title="Edit">✏️</button>
                    <button class="task-action-btn" onclick="deleteTask('${task.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// Update priority buttons
function updatePriorityButtons() {
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.priority === selectedPriority);
    });
}

// Update filter buttons with subjects
function updateFilterButtons() {
    const filtersContainer = document.querySelector('.filters');
    if (!filtersContainer) return;
    
    filtersContainer.innerHTML = `
        <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-btn ${currentFilter === 'no-subject' ? 'active' : ''}" data-filter="no-subject">No Subject</button>
        ${subjects.map(subject => `
            <button class="filter-btn ${currentFilter === subject.id ? 'active' : ''}" 
                    data-filter="${subject.id}"
                    style="border-left: 3px solid ${subject.color}">
                ${subject.name}
            </button>
        `).join('')}
    `;
    
    // Re-attach event listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderTasks();
        });
    });
}

// Update home stats
function updateHomeStats() {
    const taskCount = document.getElementById('taskCount');
    if (taskCount) {
        const today = new Date().toDateString();
        const todayTasks = tasks.filter(t => {
            if (!t.date) return false;
            return new Date(t.date).toDateString() === today;
        });
        taskCount.textContent = todayTasks.length;
    }
}

// Priority button click
document.addEventListener('DOMContentLoaded', function() {
    // Priority buttons
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectedPriority = this.dataset.priority;
            updatePriorityButtons();
        });
    });

    // Enter key to submit
    const taskTitle = document.getElementById('taskTitle');
    if (taskTitle) {
        taskTitle.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addTask();
            }
        });
    }
    
    // Initialize after Firebase auth
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            setTimeout(() => {
                loadTasks().then(() => {
                    updateFilterButtons();
                });
            }, 1000);
        }
    });
});

// Make functions globally available
window.toggleAddForm = toggleAddForm;
window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.editTask = editTask;
window.renderTasks = renderTasks;
window.loadTasks = loadTasks;