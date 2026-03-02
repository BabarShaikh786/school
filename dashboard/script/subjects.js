// ========================================
// SUBJECTS MODULE - Complete Rewrite
// ========================================

let st_data = [];
let st_curSub = null;
let st_curTab = 'notes';
let st_curNote = 0;
let st_selCol = '#007AFF';
const st_colors = ['#FF3B30', '#34C759', '#007AFF', '#AF52DE', '#FFCC00', '#1d1d1f'];

// ========================================
// LOAD SUBJECTS FROM FIREBASE
// ========================================
async function st_loadData() {
    console.log('📚 Loading subjects from Firebase...');
    
    try {
        // Wait for DataManager to be ready
        if (!window.DataManager || !window.DataManager.userId) {
            console.log('⏳ DataManager not ready, waiting...');
            setTimeout(st_loadData, 200);
            return;
        }

        // Get subjects from Firebase
        const subjectsFromDB = await window.DataManager.getSubjects();
        
        console.log('✅ Subjects fetched from Firebase:', subjectsFromDB);
        console.log('📊 Total subjects count:', subjectsFromDB.length);
        
        // Store in local array
        st_data = subjectsFromDB;
        
        // Render navigation
        st_renderNav();
        
        // Update task categories if tasks module is loaded
        if (typeof loadTasks === 'function') {
            console.log('🔄 Updating task categories...');
            loadTasks();
        }
        
    } catch (error) {
        console.error('❌ Error loading subjects:', error);
        st_data = [];
        st_renderNav();
    }
}

// ========================================
// RENDER SUBJECT NAVIGATION
// ========================================
function st_renderNav() {
    const container = document.getElementById('st-subject-container');
    if (!container) {
        console.error('❌ Subject container not found');
        return;
    }

    console.log('🎨 Rendering subject navigation. Subjects:', st_data.length);

    // If no subjects, show empty state
    if (st_data.length === 0) {
        container.innerHTML = `
            <div style="padding: 15px; text-align: center;">
                <p style="color: #86868b; font-size: 12px;">No subjects yet</p>
                <p style="color: #86868b; font-size: 11px; margin-top: 5px;">Create your first subject below</p>
            </div>
        `;
        return;
    }

    // Render subject pills
    container.innerHTML = st_data.map((subject, index) => {
        const isActive = st_curSub === index;
        return `
            <div class="st-subject-pill ${isActive ? 'st-active' : ''}" 
                 onclick="st_loadSub(${index})"
                 data-subject-id="${subject.id}">
                <span class="st-dot" style="background: ${subject.color || '#007AFF'}"></span>
                <span>${subject.name}</span>
            </div>
        `;
    }).join('');

    console.log('✅ Subject navigation rendered');
}

// ========================================
// LOAD SUBJECT WORKSPACE
// ========================================
function st_loadSub(index) {
    console.log('📖 Loading subject at index:', index);
    
    if (index < 0 || index >= st_data.length) {
        console.error('❌ Invalid subject index:', index);
        return;
    }

    st_curSub = index;
    st_curNote = 0;
    st_curTab = 'notes';
    
    st_renderWorkspace();
}

// ========================================
// RENDER WORKSPACE
// ========================================
function st_renderWorkspace() {
    if (st_curSub === null || !st_data[st_curSub]) {
        console.error('❌ No subject selected or invalid subject');
        return;
    }

    const subject = st_data[st_curSub];
    const mainCanvas = document.getElementById('st-main-canvas');
    
    if (!mainCanvas) {
        console.error('❌ Main canvas not found');
        return;
    }

    console.log('🖼️ Rendering workspace for:', subject.name);

    mainCanvas.innerHTML = `
        <div class="st-canvas-head">
            <h2 style="font-size: 17px; font-weight: 600;">${subject.name}</h2>
            <button class="st-btn st-btn-red" onclick="st_deleteSub(${st_curSub})">
                Delete Subject
            </button>
        </div>
        <div class="st-canvas-tabs">
            <div class="st-tab-link ${st_curTab === 'notes' ? 'st-active' : ''}" 
                 onclick="st_setTab('notes')">
                Notes
            </div>
            <div class="st-tab-link ${st_curTab === 'docs' ? 'st-active' : ''}" 
                 onclick="st_setTab('docs')">
                Documents
            </div>
            <div class="st-tab-link ${st_curTab === 'tasks' ? 'st-active' : ''}" 
                 onclick="st_setTab('tasks')">
                Tasks
            </div>
        </div>
        <div id="st-tab-engine" style="flex: 1; overflow: hidden;"></div>
    `;

    st_renderTab();
}

