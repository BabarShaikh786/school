// Global Search System
// Add this to a new file: script/search.js

const GlobalSearch = {
    searchInput: null,
    searchResults: null,
    isSearching: false,

    init() {
        // Get search input from topbar
        this.searchInput = document.querySelector('.search input');
        
        if (!this.searchInput) {
            console.error('Search input not found');
            return;
        }

        // Create search results container
        this.createSearchResults();

        // Add event listeners
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value) {
                this.searchResults.classList.add('show');
            }
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search')) {
                this.searchResults.classList.remove('show');
            }
        });
    },

    createSearchResults() {
        // Create results container
        const resultsHTML = `
            <div class="global-search-results" id="globalSearchResults">
                <div class="search-results-content">
                    <div class="search-loading" id="searchLoading">
                        <i class='bx bx-loader-alt bx-spin'></i> Searching...
                    </div>
                    <div class="search-results-list" id="searchResultsList"></div>
                </div>
            </div>
        `;

        const searchContainer = document.querySelector('.search');
        searchContainer.style.position = 'relative';
        searchContainer.insertAdjacentHTML('beforeend', resultsHTML);

        this.searchResults = document.getElementById('globalSearchResults');
    },

    async handleSearch(query) {
        if (!query || query.length < 2) {
            this.searchResults.classList.remove('show');
            return;
        }

        this.searchResults.classList.add('show');
        document.getElementById('searchLoading').style.display = 'block';
        document.getElementById('searchResultsList').innerHTML = '';

        try {
            const results = await DataManager.searchAll(query);
            this.displayResults(results, query);
        } catch (error) {
            console.error('Search error:', error);
            document.getElementById('searchResultsList').innerHTML = 
                '<div class="search-error">Search failed. Please try again.</div>';
        } finally {
            document.getElementById('searchLoading').style.display = 'none';
        }
    },

    displayResults(results, query) {
        const resultsList = document.getElementById('searchResultsList');
        
        let hasResults = false;
        let html = '';

        // Tasks
        if (results.tasks.length > 0) {
            hasResults = true;
            html += '<div class="search-category">Tasks</div>';
            results.tasks.forEach(task => {
                const icon = task.completed ? '✓' : '○';
                const subjectBadge = task.subjectName 
                    ? `<span class="search-badge">${task.subjectName}</span>`
                    : '';
                html += `
                    <div class="search-result-item" onclick="GlobalSearch.navigateTo('tasks', '${task.id}')">
                        <div class="search-result-icon">${icon}</div>
                        <div class="search-result-info">
                            <div class="search-result-title">${this.highlight(task.title, query)}</div>
                            <div class="search-result-meta">
                                Task ${subjectBadge}
                                ${task.date ? `<span class="search-date">Due: ${new Date(task.date).toLocaleDateString()}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        // Subjects
        if (results.subjects.length > 0) {
            hasResults = true;
            html += '<div class="search-category">Subjects</div>';
            results.subjects.forEach(subject => {
                html += `
                    <div class="search-result-item" onclick="GlobalSearch.navigateTo('subjects', '${subject.id}')">
                        <div class="search-result-icon" style="background:${subject.color}20; color:${subject.color}">📚</div>
                        <div class="search-result-info">
                            <div class="search-result-title">${this.highlight(subject.name, query)}</div>
                            <div class="search-result-meta">Subject</div>
                        </div>
                    </div>
                `;
            });
        }

        // Documents
        if (results.documents.length > 0) {
            hasResults = true;
            html += '<div class="search-category">Documents</div>';
            results.documents.slice(0, 5).forEach(doc => {
                const subjectBadge = doc.subjectName 
                    ? `<span class="search-badge">${doc.subjectName}</span>`
                    : '';
                html += `
                    <div class="search-result-item" onclick="GlobalSearch.navigateTo('ai', '${doc.id}')">
                        <div class="search-result-icon">📄</div>
                        <div class="search-result-info">
                            <div class="search-result-title">${this.highlight(doc.title, query)}</div>
                            <div class="search-result-meta">Document ${subjectBadge}</div>
                        </div>
                    </div>
                `;
            });
        }

        // Notes
        if (results.notes.length > 0) {
            hasResults = true;
            html += '<div class="search-category">Notes</div>';
            results.notes.slice(0, 5).forEach(note => {
                html += `
                    <div class="search-result-item" onclick="GlobalSearch.navigateTo('subjects', '${note.subjectId}', ${note.noteIndex})">
                        <div class="search-result-icon">📝</div>
                        <div class="search-result-info">
                            <div class="search-result-title">${this.highlight(note.title, query)}</div>
                            <div class="search-result-meta">
                                Note in <span class="search-badge">${note.subjectName}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        // Events
        if (results.events.length > 0) {
            hasResults = true;
            html += '<div class="search-category">Calendar Events</div>';
            results.events.slice(0, 5).forEach(event => {
                html += `
                    <div class="search-result-item" onclick="GlobalSearch.navigateTo('calendar', '${event.id}')">
                        <div class="search-result-icon">📅</div>
                        <div class="search-result-info">
                            <div class="search-result-title">${this.highlight(event.title, query)}</div>
                            <div class="search-result-meta">Event</div>
                        </div>
                    </div>
                `;
            });
        }

        if (!hasResults) {
            html = '<div class="search-no-results">No results found for "' + query + '"</div>';
        }

        resultsList.innerHTML = html;
    },

    highlight(text, query) {
        if (!text) return '';
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },

    navigateTo(section, id, noteIndex) {
        // Hide search results
        this.searchResults.classList.remove('show');
        this.searchInput.value = '';

        // Navigate to section
        const navButton = document.querySelector(`.nav button[data-target="${section}"]`);
        if (navButton) {
            navButton.click();
        }

        // Handle specific navigation
        setTimeout(() => {
            if (section === 'subjects' && id) {
                const subjectIndex = DataManager.subjectsCache.findIndex(s => s.id === id);
                if (subjectIndex !== -1) {
                    st_loadSub(subjectIndex);
                    if (noteIndex !== undefined) {
                        st_setTab('notes');
                        setTimeout(() => st_pickNote(noteIndex), 100);
                    }
                }
            } else if (section === 'ai' && id) {
                openDocumentEditor(id);
            } else if (section === 'tasks' && id) {
                // Highlight the task
                const taskEl = document.querySelector(`.task-item [onclick*="${id}"]`);
                if (taskEl) {
                    taskEl.closest('.task-item').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    taskEl.closest('.task-item').style.background = '#fff3cd';
                    setTimeout(() => {
                        taskEl.closest('.task-item').style.background = '';
                    }, 2000);
                }
            }
        }, 100);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            setTimeout(() => {
                GlobalSearch.init();
            }, 1500);
        }
    });
});

window.GlobalSearch = GlobalSearch;