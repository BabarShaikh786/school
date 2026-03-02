// Enhanced Centralized Data Manager with Subject Integration
// Save this as: script/dataManager.js (lowercase)

const DataManager = {
    userId: null,
    subjectsCache: [],
    tasksCache: [],
    
    // Initialize with current user
    init(user) {
        this.userId = user.uid;
        console.log('DataManager initialized for user:', user.email);
    },

    // Get user's collection reference
    getUserCollection(collectionName) {
        if (!this.userId) {
            throw new Error('User not authenticated');
        }
        return db.collection('users').doc(this.userId).collection(collectionName);
    },

    // ============ SUBJECTS ============
    async getSubjects() {
        try {
            const snapshot = await this.getUserCollection('subjects').get();
            // Filter out initialization documents
            this.subjectsCache = snapshot.docs
                .filter(doc => !doc.data().initialized)
                .map(doc => ({ id: doc.id, ...doc.data() }));
            return this.subjectsCache;
        } catch (error) {
            console.error('Error getting subjects:', error);
            this.subjectsCache = [];
            return [];
        }
    },

    async addSubject(subjectData) {
        try {
            const docRef = await this.getUserCollection('subjects').add({
                name: subjectData.name,
                color: subjectData.color,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                notes: subjectData.notes || [],
                docs: subjectData.docs || [],
                tasks: subjectData.tasks || []
            });
            await this.refreshSubjects();
            return docRef.id;
        } catch (error) {
            console.error('Error adding subject:', error);
            throw error;
        }
    },

    async updateSubject(subjectId, updates) {
        try {
            await this.getUserCollection('subjects').doc(subjectId).update(updates);
            await this.refreshSubjects();
        } catch (error) {
            console.error('Error updating subject:', error);
            throw error;
        }
    },

    async deleteSubject(subjectId) {
        try {
            // Also delete all tasks associated with this subject
            const tasks = await this.getTasks();
            const subjectTasks = tasks.filter(t => t.subjectId === subjectId);
            
            for (const task of subjectTasks) {
                await this.deleteTask(task.id);
            }
            
            await this.getUserCollection('subjects').doc(subjectId).delete();
            await this.refreshSubjects();
        } catch (error) {
            console.error('Error deleting subject:', error);
            throw error;
        }
    },

    async refreshSubjects() {
        await this.getSubjects();
        // Trigger UI update
        if (typeof st_renderNav === 'function') {
            st_renderNav();
        }
        // Update task category dropdown
        this.updateTaskCategoryDropdown();
    },

    // ============ TASKS (Enhanced with Subject Integration) ============
    async getTasks() {
        try {
            const snapshot = await this.getUserCollection('tasks').get();
            // Filter out initialization documents
            this.tasksCache = snapshot.docs
                .filter(doc => !doc.data().initialized)
                .map(doc => ({ id: doc.id, ...doc.data() }));
            return this.tasksCache;
        } catch (error) {
            console.error('Error getting tasks:', error);
            this.tasksCache = [];
            return [];
        }
    },

    async addTask(taskData) {
        try {
            const docRef = await this.getUserCollection('tasks').add({
                title: taskData.title,
                priority: taskData.priority || 'medium',
                date: taskData.date || null,
                category: taskData.category || 'Academic',
                subjectId: taskData.subjectId || null,
                subjectName: taskData.subjectName || null,
                completed: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // If task is linked to a subject, also add to subject's tasks array
            if (taskData.subjectId) {
                await this.addTaskToSubject(taskData.subjectId, {
                    text: taskData.title,
                    date: taskData.date,
                    done: false,
                    taskId: docRef.id
                });
            }
            
            await this.refreshTasks();
            return docRef.id;
        } catch (error) {
            console.error('Error adding task:', error);
            throw error;
        }
    },

    async updateTask(taskId, updates) {
        try {
            const task = this.tasksCache.find(t => t.id === taskId);
            
            // Handle subject change
            if (updates.subjectId !== undefined) {
                // Remove from old subject
                if (task && task.subjectId) {
                    await this.removeTaskFromSubject(task.subjectId, taskId);
                }
                
                // Add to new subject
                if (updates.subjectId) {
                    await this.addTaskToSubject(updates.subjectId, {
                        text: updates.title || task.title,
                        date: updates.date || task.date,
                        done: updates.completed || task.completed,
                        taskId: taskId
                    });
                }
            }
            
            await this.getUserCollection('tasks').doc(taskId).update(updates);
            await this.refreshTasks();
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    },

    async deleteTask(taskId) {
        try {
            const task = this.tasksCache.find(t => t.id === taskId);
            
            // Remove from subject if linked
            if (task && task.subjectId) {
                await this.removeTaskFromSubject(task.subjectId, taskId);
            }
            
            await this.getUserCollection('tasks').doc(taskId).delete();
            await this.refreshTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    },

    async refreshTasks() {
        await this.getTasks();
        // Trigger UI update
        if (typeof renderTasks === 'function') {
            renderTasks();
        }
    },

    // ============ SUBJECT TASK INTEGRATION ============
    async addTaskToSubject(subjectId, taskData) {
        try {
            const subject = this.subjectsCache.find(s => s.id === subjectId);
            if (!subject) return;
            
            const tasks = subject.tasks || [];
            tasks.push(taskData);
            
            await this.updateSubject(subjectId, { tasks });
        } catch (error) {
            console.error('Error adding task to subject:', error);
        }
    },

    async removeTaskFromSubject(subjectId, taskId) {
        try {
            const subject = this.subjectsCache.find(s => s.id === subjectId);
            if (!subject) return;
            
            const tasks = (subject.tasks || []).filter(t => t.taskId !== taskId);
            await this.updateSubject(subjectId, { tasks });
        } catch (error) {
            console.error('Error removing task from subject:', error);
        }
    },

    async updateTaskInSubject(subjectId, taskId, updates) {
        try {
            const subject = this.subjectsCache.find(s => s.id === subjectId);
            if (!subject) return;
            
            const tasks = subject.tasks || [];
            const taskIndex = tasks.findIndex(t => t.taskId === taskId);
            
            if (taskIndex !== -1) {
                tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
                await this.updateSubject(subjectId, { tasks });
            }
        } catch (error) {
            console.error('Error updating task in subject:', error);
        }
    },

    async toggleTaskInSubject(subjectId, taskIndex) {
        try {
            const subject = this.subjectsCache.find(s => s.id === subjectId);
            if (!subject || !subject.tasks || !subject.tasks[taskIndex]) return;
            
            const task = subject.tasks[taskIndex];
            task.done = !task.done;
            
            // Also update main task if linked
            if (task.taskId) {
                await this.updateTask(task.taskId, { completed: task.done });
            } else {
                await this.updateSubject(subjectId, { tasks: subject.tasks });
            }
        } catch (error) {
            console.error('Error toggling task in subject:', error);
        }
    },

    // ============ UI HELPERS ============
    updateTaskCategoryDropdown() {
        const dropdown = document.getElementById('taskCategory');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">No Subject</option>';
        
        this.subjectsCache.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            dropdown.appendChild(option);
        });
    },

    getSubjectById(subjectId) {
        return this.subjectsCache.find(s => s.id === subjectId);
    },

    getTasksBySubject(subjectId) {
        return this.tasksCache.filter(t => t.subjectId === subjectId);
    },

    // ============ CALENDAR EVENTS ============
    async getCalendarEvents() {
        try {
            const snapshot = await this.getUserCollection('calendar').get();
            return snapshot.docs
                .filter(doc => !doc.data().initialized)
                .map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting calendar events:', error);
            return [];
        }
    },

    async addCalendarEvent(eventData) {
        const docRef = await this.getUserCollection('calendar').add(eventData);
        return docRef.id;
    },

    async updateCalendarEvent(eventId, updates) {
        await this.getUserCollection('calendar').doc(eventId).update(updates);
    },

    async deleteCalendarEvent(eventId) {
        await this.getUserCollection('calendar').doc(eventId).delete();
    },

    // ============ DOCUMENTS ============
    async getDocuments() {
        try {
            const snapshot = await this.getUserCollection('documents')
                .orderBy('date', 'desc')
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting documents:', error);
            return [];
        }
    },

    async addDocument(docData) {
        const docRef = await this.getUserCollection('documents').add({
            ...docData,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            lastOpened: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    },

    async updateDocument(docId, updates) {
        await this.getUserCollection('documents').doc(docId).update({
            ...updates,
            lastOpened: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async deleteDocument(docId) {
        await this.getUserCollection('documents').doc(docId).delete();
    },

    // ============ EXPENSES ============
    async getExpenses() {
        try {
            const snapshot = await this.getUserCollection('expenses')
                .orderBy('date', 'desc')
                .get();
            return snapshot.docs
                .filter(doc => !doc.data().initialized)
                .map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting expenses:', error);
            return [];
        }
    },

    async addExpense(expenseData) {
        const docRef = await this.getUserCollection('expenses').add({
            ...expenseData,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    },

    async deleteExpense(expenseId) {
        await this.getUserCollection('expenses').doc(expenseId).delete();
    },

    async getBudget() {
        try {
            const doc = await db.collection('users').doc(this.userId)
                .collection('settings').doc('preferences').get();
            return doc.exists ? doc.data().budget || 0 : 0;
        } catch (error) {
            console.error('Error getting budget:', error);
            return 0;
        }
    },

    async setBudget(amount) {
        await db.collection('users').doc(this.userId)
            .collection('settings').doc('preferences')
            .set({ budget: amount }, { merge: true });
    },

    // ============ HABITS (Discipline Tracker) ============
    async getHabits() {
        try {
            const snapshot = await this.getUserCollection('habits').get();
            return snapshot.docs
                .filter(doc => !doc.data().initialized)
                .map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting habits:', error);
            return [];
        }
    },

    async addHabit(habitData) {
        const docRef = await this.getUserCollection('habits').add(habitData);
        return docRef.id;
    },

    async getCompletions() {
        try {
            const doc = await db.collection('users').doc(this.userId)
                .collection('settings').doc('habit_completions').get();
            return doc.exists ? doc.data() : {};
        } catch (error) {
            console.error('Error getting completions:', error);
            return {};
        }
    },

    async saveCompletions(completions) {
        await db.collection('users').doc(this.userId)
            .collection('settings').doc('habit_completions')
            .set(completions);
    },

    // ============ SEARCH ============
    async searchAll(query) {
        const lowerQuery = query.toLowerCase();
        const results = {
            tasks: [],
            subjects: [],
            documents: [],
            notes: [],
            events: []
        };

        const tasks = await this.getTasks();
        results.tasks = tasks.filter(t => 
            t.title && t.title.toLowerCase().includes(lowerQuery)
        );

        const subjects = await this.getSubjects();
        results.subjects = subjects.filter(s => 
            s.name && s.name.toLowerCase().includes(lowerQuery)
        );

        const docs = await this.getDocuments();
        results.documents = docs.filter(d => 
            (d.title && d.title.toLowerCase().includes(lowerQuery)) ||
            (d.content && d.content.toLowerCase().includes(lowerQuery))
        );

        subjects.forEach(subject => {
            if (subject.notes) {
                subject.notes.forEach((note, index) => {
                    if ((note.title && note.title.toLowerCase().includes(lowerQuery)) ||
                        (note.body && note.body.toLowerCase().includes(lowerQuery))) {
                        results.notes.push({
                            ...note,
                            subjectId: subject.id,
                            subjectName: subject.name,
                            noteIndex: index
                        });
                    }
                });
            }
        });

        const events = await this.getCalendarEvents();
        results.events = events.filter(e => 
            e.title && e.title.toLowerCase().includes(lowerQuery)
        );

        return results;
    }
};

// Initialize when user is authenticated
function initializeDataManager() {
    const user = firebase.auth().currentUser;
    if (user) {
        DataManager.init(user);
        
        // Load initial data
        DataManager.getSubjects().then(() => {
            console.log('Subjects loaded:', DataManager.subjectsCache.length);
        });
        
        DataManager.getTasks().then(() => {
            console.log('Tasks loaded:', DataManager.tasksCache.length);
        });
    }
}

// Make available globally
window.DataManager = DataManager;
window.initializeDataManager = initializeDataManager;
