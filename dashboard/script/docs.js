// Complete rewrite - WORKING MULTI-PAGE PRINT
let documentsArray = [];
let activeDocumentId = null;
let autoSaveTimerInterval;
let selectedTableSize = { rows: 1, cols: 1 };

// Load documents from Firebase
async function loadAllDocuments() {
    try {
        documentsArray = await DataManager.getDocuments();
        displayDocuments();
    } catch (error) {
        console.error('Error loading documents:', error);
        documentsArray = [];
        displayDocuments();
    }
}

// Save document to Firebase
async function saveDocumentToStorage(doc) {
    try {
        const content = document.getElementById('editor-content-editable').innerHTML;
        
        if (doc.id && doc.id !== 'new') {
            await DataManager.updateDocument(doc.id, {
                title: doc.title,
                content: content,
                subjectId: doc.subjectId || null,
                subjectName: doc.subjectName || null
            });
        } else {
            const id = await DataManager.addDocument({
                title: doc.title,
                content: content,
                subjectId: doc.subjectId || null,
                subjectName: doc.subjectName || null
            });
            doc.id = id;
        }
    } catch (error) {
        console.error('Failed to save document:', error);
    }
}

// Delete document from Firebase
async function removeDocumentFromStorage(id) {
    try {
        await DataManager.deleteDocument(id);
    } catch (error) {
        console.error('Failed to delete document:', error);
    }
}

// Display documents grid
function displayDocuments() {
    const gridContainer = document.getElementById('documents-grid-display');
    const searchQuery = document.getElementById('library-search-input').value.toLowerCase();
    
    const filteredDocs = documentsArray.filter(d => {
        return d.title.toLowerCase().includes(searchQuery) || 
               d.content.toLowerCase().includes(searchQuery);
    });
    
    if (filteredDocs.length === 0) {
        gridContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No documents found. Create your first document!</div>';
        return;
    }
    
    gridContainer.innerHTML = filteredDocs.map(doc => {
        const subjectBadge = doc.subjectName 
            ? `<div style="font-size:11px; color:#1a73e8; margin-top:8px;">📚 ${doc.subjectName}</div>`
            : '';
        
        return `<div class="document-card-item" onclick="openDocumentEditor('${doc.id}')">
            <button class="delete-document-button" onclick="event.stopPropagation(); deleteDocument('${doc.id}')">
                <i class="fas fa-trash"></i>
            </button>
            <div class="document-title-text">${doc.title || 'Untitled'}</div>
            <div class="document-date-text">${new Date(doc.date.seconds * 1000).toLocaleDateString()}</div>
            ${subjectBadge}
        </div>`;
    }).join('');
}

// Create new document
function createNewDocument() {
    const newDoc = {
        id: 'new',
        title: 'Untitled Document',
        content: '',
        date: new Date(),
        subjectId: null,
        subjectName: null
    };
    documentsArray.unshift(newDoc);
    openDocumentEditor('new');
}

// Open document editor
function openDocumentEditor(id) {
    activeDocumentId = id;
    const doc = documentsArray.find(d => d.id === id);
    
    document.getElementById('docs-library-view').classList.add('display-none');
    document.getElementById('document-editor-view').style.display = 'flex';
    document.getElementById('current-document-name-input').value = doc.title;
    
    // Set content
    const editable = document.getElementById('editor-content-editable');
    editable.innerHTML = doc.content || '';
    
    // Focus editor
    setTimeout(() => {
        editable.focus();
    }, 100);
    
    // Set up event listeners
    setupEditorListeners();
    
    // Update subject selector
    updateSubjectSelector(doc.subjectId);
    
    startAutoSaveTimer();
}

// Setup editor event listeners
function setupEditorListeners() {
    const editable = document.getElementById('editor-content-editable');
    
    editable.addEventListener('input', () => {
        // Auto-save will handle this
    });
    
    editable.addEventListener('keyup', updateToolbarStates);
    editable.addEventListener('mouseup', updateToolbarStates);
}

