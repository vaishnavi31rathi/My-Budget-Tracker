/* ========= Storage Keys ========= */
const TX_KEY = "bt_transactions_v1";
const BUDGET_KEY = "bt_budgets_v1";

/* ========= State ========= */
let transactions = JSON.parse(localStorage.getItem(TX_KEY) || "[]");
let budgets = JSON.parse(localStorage.getItem(BUDGET_KEY) || "[]");
const TARGET_DEFAULT = 1500;

/* ========= Element refs ========= */
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const balanceEl = document.getElementById("balance");

const qsIncomeEl = document.getElementById("qsIncome");
const qsExpenseEl = document.getElementById("qsExpense");
const qsBalanceEl = document.getElementById("qsBalance");
const qsTargetEl = document.getElementById("qsTarget");
const progressBarEl = document.getElementById("progressBar");

const form = document.getElementById("transactionForm");
const tbody = document.querySelector("#transactionTable tbody");

const filterType = document.getElementById("filterType");
const filterMonth = document.getElementById("filterMonth");
const filterCategory = document.getElementById("filterCategory");
const sortBy = document.getElementById("sortBy");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");
const exportBtn = document.getElementById("exportCSV");

/* Budgets */
const budgetForm = document.getElementById("budgetForm");
const budgetMonth = document.getElementById("budgetMonth");
const budgetCategory = document.getElementById("budgetCategory");
const budgetAmount = document.getElementById("budgetAmount");
const budgetsList = document.getElementById("budgetsList");

/* Charts contexts */
const incomeExpenseCtx = document.getElementById("incomeExpenseChart").getContext("2d");
const categoryCtx = document.getElementById("categoryChart").getContext("2d");
const trendCtx = document.getElementById("trendChart").getContext("2d");

/* ========= Charts (instances) ========= */
let incomeExpenseChart = new Chart(incomeExpenseCtx, {
  type: "bar",
  data: {
    labels: ["Income", "Expense"],
    datasets: [{ label: "Amount", data: [0,0], backgroundColor: ["#4caf50","#f44336"] }]
  },
  options: { responsive: true, plugins: { legend: { display:false } } }
});

let categoryChart = new Chart(categoryCtx, {
  type: "pie",
  data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
  options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
});

let trendChart = new Chart(trendCtx, {
  type: "line",
  data: { labels: [], datasets: [
    { label: "Income", data: [], borderColor: "#4caf50", fill: false, tension: 0.3 },
    { label: "Expense", data: [], borderColor: "#f44336", fill: false, tension: 0.3 }
  ]},
  options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
});