// ========================================
// SET TAB
// ========================================
function st_setTab(tabName) {
    console.log('📑 Switching to tab:', tabName);
    st_curTab = tabName;
    st_renderWorkspace();
}

// ========================================
// RENDER TAB CONTENT
// ========================================
async function st_renderTab() {
    const engine = document.getElementById('st-tab-engine');
    if (!engine || st_curSub === null || !st_data[st_curSub]) {
        return;
    }

    const subject = st_data[st_curSub];
    console.log('🔧 Rendering tab:', st_curTab, 'for subject:', subject.name);

    // === NOTES TAB ===
    if (st_curTab === 'notes') {
        renderNotesTab(engine, subject);
    }
    
    // === DOCUMENTS TAB ===
    else if (st_curTab === 'docs') {
        await renderDocsTab(engine, subject);
    }
    
    // === TASKS TAB ===
    else if (st_curTab === 'tasks') {
        await renderTasksTab(engine, subject);
    }
}

// ========================================
// RENDER NOTES TAB
// ========================================
function renderNotesTab(engine, subject) {
    // Ensure notes array exists
    if (!subject.notes) {
        subject.notes = [];
    }

    engine.className = 'st-notes-split';
    engine.innerHTML = `
        <div class="st-notes-sidebar">
            <button class="st-btn st-btn-blue" 
                    style="width: 100%; margin-bottom: 10px" 
                    onclick="st_addNote()">
                + New Note
            </button>
            ${subject.notes.map((note, index) => `
                <div class="st-note-entry ${st_curNote === index ? 'st-active' : ''}" 
                     onclick="st_pickNote(${index})">
                    ${note.title || 'Untitled Note'}
                </div>
            `).join('')}
        </div>
        <div class="st-editor-zone">
            ${subject.notes.length > 0 && subject.notes[st_curNote] ? `
                <div class="st-editor-bar">
                    <button class="st-btn st-btn-gray" 
                            onclick="document.getElementById('st-photo-upload-${st_curSub}').click()">
                        📷 Add Photo
                    </button>
                    <input type="file" 
                           id="st-photo-upload-${st_curSub}" 
                           hidden 
                           accept="image/*" 
                           onchange="st_handlePhoto(this)">
                    <button class="st-btn st-btn-red" 
                            onclick="st_deleteNote(${st_curNote})"
                            style="margin-left: auto;">
                        🗑️ Delete Note
                    </button>
                </div>
                <input type="text" 
                       class="st-editor-title" 
                       value="${subject.notes[st_curNote].title || ''}" 
                       placeholder="Note Title" 
                       oninput="st_saveNote()">
                <div id="st-rich-canvas" 
                     contenteditable="true" 
                     class="st-rich-area" 
                     oninput="st_saveNote()">${subject.notes[st_curNote].body || ''}</div>
            ` : `
                <div style="padding: 40px; text-align: center; color: #999;">
                    <p>Create a note to get started</p>
                </div>
            `}
        </div>
    `;
}
// ========================================
// RENDER DOCUMENTS TAB
// ========================================
// ========================================
// RENDER DOCUMENTS TAB
// ========================================
async function renderDocsTab(engine, subject) {
    try {
        // Get all documents from Documents & AI tab
        const allCreatedDocs = await window.DataManager.getDocuments();
        
        // Filter documents saved to this subject
        const savedDocs = allCreatedDocs.filter(doc => doc.subjectId === subject.id);
        
        // Get uploaded documents from subject data
        const uploadedDocs = subject.docs || [];
        
        console.log('📄 Saved documents:', savedDocs.length);
        console.log('📎 Uploaded documents:', uploadedDocs.length);

        engine.innerHTML = `
            <div class="st-content-wrapper">
                <!-- Upload Section -->
                <div style="margin-bottom: 30px;">
                    <button class="st-btn st-btn-blue" 
                            onclick="document.getElementById('st-doc-upload-${st_curSub}').click()">
                        📤 Upload Document
                    </button>
                    <input type="file" 
                           id="st-doc-upload-${st_curSub}" 
                           hidden 
                           accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" 
                           onchange="st_handleDocUpload(this)">
                    <p style="color: #86868b; font-size: 11px; margin-top: 8px;">
                        Upload PDFs, Word docs, images, or text files
                    </p>
                </div>

                <!-- Uploaded Documents Section -->
                ${uploadedDocs.length > 0 ? `
                    <div style="margin-bottom: 30px;">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 15px; color: var(--text-primary);">
                            Uploaded Files (${uploadedDocs.length})
                        </h3>
                        <div>
                            ${uploadedDocs.map((doc, index) => `
                                <div class="st-list-row">
                                    <div class="st-row-info">
                                        <b>${doc.name}</b><br>
                                        <small style="color: var(--st-text-light)">
                                            ${doc.size} • Uploaded ${doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString() : 'Recently'}
                                        </small>
                                    </div>
                                    <div class="st-row-actions">
                                        <button class="st-btn st-btn-gray" 
                                                onclick="st_viewUploadedDoc(${index})">
                                            View
                                        </button>
                                        <button class="st-btn st-btn-gray" 
                                                onclick="st_downloadUploadedDoc(${index})">
                                            Download
                                        </button>
                                        <button class="st-btn st-btn-red" 
                                                onclick="st_deleteUploadedDoc(${index})">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Documents from Documents & AI Tab -->
                ${savedDocs.length > 0 ? `
                    <div>
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 15px; color: var(--text-primary);">
                            Documents from Documents Tab (${savedDocs.length})
                        </h3>
                        <p style="color: #86868b; font-size: 11px; margin-bottom: 15px;">
                            Documents created in the Documents tab and saved to this subject
                        </p>
                        <div>
                            ${savedDocs.map(doc => {
                                const docDate = doc.date ? 
                                    (doc.date.toDate ? doc.date.toDate() : new Date(doc.date)) : 
                                    new Date();
                                
                                return `
                                    <div class="st-list-row">
                                        <div class="st-row-info">
                                            <b>${doc.title || 'Untitled Document'}</b><br>
                                            <small style="color: var(--st-text-light)">
                                                Created ${docDate.toLocaleDateString()}
                                            </small>
                                        </div>
                                        <div class="st-row-actions">
                                            <button class="st-btn st-btn-gray" 
                                                    onclick="st_viewCreatedDoc('${doc.id}')">
                                                View
                                            </button>
                                            <button class="st-btn st-btn-red" 
                                                    onclick="st_removeDocFromSubject('${doc.id}')">
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Empty State -->
                ${uploadedDocs.length === 0 && savedDocs.length === 0 ? `
                    <div style="padding: 60px 20px; text-align: center;">
                        <p style="color: #999; font-size: 14px;">No documents yet</p>
                        <p style="color: #bbb; font-size: 12px; margin-top: 10px;">
                            Upload files or save documents from the Documents & AI tab
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        console.error('❌ Error rendering documents tab:', error);
        engine.innerHTML = `
            <div class="st-content-wrapper">
                <p style="color: #e74c3c; text-align: center; padding: 40px;">
                    Error loading documents
                </p>
            </div>
        `;
    }
}

// ========================================
// RENDER TASKS TAB
// ========================================
async function renderTasksTab(engine, subject) {
    try {
        // Get all tasks
        const allTasks = await window.DataManager.getTasks();
        
        // Filter tasks for this subject
        const subjectTasks = allTasks.filter(task => task.subjectId === subject.id);
        
        console.log('✅ Tasks for this subject:', subjectTasks.length);

        engine.innerHTML = `
            <div class="st-content-wrapper">
                <button class="st-btn st-btn-blue" 
                        onclick="st_openTaskModal()">
                    + Add Task
                </button>
                ${subjectTasks.length > 0 ? `
                    <div style="margin-top: 20px;">
                        ${subjectTasks.map(task => {
                            const dueDate = task.date ? 
                                new Date(task.date).toLocaleDateString() : 
                                'No due date';
                            
                            return `
                                <div class="st-list-row">
                                    <input type="checkbox" 
                                           ${task.completed ? 'checked' : ''} 
                                           onchange="st_toggleTask('${task.id}')" 
                                           style="margin-right: 12px; cursor: pointer;">
                                    <div class="st-row-info" 
                                         style="${task.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                                        <div style="font-weight: 500;">${task.title}</div>
                                        <small style="color: var(--st-text-light);">
                                            Due: ${dueDate}
                                        </small>
                                    </div>
                                    <div class="st-row-actions">
                                        <button class="st-btn st-btn-red" 
                                                onclick="st_deleteTask('${task.id}')">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div style="padding: 60px 20px; text-align: center;">
                        <p style="color: #999; font-size: 14px;">No tasks for this subject yet</p>
                        <p style="color: #bbb; font-size: 12px; margin-top: 10px;">
                            Click "Add Task" to create a task for this subject
                        </p>
                    </div>
                `}
            </div>
        `;
    } catch (error) {
        console.error('❌ Error rendering tasks tab:', error);
        engine.innerHTML = `
            <div class="st-content-wrapper">
                <p style="color: #e74c3c; text-align: center; padding: 40px;">
                    Error loading tasks
                </p>
            </div>
        `;
    }
}

// ========================================
// MODAL OPERATIONS
// ========================================

function st_openModal(type) {
    const modalWrap = document.getElementById('st-modal-wrap');
    const modalBody = document.getElementById('st-modal-body');
    
    if (!modalWrap || !modalBody) {
        console.error('❌ Modal elements not found');
        return;
    }

    modalWrap.style.display = 'flex';

    if (type === 'SUB') {
        st_openSubjectModal(modalBody);
    }
}

function st_openSubjectModal(modalBody) {
    modalBody.innerHTML = `
        <b style="font-size: 16px; display: block; margin-bottom: 20px;">Create New Subject</b>
        
        <label class="st-modal-label">SUBJECT NAME</label>
        <input type="text" 
               id="st-subject-name-input" 
               class="st-input-field" 
               placeholder="e.g. Mathematics, Biology, History..."
               autofocus>
        
        <label class="st-modal-label" style="margin-top: 15px;">COLOR THEME</label>
        <div class="st-color-row">
            ${st_colors.map(color => `
                <div class="st-color-circle ${st_selCol === color ? 'st-selected' : ''}" 
                     style="background: ${color};" 
                     onclick="st_selectColor('${color}')">
                </div>
            `).join('')}
        </div>
        
        <button class="st-btn st-btn-blue" 
                style="width: 100%; padding: 12px; margin-top: 20px;" 
                onclick="st_createSubject()">
            Create Subject
        </button>
        <button class="st-btn st-btn-gray" 
                style="width: 100%; margin-top: 10px;" 
                onclick="st_closeModal()">
            Cancel
        </button>
    `;

    // Focus the input after a brief delay
    setTimeout(() => {
        const input = document.getElementById('st-subject-name-input');
        if (input) input.focus();
    }, 100);
}

function st_openTaskModal() {
    const modalWrap = document.getElementById('st-modal-wrap');
    const modalBody = document.getElementById('st-modal-body');
    
    if (!modalWrap || !modalBody) return;

    modalWrap.style.display = 'flex';

    modalBody.innerHTML = `
        <b style="font-size: 16px; display: block; margin-bottom: 20px;">Create New Task</b>
        
        <label class="st-modal-label">TASK TITLE</label>
        <input type="text" 
               id="st-task-title-input" 
               class="st-input-field" 
               placeholder="What needs to be done?"
               autofocus>
        
        <label class="st-modal-label" style="margin-top: 15px;">DUE DATE (Optional)</label>
        <input type="date" 
               id="st-task-date-input" 
               class="st-input-field">
        
        <button class="st-btn st-btn-blue" 
                style="width: 100%; padding: 12px; margin-top: 20px;" 
                onclick="st_createTask()">
            Add Task
        </button>
        <button class="st-btn st-btn-gray" 
                style="width: 100%; margin-top: 10px;" 
                onclick="st_closeModal()">
            Cancel
        </button>
    `;

    setTimeout(() => {
        const input = document.getElementById('st-task-title-input');
        if (input) input.focus();
    }, 100);
}

function st_closeModal() {
    const modalWrap = document.getElementById('st-modal-wrap');
    if (modalWrap) {
        modalWrap.style.display = 'none';
    }
}

function st_selectColor(color) {
    st_selCol = color;
    st_openSubjectModal(document.getElementById('st-modal-body'));
}

// ========================================
// CREATE SUBJECT
// ========================================
async function st_createSubject() {
    const nameInput = document.getElementById('st-subject-name-input');
    
    if (!nameInput) {
        console.error('❌ Subject name input not found');
        return;
    }

    const subjectName = nameInput.value.trim();

    if (!subjectName) {
        alert('Please enter a subject name');
        return;
    }

    console.log('📝 Creating subject:', subjectName, 'with color:', st_selCol);

    try {
        const subjectData = {
            name: subjectName,
            color: st_selCol,
            notes: [],
            createdAt: new Date().toISOString()
        };

        const subjectId = await window.DataManager.addSubject(subjectData);
        console.log('✅ Subject created with ID:', subjectId);

        // Reload subjects
        await st_loadData();

        // Close modal
        st_closeModal();

        // Reset color selection
        st_selCol = '#007AFF';

    } catch (error) {
        console.error('❌ Error creating subject:', error);
        alert('Failed to create subject. Please try again.');
    }
}

// ========================================
// CREATE TASK
// ========================================
async function st_createTask() {
    const titleInput = document.getElementById('st-task-title-input');
    const dateInput = document.getElementById('st-task-date-input');
    
    if (!titleInput) {
        console.error('❌ Task title input not found');
        return;
    }

    const taskTitle = titleInput.value.trim();

    if (!taskTitle) {
        alert('Please enter a task title');
        return;
    }

    const taskDate = dateInput ? dateInput.value : '';
    const subject = st_data[st_curSub];

    console.log('✅ Creating task:', taskTitle, 'for subject:', subject.name);

    try {
        const taskData = {
            title: taskTitle,
            date: taskDate,
            subjectId: subject.id,
            subjectName: subject.name,
            priority: 'medium',
            completed: false
        };

        const taskId = await window.DataManager.addTask(taskData);
        console.log('✅ Task created with ID:', taskId);

        // Create calendar event if date is set
        if (taskDate) {
            await window.DataManager.addCalendarEvent({
                title: `📋 ${taskTitle}`,
                date: taskDate,
                time: '23:59',
                description: `Task deadline - ${subject.name}`,
                type: 'task',
                taskId: taskId
            });
            console.log('📅 Calendar event created');
        }

        // Close modal
        st_closeModal();

        // Refresh tasks tab
        st_renderTab();

        // Update main tasks list
        if (typeof loadTasks === 'function') {
            loadTasks();
        }

        // Update calendar
        if (typeof loadCalendarEvents === 'function') {
            loadCalendarEvents();
        }

    } catch (error) {
        console.error('❌ Error creating task:', error);
        alert('Failed to create task. Please try again.');
    }
}

// ========================================
// TOGGLE TASK
// ========================================
async function st_toggleTask(taskId) {
    try {
        const allTasks = await window.DataManager.getTasks();
        const task = allTasks.find(t => t.id === taskId);
        
        if (task) {
            await window.DataManager.updateTask(taskId, { 
                completed: !task.completed 
            });
            
            st_renderTab();
            
            if (typeof loadTasks === 'function') {
                loadTasks();
            }
        }
    } catch (error) {
        console.error('❌ Error toggling task:', error);
    }
}

// ========================================
// DELETE TASK
// ========================================
async function st_deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;

    try {
        await window.DataManager.deleteTask(taskId);
        
        // Delete associated calendar event
        const events = await window.DataManager.getCalendarEvents();
        const linkedEvent = events.find(e => e.taskId === taskId);
        if (linkedEvent) {
            await window.DataManager.deleteCalendarEvent(linkedEvent.id);
        }

        st_renderTab();
        
        if (typeof loadTasks === 'function') {
            loadTasks();
        }
        
        if (typeof loadCalendarEvents === 'function') {
            loadCalendarEvents();
        }

        console.log('✅ Task deleted');
    } catch (error) {
        console.error('❌ Error deleting task:', error);
        alert('Failed to delete task');
    }
}

// ========================================
// VIEW DOCUMENT
// ========================================
async function st_viewDoc(docId) {
    try {
        const allDocs = await window.DataManager.getDocuments();
        const doc = allDocs.find(d => d.id === docId);
        
        if (!doc) {
            alert('Document not found');
            return;
        }

        const viewer = document.getElementById('st-full-viewer');
        const viewLabel = document.getElementById('st-view-label');
        const viewCanvas = document.getElementById('st-view-canvas');
        
        if (viewLabel) viewLabel.textContent = doc.title || 'Untitled Document';
        if (viewCanvas) {
            viewCanvas.innerHTML = `
                <div style="max-width: 800px; padding: 20px; background: white; border-radius: 8px;">
                    ${doc.content || '<p>No content</p>'}
                </div>
            `;
        }
        if (viewer) viewer.style.display = 'flex';

    } catch (error) {
        console.error('❌ Error viewing document:', error);
        alert('Failed to load document');
    }
}

// ========================================
// REMOVE DOCUMENT FROM SUBJECT
// ========================================
async function st_removeDocFromSubject(docId) {
    if (!confirm('Remove this document from the subject? (It will still exist in Documents tab)')) {
        return;
    }

    try {
        await window.DataManager.updateDocument(docId, {
            subjectId: null,
            subjectName: null
        });

        st_renderTab();
        console.log('✅ Document removed from subject');
    } catch (error) {
        console.error('❌ Error removing document:', error);
        alert('Failed to remove document');
    }
}

// ========================================
// NOTES OPERATIONS
// ========================================

async function st_addNote() {
    if (st_curSub === null || !st_data[st_curSub]) return;

    const subject = st_data[st_curSub];

    if (!subject.notes) {
        subject.notes = [];
    }

    subject.notes.push({
        title: 'New Note',
        body: '',
        createdAt: new Date().toISOString()
    });

    st_curNote = subject.notes.length - 1;

    try {
        await window.DataManager.updateSubject(subject.id, {
            notes: subject.notes
        });

        st_renderTab();
        console.log('✅ Note created');
    } catch (error) {
        console.error('❌ Error creating note:', error);
    }
}

function st_pickNote(index) {
    st_curNote = index;
    st_renderTab();
}

async function st_saveNote() {
    if (st_curSub === null || !st_data[st_curSub]) return;

    const subject = st_data[st_curSub];
    const titleEl = document.querySelector('.st-editor-title');
    const canvasEl = document.getElementById('st-rich-canvas');

    if (!titleEl || !canvasEl) return;

    const title = titleEl.value;
    const body = canvasEl.innerHTML;

    if (!subject.notes) subject.notes = [];
    if (!subject.notes[st_curNote]) subject.notes[st_curNote] = {};

    subject.notes[st_curNote].title = title;
    subject.notes[st_curNote].body = body;

    try {
        await window.DataManager.updateSubject(subject.id, {
            notes: subject.notes
        });

        // Update sidebar
        const noteEntries = document.querySelectorAll('.st-note-entry');
        if (noteEntries[st_curNote]) {
            noteEntries[st_curNote].textContent = title || 'Untitled Note';
        }
    } catch (error) {
        console.error('❌ Error saving note:', error);
    }
}

function st_handlePhoto(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const canvas = document.getElementById('st-rich-canvas');
        if (canvas) {
            const img = `<img src="${e.target.result}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;">`;
            canvas.innerHTML += img;
            st_saveNote();
        }
    };
    reader.readAsDataURL(file);
}
// ========================================
// DELETE NOTE
// ========================================
async function st_deleteNote(noteIndex) {
    if (st_curSub === null || !st_data[st_curSub]) return;

    const subject = st_data[st_curSub];
    
    if (!subject.notes || !subject.notes[noteIndex]) return;

    const noteTitle = subject.notes[noteIndex].title || 'Untitled Note';
    
    if (!confirm(`Delete "${noteTitle}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        console.log('🗑️ Deleting note:', noteTitle);

        // Remove note from array
        subject.notes.splice(noteIndex, 1);

        // Update in Firebase
        await window.DataManager.updateSubject(subject.id, {
            notes: subject.notes
        });

        console.log('✅ Note deleted');

        // Reset to first note or show empty state
        if (subject.notes.length > 0) {
            st_curNote = Math.min(noteIndex, subject.notes.length - 1);
        } else {
            st_curNote = 0;
        }

        // Refresh the tab
        st_renderTab();

    } catch (error) {
        console.error('❌ Error deleting note:', error);
        alert('Failed to delete note. Please try again.');
    }
}
// ========================================
// DELETE SUBJECT
// ========================================
async function st_deleteSub(index) {
    if (index < 0 || index >= st_data.length) return;

    const subject = st_data[index];
    const confirmMsg = `Delete "${subject.name}"?\n\nThis will permanently delete:\n• All notes (${subject.notes?.length || 0})\n• All tasks for this subject\n\nDocuments will remain in the Documents tab.`;

    if (!confirm(confirmMsg)) return;

    try {
        console.log('🗑️ Deleting subject:', subject.name);

        // Delete all tasks for this subject
        const allTasks = await window.DataManager.getTasks();
        const subjectTasks = allTasks.filter(t => t.subjectId === subject.id);
        
        for (const task of subjectTasks) {
            await window.DataManager.deleteTask(task.id);
        }

        // Delete the subject
        await window.DataManager.deleteSubject(subject.id);

        console.log('✅ Subject deleted');

        // Reset state
        st_curSub = null;
        st_curNote = 0;

        // Reload subjects
        await st_loadData();

        // Show empty state
        const mainCanvas = document.getElementById('st-main-canvas');
        if (mainCanvas) {
            mainCanvas.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--st-text-light); text-align: center;">
                    <div>
                        <h2 style="margin-bottom: 10px;">Select a Subject</h2>
                        <p>Your notes and tasks are waiting.</p>
                    </div>
                </div>
            `;
        }

        // Update tasks list
        if (typeof loadTasks === 'function') {
            loadTasks();
        }

    } catch (error) {
        console.error('❌ Error deleting subject:', error);
        alert('Failed to delete subject');
    }
}

// ========================================
// CLOSE VIEWER
// ========================================
function st_closeViewer() {
    const viewer = document.getElementById('st-full-viewer');
    if (viewer) {
        viewer.style.display = 'none';
    }
}

// ========================================
// INITIALIZE
// ========================================
function st_initialize() {
    console.log('🚀 Initializing Subjects Module...');

    // Wait for authentication
    if (window.firebase && window.firebase.auth) {
        window.firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log('👤 User authenticated, loading subjects...');
                setTimeout(st_loadData, 600);
            }
        });
    } else {
        console.warn('⚠️ Firebase not loaded, retrying...');
        setTimeout(st_initialize, 500);
    }
}

// Start initialization
st_initialize();
// ========================================
// HANDLE DOCUMENT UPLOAD
// ========================================
async function st_handleDocUpload(input) {
    const file = input.files[0];
    if (!file) return;

    console.log('📤 Uploading document:', file.name);

    try {
        // Show loading indicator
        const uploadBtn = input.previousElementSibling;
        const originalText = uploadBtn.textContent;
        uploadBtn.textContent = '⏳ Uploading...';
        uploadBtn.disabled = true;

        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const subject = st_data[st_curSub];
            
            // Ensure docs array exists
            if (!subject.docs) {
                subject.docs = [];
            }

            // Create document object
            const newDoc = {
                name: file.name,
                size: formatFileSize(file.size),
                type: file.type,
                data: e.target.result,
                uploadDate: new Date().toISOString()
            };

            // Add to subject's docs array
            subject.docs.push(newDoc);

            // Update in Firebase
            await window.DataManager.updateSubject(subject.id, {
                docs: subject.docs
            });

            console.log('✅ Document uploaded successfully');

            // Reset button
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;
            input.value = '';

            // Refresh the tab to show new document
            st_renderTab();
        };

        reader.onerror = (error) => {
            console.error('❌ Error reading file:', error);
            alert('Failed to upload document');
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;
        };

        reader.readAsDataURL(file);

    } catch (error) {
        console.error('❌ Error uploading document:', error);
        alert('Failed to upload document');
    }
}

// ========================================
// FORMAT FILE SIZE
// ========================================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ========================================
// VIEW UPLOADED DOCUMENT
// ========================================
function st_viewUploadedDoc(index) {
    if (st_curSub === null || !st_data[st_curSub]) return;

    const subject = st_data[st_curSub];
    const doc = subject.docs[index];

    if (!doc) {
        alert('Document not found');
        return;
    }

    console.log('👁️ Viewing uploaded document:', doc.name);

    const viewer = document.getElementById('st-full-viewer');
    const viewLabel = document.getElementById('st-view-label');
    const viewCanvas = document.getElementById('st-view-canvas');

    if (!viewer || !viewLabel || !viewCanvas) {
        console.error('❌ Viewer elements not found');
        return;
    }

    // Set title
    viewLabel.textContent = doc.name;

    // Render based on file type
    if (doc.type.includes('image')) {
        // Image files
        viewCanvas.innerHTML = `
            <img src="${doc.data}" 
                 style="max-width: 100%; max-height: 80vh; border-radius: 8px;" 
                 alt="${doc.name}">
        `;
    } else if (doc.type === 'application/pdf') {
        // PDF files
        viewCanvas.innerHTML = `
            <iframe src="${doc.data}" 
                    style="width: 100%; height: 80vh; border: none; border-radius: 8px;">
            </iframe>
        `;
    } else if (doc.type.includes('text')) {
        // Text files
        fetch(doc.data)
            .then(response => response.text())
            .then(text => {
                viewCanvas.innerHTML = `
                    <div style="background: white; padding: 30px; border-radius: 8px; max-width: 800px; width: 100%;">
                        <pre style="white-space: pre-wrap; font-family: monospace; font-size: 14px;">${text}</pre>
                    </div>
                `;
            })
            .catch(error => {
                console.error('Error loading text:', error);
                viewCanvas.innerHTML = '<p style="color: #e74c3c;">Failed to load text content</p>';
            });
    } else {
        // Other file types - show download option
        viewCanvas.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 8px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                <h3 style="margin-bottom: 10px;">${doc.name}</h3>
                <p style="color: #666; margin-bottom: 20px;">Preview not available for this file type</p>
                <button class="st-btn st-btn-blue" onclick="st_downloadUploadedDoc(${index})">
                    Download File
                </button>
            </div>
        `;
    }

    // Show viewer
    viewer.style.display = 'flex';
}

// ========================================
// DOWNLOAD UPLOADED DOCUMENT
// ========================================
function st_downloadUploadedDoc(index) {
    if (st_curSub === null || !st_data[st_curSub]) return;

    const subject = st_data[st_curSub];
    const doc = subject.docs[index];

    if (!doc) {
        alert('Document not found');
        return;
    }

    console.log('⬇️ Downloading document:', doc.name);

    // Create download link
    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.name;
    a.click();
}

// ========================================
// DELETE UPLOADED DOCUMENT
// ========================================
async function st_deleteUploadedDoc(index) {
    if (st_curSub === null || !st_data[st_curSub]) return;

    const subject = st_data[st_curSub];
    const doc = subject.docs[index];

    if (!doc) return;

    if (!confirm(`Delete "${doc.name}"?`)) return;

    try {
        console.log('🗑️ Deleting uploaded document:', doc.name);

        // Remove from array
        subject.docs.splice(index, 1);

        // Update in Firebase
        await window.DataManager.updateSubject(subject.id, {
            docs: subject.docs
        });

        console.log('✅ Document deleted');

        // Refresh tab
        st_renderTab();

    } catch (error) {
        console.error('❌ Error deleting document:', error);
        alert('Failed to delete document');
    }
}

// ========================================
// VIEW CREATED DOCUMENT (from Documents & AI)
// ========================================
function st_viewCreatedDoc(docId) {
    console.log('👁️ Viewing created document:', docId);

    // Navigate to Documents & AI section
    const aiNavButton = document.querySelector('.nav button[data-target="ai"]');
    if (aiNavButton) {
        aiNavButton.click();
    }

    // Wait for section to load, then open the document
    setTimeout(() => {
        if (typeof openDocumentEditor === 'function') {
            openDocumentEditor(docId);
        } else {
            console.error('❌ openDocumentEditor function not found');
            alert('Unable to open document. Please go to Documents & AI tab manually.');
        }
    }, 300);
}
// ========================================
// EXPOSE FUNCTIONS GLOBALLY
// ========================================

// ========================================
// EXPOSE FUNCTIONS GLOBALLY
// ========================================
window.st_deleteNote = st_deleteNote;
window.st_loadData = st_loadData;
window.st_loadSub = st_loadSub;
window.st_setTab = st_setTab;
window.st_openModal = st_openModal;
window.st_openTaskModal = st_openTaskModal;
window.st_closeModal = st_closeModal;
window.st_selectColor = st_selectColor;
window.st_createSubject = st_createSubject;
window.st_createTask = st_createTask;
window.st_toggleTask = st_toggleTask;
window.st_deleteTask = st_deleteTask;
window.st_viewDoc = st_viewDoc;
window.st_removeDocFromSubject = st_removeDocFromSubject;
window.st_addNote = st_addNote;
window.st_pickNote = st_pickNote;
window.st_saveNote = st_saveNote;
window.st_handlePhoto = st_handlePhoto;
window.st_deleteSub = st_deleteSub;
window.st_closeViewer = st_closeViewer;
// NEW: Document functions
window.st_handleDocUpload = st_handleDocUpload;
window.st_viewUploadedDoc = st_viewUploadedDoc;
window.st_downloadUploadedDoc = st_downloadUploadedDoc;
window.st_deleteUploadedDoc = st_deleteUploadedDoc;
window.st_viewCreatedDoc = st_viewCreatedDoc;