// Update subject selector dropdown
function updateSubjectSelector(selectedSubjectId) {
    const toolbar = document.querySelector('.editor-toolbar-container');
    const existingSelector = document.getElementById('doc-subject-selector');
    if (existingSelector) existingSelector.remove();
    
    const subjects = DataManager.subjectsCache || [];
    
    const selectorHTML = `
        <div class="toolbar-divider-line"></div>
        <select class="toolbar-dropdown-select" id="doc-subject-selector" onchange="updateDocumentSubject(this.value)" title="Link to Subject">
            <option value="">No Subject</option>
            ${subjects.map(s => `<option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
    `;
    
    toolbar.insertAdjacentHTML('beforeend', selectorHTML);
}

// Update document subject
async function updateDocumentSubject(subjectId) {
    if (!activeDocumentId) return;
    
    const doc = documentsArray.find(d => d.id === activeDocumentId);
    if (!doc) return;
    
    const subject = DataManager.getSubjectById(subjectId);
    doc.subjectId = subjectId || null;
    doc.subjectName = subject ? subject.name : null;
    
    await saveDocumentToStorage(doc);
    showNotification('Document linked to ' + (subject ? subject.name : 'no subject'));
}

// Return to library
function returnToLibrary() {
    saveActiveDocument();
    stopAutoSaveTimer();
    
    document.getElementById('document-editor-view').style.display = 'none';
    document.getElementById('docs-library-view').classList.remove('display-none');
    activeDocumentId = null;
    
    loadAllDocuments();
}

// Save active document
function saveActiveDocument() {
    if (!activeDocumentId) return;
    
    const doc = documentsArray.find(d => d.id === activeDocumentId);
    if (doc) {
        doc.title = document.getElementById('current-document-name-input').value || 'Untitled Document';
        doc.content = document.getElementById('editor-content-editable').innerHTML;
        doc.date = new Date();
        saveDocumentToStorage(doc);
    }
}

// Delete document
async function deleteDocument(id) {
    if (confirm('Delete this document?')) {
        documentsArray = documentsArray.filter(d => d.id !== id);
        await removeDocumentFromStorage(id);
        displayDocuments();
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #323232;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// Execute command
function executeCommand(command, value) {
    document.execCommand(command, false, value || null);
    updateToolbarStates();
}

// Toggle formatting
function toggleFormatting(command) {
    executeCommand(command);
}

// Set font size
function setFontSize(size) {
    executeCommand('fontSize', '3');
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = size + 'pt';
        try {
            range.surroundContents(span);
        } catch (e) {
            console.log('Cannot apply font size');
        }
    }
}

// Update toolbar states
function updateToolbarStates() {
    document.getElementById('bold-format-button').classList.toggle('format-active', document.queryCommandState('bold'));
    document.getElementById('italic-format-button').classList.toggle('format-active', document.queryCommandState('italic'));
    document.getElementById('underline-format-button').classList.toggle('format-active', document.queryCommandState('underline'));
    document.getElementById('strikethrough-format-button').classList.toggle('format-active', document.queryCommandState('strikeThrough'));
}

// Print document - ENHANCED TO WORK PROPERLY
function printDocument() {
    // Create a clean print window
    const printWindow = window.open('', '', 'width=800,height=600');
    const content = document.getElementById('editor-content-editable').innerHTML;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Document</title>
            <style>
                @page {
                    size: letter;
                    margin: 1in;
                }
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    font-size: 11pt;
                    line-height: 1.6;
                    color: #000;
                }
                * {
                    box-sizing: border-box;
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// Auto-save timer
function startAutoSaveTimer() {
    autoSaveTimerInterval = setInterval(saveActiveDocument, 5000);
}

function stopAutoSaveTimer() {
    if (autoSaveTimerInterval) clearInterval(autoSaveTimerInterval);
}

// Image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = `<img src="${e.target.result}" style="max-width:100%;height:auto;">`;
            executeCommand('insertHTML', img);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

// Link panel
function toggleLinkPanel() {
    const panel = document.getElementById('link-insert-panel');
    const selection = window.getSelection();
    document.getElementById('link-text-input').value = selection.toString();
    document.getElementById('link-url-input').value = '';
    panel.classList.add('show');
    setTimeout(() => document.getElementById('link-url-input').focus(), 100);
}

function closeLinkPanel() {
    document.getElementById('link-insert-panel').classList.remove('show');
}

function insertLink() {
    const text = document.getElementById('link-text-input').value;
    const url = document.getElementById('link-url-input').value;
    if (url) {
        const link = `<a href="${url}" target="_blank" style="color:#1a73e8;text-decoration:underline;">${text || url}</a>`;
        executeCommand('insertHTML', link);
    }
    closeLinkPanel();
}

// Table panel
function toggleTablePanel() {
    selectedTableSize = { rows: 1, cols: 1 };
    createTableGrid();
    document.getElementById('table-insert-panel').classList.add('show');
}

function closeTablePanel() {
    document.getElementById('table-insert-panel').classList.remove('show');
}

function createTableGrid() {
    const grid = document.getElementById('table-size-grid');
    grid.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'table-cell-selector';
        cell.dataset.row = Math.floor(i / 10) + 1;
        cell.dataset.col = (i % 10) + 1;
        
        cell.addEventListener('mouseover', function() {
            selectedTableSize.rows = parseInt(this.dataset.row);
            selectedTableSize.cols = parseInt(this.dataset.col);
            updateTableSelection();
        });
        
        cell.addEventListener('click', () => insertTable());
        grid.appendChild(cell);
    }
}

function updateTableSelection() {
    document.querySelectorAll('.table-cell-selector').forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        cell.classList.toggle('selected', 
            row <= selectedTableSize.rows && col <= selectedTableSize.cols);
    });
    
    document.getElementById('table-size-display').textContent = 
        `Select table size (${selectedTableSize.rows} x ${selectedTableSize.cols})`;
}

function insertTable() {
    let html = '<table border="1" style="border-collapse:collapse;width:100%;margin:16px 0;">';
    for (let i = 0; i < selectedTableSize.rows; i++) {
        html += '<tr>';
        for (let j = 0; j < selectedTableSize.cols; j++) {
            html += '<td style="padding:8px;border:1px solid #ccc;min-width:100px;">&nbsp;</td>';
        }
        html += '</tr>';
    }
    html += '</table>';
    executeCommand('insertHTML', html);
    closeTablePanel();
}

// Event listeners
document.getElementById('library-search-input').addEventListener('input', displayDocuments);
document.getElementById('current-document-name-input').addEventListener('input', saveActiveDocument);

// Close panels on outside click
document.getElementById('link-insert-panel').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLinkPanel();
});

document.getElementById('table-insert-panel').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTablePanel();
});

// Enter key for links
['link-url-input', 'link-text-input'].forEach(id => {
    document.getElementById(id).addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            insertLink();
        }
    });
});

// Global exports
Object.assign(window, {
    createNewDocument,
    openDocumentEditor,
    returnToLibrary,
    deleteDocument,
    executeCommand,
    toggleFormatting,
    setFontSize,
    handleImageUpload,
    toggleLinkPanel,
    closeLinkPanel,
    insertLink,
    toggleTablePanel,
    closeTablePanel,
    insertTable,
    updateDocumentSubject,
    printDocument
});

// Initialize
firebase.auth().onAuthStateChanged(user => {
    if (user) setTimeout(loadAllDocuments, 1000);
});