/* ========= Helpers ========= */
function save() {
  localStorage.setItem(TX_KEY, JSON.stringify(transactions));
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

function formatMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function uid() { return Math.random().toString(36).slice(2,9); }

/* ========= Transaction Add/Delete ========= */
form.addEventListener("submit", e => {
  e.preventDefault();
  const t = {
    id: uid(),
    type: document.getElementById("type").value,
    amount: parseFloat(document.getElementById("amount").value),
    date: document.getElementById("date").value,
    category: document.getElementById("category").value.trim(),
    notes: document.getElementById("notes").value.trim()
  };
  if (!t.amount || !t.date || !t.category) return alert("Fill amount, date, category");
  transactions.push(t);
  save();
  form.reset();
  render(); // full re-render
});

function deleteTransaction(id) {
  transactions = transactions.filter(t=>t.id !== id);
  save();
  render();
}

/* ========= Budgets: Add / Render / Remove ========= */
budgetForm.addEventListener("submit", e => {
  e.preventDefault();
  const b = {
    id: uid(),
    month: budgetMonth.value, // YYYY-MM
    category: budgetCategory.value.trim(),
    amount: parseFloat(budgetAmount.value)
  };
  if (!b.month || !b.category || !b.amount) return alert("Fill all budget fields");
  // replace existing budget for same month+category
  budgets = budgets.filter(x => !(x.month===b.month && x.category.toLowerCase()===b.category.toLowerCase()));
  budgets.push(b);
  save();
  budgetForm.reset();
  renderBudgets();
  render(); // update budgets progress
});

function removeBudget(id) {
  budgets = budgets.filter(b=>b.id !== id);
  save();
  renderBudgets();
  render();
}

function renderBudgets() {
  budgetsList.innerHTML = "";
  if (budgets.length === 0) {
    budgetsList.innerHTML = "<div style='color:#666'>No budgets set. Use the form above to add.</div>";
    return;
  }

  // show budgets sorted by month desc then category
  const sorted = budgets.slice().sort((a,b) => b.month.localeCompare(a.month) || a.category.localeCompare(b.category));
  sorted.forEach(b => {
    // compute spent for that month & category (expenses only)
    const spent = transactions
      .filter(t => t.type === "expense" && t.category.toLowerCase() === b.category.toLowerCase() && t.date.startsWith(b.month))
      .reduce((s, t) => s + t.amount, 0);

    const pct = Math.min(100, Math.round((spent / b.amount) * 100));
    const over = spent > b.amount;

    const row = document.createElement("div");
    row.className = "budget-row";
    row.innerHTML = `
      <div class="budget-meta">
        <strong>${b.category}</strong> — <small>${b.month}</small>
        <div style="color:${over? '#c62828' : '#333'}; font-size: 13px">
          Spent: ${formatMoney(spent)} / Budget: ${formatMoney(b.amount)}
        </div>
      </div>
      <div class="budget-progress" title="${pct}%">
        <div style="width:${pct}%; background:${over? '#ff6b6b' : 'linear-gradient(90deg,#4caf50,#8bc34a)'}">${pct}%</div>
      </div>
      <div><button onclick="removeBudget('${b.id}')">Remove</button></div>
    `;
    budgetsList.appendChild(row);
  });
}

/* ========= Filters / Sorting / CSV ========= */
function getFilteredSortedTx() {
  const type = filterType.value;
  const month = filterMonth.value;
  const cat = (filterCategory.value || "").trim().toLowerCase();
  const sort = sortBy.value;

  let list = transactions.slice();

  if (type !== "all") list = list.filter(t => t.type === type);
  if (month) list = list.filter(t => t.date.startsWith(month));
  if (cat) list = list.filter(t => t.category.toLowerCase().includes(cat));

  switch (sort) {
    case "date_asc": list.sort((a,b)=>a.date.localeCompare(b.date)); break;
    case "date_desc": list.sort((a,b)=>b.date.localeCompare(a.date)); break;
    case "amount_asc": list.sort((a,b)=>a.amount - b.amount); break;
    case "amount_desc": list.sort((a,b)=>b.amount - a.amount); break;
  }
  return list;
}

applyFiltersBtn.addEventListener("click", () => render());
resetFiltersBtn.addEventListener("click", () => {
  filterType.value = "all";
  filterMonth.value = "";
  filterCategory.value = "";
  sortBy.value = "date_desc";
  render();
});

exportBtn.addEventListener("click", () => {
  const list = getFilteredSortedTx();
  if (!list.length) return alert("No transactions to export.");
  const header = ["id","date","type","category","amount","notes"];
  const csvRows = [header.join(",")];
  list.forEach(r => {
    csvRows.push([r.id, r.date, r.type, `"${r.category.replace(/"/g,'""')}"`, r.amount, `"${(r.notes||'').replace(/"/g,'""')}"`].join(","));
  });
  const csv = csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ========= Rendering: Table, Summaries, Charts, Budgets ========= */
function renderTable(list) {
  tbody.innerHTML = "";
  list.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.type}</td>
      <td>${t.category}</td>
      <td>${formatMoney(t.amount)}</td>
      <td>${(t.notes||"")}</td>
      <td><button onclick="deleteTransaction('${t.id}')">❌</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateSummaries(listForSummary = null) {
  // default: use filtered list for visualizations; but totals show filtered (be consistent)
  const list = listForSummary || getFilteredSortedTx();

  const income = list.filter(t => t.type === "income").reduce((s,t)=>s+t.amount,0);
  const expense = list.filter(t => t.type === "expense").reduce((s,t)=>s+t.amount,0);
  const balance = income - expense;

  totalIncomeEl.textContent = formatMoney(income);
  totalExpenseEl.textContent = formatMoney(expense);
  balanceEl.textContent = formatMoney(balance);

  qsIncomeEl.textContent = formatMoney(income);
  qsExpenseEl.textContent = formatMoney(expense);
  qsBalanceEl.textContent = formatMoney(balance);

  // progress bar uses overall balance vs target (KEEP the same behavior)
  const target = parseFloat(qsTargetEl.textContent.replace("$", "")) || TARGET_DEFAULT;
  let pct = Math.round((balance / target) * 100);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  progressBarEl.style.width = pct + "%";
  progressBarEl.textContent = pct + "%";

  // Update Income vs Expense bar (use the list totals)
  incomeExpenseChart.data.datasets[0].data = [income, expense];
  incomeExpenseChart.update();

  // Update category pie (expenses only)
  const catTotals = {};
  list.forEach(t => {
    if (t.type === "expense") {
      const k = t.category || "Uncategorized";
      catTotals[k] = (catTotals[k] || 0) + t.amount;
    }
  });
  categoryChart.data.labels = Object.keys(catTotals);
  categoryChart.data.datasets[0].data = Object.values(catTotals);
  categoryChart.data.datasets[0].backgroundColor = Object.keys(catTotals).map((_,i) => [
    "#f44336","#ff9800","#ffc107","#4caf50","#2196f3","#9c27b0","#00bcd4","#795548"
  ][i % 8]);
  categoryChart.update();
}

function updateTrendChart() {
  // last 6 months labels (YYYY-MM)
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }

  const incomes = months.map(m => transactions.filter(t => t.type === "income" && t.date.startsWith(m)).reduce((s,t)=>s+t.amount,0));
  const expenses = months.map(m => transactions.filter(t => t.type === "expense" && t.date.startsWith(m)).reduce((s,t)=>s+t.amount,0));

  trendChart.data.labels = months.map(m => {
    const [y,mo] = m.split("-");
    return `${mo}/${y.slice(-2)}`;
  });
  trendChart.data.datasets[0].data = incomes;
  trendChart.data.datasets[1].data = expenses;
  trendChart.update();
}

/* ========= Main Render ========= */
function render() {
  // Use filtered+sorted list to render table and summaries so UI is consistent with filters
  const list = getFilteredSortedTx();
  renderTable(list);
  updateSummaries(list);
  renderBudgets();
  updateTrendChart();
}

/* ========= Init ========= */
(function init() {
  // Ensure default target displayed
  if (!qsTargetEl.textContent) qsTargetEl.textContent = `$${TARGET_DEFAULT}`;

  // If no transactions, keep arrays; else maintain previous state (already loaded)
  renderBudgets();
  render();
})();
