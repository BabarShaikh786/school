// ========================================
// EXPENSES MODULE - Firebase Version
// ========================================

const categories = [
    { id: 'food', name: 'Food & Drinks', icon: '🍽️', color: '#FFE4CC' },
    { id: 'transport', name: 'Transport', icon: '🚌', color: '#CCE5FF' },
    { id: 'books', name: 'Books & Supplies', icon: '📚', color: '#CCF5E8' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#E8CCFF' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#FFCCF2' },
    { id: 'other', name: 'Other', icon: '📦', color: '#E8E8E8' }
];

let selectedCategory = '';
let expenses = [];
let budget = 0;

// Load data from Firebase
async function loadData() {
    try {
        // Wait for DataManager
        if (!window.DataManager || !window.DataManager.userId) {
            setTimeout(loadData, 500);
            return;
        }

        console.log('💰 Loading expenses from Firebase...');

        // Get expenses
        expenses = await window.DataManager.getExpenses();
        
        // Get budget
        budget = await window.DataManager.getBudget();

        console.log('✅ Expenses loaded:', expenses.length);
        console.log('💵 Budget:', budget);

        updateStats();
        renderExpenses();
        renderCategories();

    } catch (error) {
        console.error('Error loading expenses:', error);
        expenses = [];
        budget = 0;
        updateStats();
        renderExpenses();
        renderCategories();
    }
}

function formatCurrency(amount) {
    return `PKR ${parseFloat(amount).toFixed(2)}`;
}

function getRelativeDate(dateStr) {
    let date;
    
    // Handle Firestore timestamp
    if (dateStr && dateStr.toDate) {
        date = dateStr.toDate();
    } else {
        date = new Date(dateStr);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(date);
    expDate.setHours(0, 0, 0, 0);
    
    const diffTime = today - expDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function updateStats() {
    const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const remaining = budget - total;
    const percent = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;

    const totalSpentEl = document.getElementById('totalSpent');
    const budgetAmountEl = document.getElementById('budgetAmount');
    const remainingAmountEl = document.getElementById('remainingAmount');
    const budgetPercentEl = document.getElementById('budgetPercent');
    const progressFillEl = document.getElementById('progressFill');

    if (totalSpentEl) totalSpentEl.textContent = formatCurrency(total);
    if (budgetAmountEl) budgetAmountEl.textContent = formatCurrency(budget);
    if (remainingAmountEl) remainingAmountEl.textContent = formatCurrency(remaining);
    if (budgetPercentEl) budgetPercentEl.textContent = `${Math.round(percent)}%`;
    if (progressFillEl) progressFillEl.style.width = `${percent}%`;

    if (remainingAmountEl) {
        if (remaining < 0) {
            remainingAmountEl.style.color = '#e74c3c';
            const subtextEl = document.querySelector('.stat-subtext');
            if (subtextEl) subtextEl.textContent = 'Over budget';
        } else {
            remainingAmountEl.style.color = '#27ae60';
            const subtextEl = document.querySelector('.stat-subtext');
            if (subtextEl) subtextEl.textContent = 'Under budget';
        }
    }

    // Update home page count
    updateHomeExpenseCount();
}

function updateHomeExpenseCount() {
    const expenseCard = document.querySelector('#home .card[data-target="expenses"]');
    if (expenseCard) {
        const countEl = expenseCard.querySelector('.count');
        if (countEl) {
            countEl.textContent = expenses.length;
        }
    }
}

function renderExpenses() {
    const list = document.getElementById('expenseList');
    if (!list) return;
    
    if (expenses.length === 0) {
        list.innerHTML = '<div class="empty-state">No expenses yet. Click "Add Expense" to get started!</div>';
        return;
    }

    const sorted = [...expenses].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
    });
    
    list.innerHTML = sorted.map(exp => {
        const cat = categories.find(c => c.id === exp.category);
        return `
            <div class="expense-item">
                <div class="expense-icon" style="background: ${cat.color}">
                    ${cat.icon}
                </div>
                <div class="expense-details">
                    <div class="expense-title">${exp.title}</div>
                    <div class="expense-date">${getRelativeDate(exp.date)}</div>
                </div>
                <div class="expense-category" style="background: ${cat.color}; color: var(--text-primary);">
                    ${cat.name}
                </div>
                <div class="expense-amount">${formatCurrency(exp.amount)}</div>
                <button class="delete-btn" onclick="deleteExpense('${exp.id}')">Delete</button>
            </div>
        `;
    }).join('');
}

function renderCategories() {
    const categoryTotals = {};
    const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    categories.forEach(cat => {
        categoryTotals[cat.id] = expenses
            .filter(exp => exp.category === cat.id)
            .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    });

    const list = document.getElementById('categoryList');
    if (!list) return;

    list.innerHTML = categories.map(cat => {
        const amount = categoryTotals[cat.id];
        const percent = total > 0 ? (amount / total) * 100 : 0;
        
        return `
            <div class="category-item">
                <div class="category-info">
                    <div class="category-icon-small" style="background: ${cat.color}">
                        ${cat.icon}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${cat.name}</div>
                        <div class="category-bar">
                            <div class="category-bar-fill" style="width: ${percent}%; background: ${cat.color}"></div>
                        </div>
                    </div>
                </div>
                <div style="font-weight: 700; color: var(--text-primary);">${formatCurrency(amount)}</div>
            </div>
        `;
    }).join('');
}

function openExpenseModal() {
    selectedCategory = '';
    const modal = document.getElementById('expenseModal');
    const form = document.getElementById('expenseForm');
    
    if (modal) modal.classList.add('active');
    if (form) form.reset();
    
    renderCategoryOptions();
}

function closeExpenseModal() {
    const modal = document.getElementById('expenseModal');
    if (modal) modal.classList.remove('active');
}

function renderCategoryOptions() {
    const grid = document.getElementById('categoryOptions');
    if (!grid) return;

    grid.innerHTML = categories.map(cat => `
        <div class="category-option ${selectedCategory === cat.id ? 'selected' : ''}" 
             onclick="selectCategory('${cat.id}')" style="background: ${cat.color}">
            <div class="category-option-icon">${cat.icon}</div>
            <div class="category-option-label">${cat.name}</div>
        </div>
    `).join('');
}

function selectCategory(catId) {
    selectedCategory = catId;
    renderCategoryOptions();
}

function openBudgetModal() {
    const modal = document.getElementById('budgetModal');
    const input = document.getElementById('budgetInput');
    
    if (modal) modal.classList.add('active');
    if (input) input.value = budget;
}

function closeBudgetModal() {
    const modal = document.getElementById('budgetModal');
    if (modal) modal.classList.remove('active');
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        await window.DataManager.deleteExpense(id);
        await loadData();
        console.log('✅ Expense deleted');
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Failed to delete expense');
    }
}

