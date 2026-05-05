const amountEl = document.getElementById("amount");
const dateEl = document.getElementById("expense_date");
const noteEl = document.getElementById("note");
const expenseIdEl = document.getElementById("expense_id");
const saveBtnEl = document.getElementById("save_btn");
const cancelEditBtnEl = document.getElementById("cancel_edit_btn");
const monthPickerEl = document.getElementById("month_picker");
const monthlyTotalEl = document.getElementById("monthly_total");
const allTimeTotalEl = document.getElementById("all_time_total");
const historyListEl = document.getElementById("history_list");
const historyMonthEl = document.getElementById("history_month");
const clearHistoryFilterEl = document.getElementById("clear_history_filter");
const statusEl = document.getElementById("status");
const formEl = document.getElementById("expense-form");

const now = new Date();
const localISODate = now.toISOString().slice(0, 10);
const currentMonth = localISODate.slice(0, 7);
dateEl.value = localISODate;
monthPickerEl.value = currentMonth;
historyMonthEl.value = "";

const showStatus = (message, isError = false) => {
    statusEl.textContent = message;
    statusEl.className = isError ? "error" : "";
};

const resetForm = () => {
    expenseIdEl.value = "";
    amountEl.value = "";
    noteEl.value = "";
    dateEl.value = localISODate;
    saveBtnEl.textContent = "Add Daily Expense";
    cancelEditBtnEl.classList.add("hidden");
};

const renderHistory = (expenses) => {
    if (!expenses.length) {
        historyListEl.innerHTML = '<p class="empty">No expenses yet.</p>';
        return;
    }

    historyListEl.innerHTML = expenses
        .map(
            (expense) => `
            <article class="history-item">
                <div>
                    <p class="amount">Rs ${Number(expense.amount).toFixed(2)}</p>
                    <p class="meta">${expense.expense_date}${expense.note ? ` - ${expense.note}` : ""}</p>
                </div>
                <div class="history-actions">
                    <button class="edit-btn" data-id="${expense.id}" data-amount="${expense.amount}" data-date="${expense.expense_date}" data-note="${expense.note}" type="button">Edit</button>
                    <button class="delete-btn" data-id="${expense.id}" type="button">Delete</button>
                </div>
            </article>
            `
        )
        .join("");
};

const loadHistory = async () => {
    const monthFilter = historyMonthEl.value;
    const url = monthFilter ? `/api/expenses?month=${monthFilter}` : "/api/expenses";
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to load history.");
    allTimeTotalEl.textContent = Number(data.total_expenses).toFixed(2);
    renderHistory(data.expenses);
};

const loadMonthlyTotal = async () => {
    try {
        const month = monthPickerEl.value;
        const res = await fetch(`/api/monthly-total?month=${month}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to fetch total.");
        monthlyTotalEl.textContent = Number(data.total).toFixed(2);
    } catch (err) {
        showStatus(err.message, true);
    }
};

formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isEditing = Boolean(expenseIdEl.value);
    showStatus(isEditing ? "Updating..." : "Saving...");
    try {
        const payload = {
            amount: amountEl.value,
            expense_date: dateEl.value,
            note: noteEl.value
        };

        const res = await fetch(isEditing ? `/api/expenses/${expenseIdEl.value}` : "/api/expenses", {
            method: isEditing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Could not ${isEditing ? "update" : "save"}.`);

        resetForm();
        await loadMonthlyTotal();
        await loadHistory();
        showStatus(isEditing ? "Expense updated." : "Expense saved and monthly total updated.");
    } catch (err) {
        showStatus(err.message, true);
    }
});

historyListEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn) {
        expenseIdEl.value = editBtn.dataset.id || "";
        amountEl.value = editBtn.dataset.amount || "";
        dateEl.value = editBtn.dataset.date || localISODate;
        noteEl.value = editBtn.dataset.note || "";
        saveBtnEl.textContent = "Update Expense";
        cancelEditBtnEl.classList.remove("hidden");
        showStatus("Edit mode enabled. Update the values and save.");
        return;
    }

    const deleteBtn = e.target.closest(".delete-btn");
    if (!deleteBtn) return;

    const expenseId = deleteBtn.dataset.id;
    if (!expenseId) return;

    showStatus("Deleting...");
    try {
        const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not delete expense.");
        await loadMonthlyTotal();
        await loadHistory();
        showStatus("Expense deleted.");
    } catch (err) {
        showStatus(err.message, true);
    }
});

cancelEditBtnEl.addEventListener("click", () => {
    resetForm();
    showStatus("Edit cancelled.");
});

monthPickerEl.addEventListener("change", loadMonthlyTotal);
historyMonthEl.addEventListener("change", () => {
    loadHistory().catch((err) => showStatus(err.message, true));
});
clearHistoryFilterEl.addEventListener("click", () => {
    historyMonthEl.value = "";
    loadHistory().catch((err) => showStatus(err.message, true));
});

loadHistory().catch((err) => showStatus(err.message, true));
loadMonthlyTotal();