// Initialize form listeners
function initializeExpenseListeners() {
    const expenseForm = document.getElementById('expenseForm');
    const budgetForm = document.getElementById('budgetForm');

    if (expenseForm) {
        expenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!selectedCategory) {
                alert('Please select a category');
                return;
            }

            const titleInput = document.getElementById('expenseTitle');
            const descInput = document.getElementById('expenseDescription');
            const amountInput = document.getElementById('expenseAmount');

            if (!titleInput || !amountInput) return;

            const expense = {
                title: titleInput.value,
                description: descInput ? descInput.value : '',
                amount: amountInput.value,
                category: selectedCategory
            };

            try {
                await window.DataManager.addExpense(expense);
                await loadData();
                closeExpenseModal();
                console.log('✅ Expense added');
            } catch (error) {
                console.error('Error adding expense:', error);
                alert('Failed to add expense');
            }
        });
    }

    if (budgetForm) {
        budgetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const budgetInput = document.getElementById('budgetInput');
            if (!budgetInput) return;

            const newBudget = parseFloat(budgetInput.value);

            try {
                await window.DataManager.setBudget(newBudget);
                budget = newBudget;
                closeBudgetModal();
                updateStats();
                console.log('✅ Budget updated');
            } catch (error) {
                console.error('Error updating budget:', error);
                alert('Failed to update budget');
            }
        });
    }
}

// Initialize when authenticated
if (window.firebase && window.firebase.auth) {
    window.firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            setTimeout(() => {
                initializeExpenseListeners();
                loadData();
            }, 1000);
        }
    });
}

// Expose functions globally
window.openExpenseModal = openExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.selectCategory = selectCategory;
window.openBudgetModal = openBudgetModal;
window.closeBudgetModal = closeBudgetModal;
window.deleteExpense = deleteExpense;
window.loadExpenses = loadData;