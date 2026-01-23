// ===== State =====
let token = localStorage.getItem("token") || null;
let categories = [];
let transactions = [];
let budget = { id: "1", amount: "0" };
let selectedMonth = null; // 選中的月份
let expenseChart = null; // 圖表實例

// ===== DOM Elements =====
const landingSection = document.getElementById("landing-section");
const loginSection = document.getElementById("login-section");
const mainSection = document.getElementById("main-section");
const goLoginBtn = document.getElementById("go-login-btn");
const backToLandingBtn = document.getElementById("back-to-landing");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const welcomeMsg = document.getElementById("welcome-msg");

const btnAddTransaction = document.getElementById("btn-add-transaction");
const btnManageCategory = document.getElementById("btn-manage-category");
const transactionList = document.getElementById("transaction-list");
const transactionListTitle = document.getElementById("transaction-list-title");

const totalIncome = document.getElementById("total-income");
const totalExpense = document.getElementById("total-expense");

const alanProxyAmount = document.getElementById("alan-proxy-amount");
const peiyaProxyAmount = document.getElementById("peiya-proxy-amount");
const settlementDiffMsg = document.getElementById("settlement-diff-msg");
const btnClearAllSettlements = document.getElementById("btn-clear-all-settlements");

const budgetSection = document.getElementById("budget-section");
const budgetRemaining = document.getElementById("budget-remaining");
const budgetProgressBar = document.getElementById("budget-progress-bar");
const totalBudget = document.getElementById("total-budget");
const budgetPercent = document.getElementById("budget-percent");
const chartContainer = document.getElementById("chart-container");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");

// ===== API Helper =====
async function api(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "請求失敗");
  }

  return data;
}

// ===== Auth =====
async function login(username, password) {
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  token = data.token;
  localStorage.setItem("token", token);
  localStorage.setItem("username", username.trim()); // Save trimmed username
  return data;
}

function logout() {
  token = null;
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  showLanding();
}

async function validateToken() {
  if (!token) return false;
  try {
    await api("/api/categories");
    return true;
  } catch (error) {
    token = null;
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    return false;
  }
}

// ===== Navigation =====
function showLanding() {
  landingSection.classList.remove("hidden");
  loginSection.classList.add("hidden");
  mainSection.classList.add("hidden");
}

function showLogin() {
  landingSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  mainSection.classList.add("hidden");
}

function showMain() {
  landingSection.classList.add("hidden");
  loginSection.classList.add("hidden");
  mainSection.classList.remove("hidden");
  
  const savedUsername = localStorage.getItem("username");
  if (savedUsername) {
    const formattedName = savedUsername.trim().charAt(0).toUpperCase() + savedUsername.trim().slice(1);
    welcomeMsg.textContent = `歡迎 ${formattedName}`;
  } else {
    welcomeMsg.textContent = "歡迎回來";
  }

  if (!selectedMonth) {
    initMonthSelector();
  }
  loadData();
}

// ===== Data Loading =====
async function loadData() {
  try {
    await Promise.all([loadCategories(), loadTransactions(), loadBudget()]);
    // 初始化月份選擇器
    if (!selectedMonth) {
      initMonthSelector();
    }
  } catch (error) {
    if (error.message.includes("token") || error.message.includes("未授權")) {
      logout();
    }
  }
}

async function loadCategories() {
  const data = await api("/api/categories");
  categories = data.data || [];
}

async function loadTransactions() {
  const data = await api("/api/transactions");
  transactions = data.data || [];
  renderTransactions();
  updateSummary();
}

async function loadBudget() {
  const data = await api("/api/budget");
  budget = data.data || { id: "1", amount: "0" };
  updateSummary();
}

// ===== 初始化月份選擇器 =====
function initMonthSelector() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  selectedMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  updateMonthDisplay();
}

// ===== 更新月份顯示 =====
function updateMonthDisplay() {
  if (!selectedMonth) return;
  
  const [year, month] = selectedMonth.split('-').map(Number);
  transactionListTitle.textContent = `${year}年${month}月收支`;
  
  // 更新按鈕狀態（不能選擇未來月份）
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const selectedDate = new Date(year, month - 1, 1);
  const currentDate = new Date(currentYear, currentMonth, 1);
  
  // 如果選中的月份是當月或未來，禁用下一個月按鈕
  nextMonthBtn.disabled = selectedDate >= currentDate;
}

// ===== 獲取指定月份的交易 =====
function getMonthlyTransactions(year, month) {
  return transactions.filter((txn) => {
    const txnDate = new Date(txn.date);
    return (
      txnDate.getMonth() === month &&
      txnDate.getFullYear() === year
    );
  });
}

// ===== 切換到上一個月 =====
function goToPrevMonth() {
  if (!selectedMonth) return;
  
  const [year, month] = selectedMonth.split('-').map(Number);
  const date = new Date(year, month - 2, 1); // month - 2 因為 month 是 1-based
  const newYear = date.getFullYear();
  const newMonth = date.getMonth() + 1;
  
  // 檢查是否超過 12 個月前的限制
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  if (date < twelveMonthsAgo) {
    return; // 不允許選擇超過 12 個月前
  }
  
  selectedMonth = `${newYear}-${String(newMonth).padStart(2, '0')}`;
  updateMonthDisplay();
  renderTransactions();
  updateSummary();
}

// ===== 切換到下一個月 =====
function goToNextMonth() {
  if (!selectedMonth) return;
  
  const [year, month] = selectedMonth.split('-').map(Number);
  const date = new Date(year, month, 1); // month 是 1-based，所以直接使用
  const newYear = date.getFullYear();
  const newMonth = date.getMonth() + 1;
  
  // 不允許選擇未來月份
  const now = new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
  if (date > currentDate) {
    return;
  }
  
  selectedMonth = `${newYear}-${String(newMonth).padStart(2, '0')}`;
  updateMonthDisplay();
  renderTransactions();
  updateSummary();
}

// ===== 開啟月份選擇 Modal =====
async function openMonthPickerModal() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // 生成過去 12 個月的選項
  const monthOptions = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthLabel = `${year}年${month + 1}月`;
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const isSelected = value === selectedMonth;
    
    monthOptions.push({
      label: monthLabel,
      value: value,
      selected: isSelected
    });
  }
  
  // 建立選項 HTML
  const optionsHtml = monthOptions
    .map(opt => `<option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.label}</option>`)
    .join('');
  
  const { value: selectedValue } = await Swal.fire({
    title: "選擇月份",
    html: `
      <select id="swal-month-picker" class="swal2-select" style="width: 100%; margin-top: 16px;">
        ${optionsHtml}
      </select>
    `,
    showCancelButton: true,
    confirmButtonText: "確定",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return document.getElementById("swal-month-picker").value;
    },
  });
  
  if (selectedValue && selectedValue !== selectedMonth) {
    selectedMonth = selectedValue;
    updateMonthDisplay();
    renderTransactions();
    updateSummary();
  }
}

// ===== Render Functions =====
function renderTransactions() {
  // 解析選中的年月
  if (!selectedMonth) {
    const now = new Date();
    selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  const [year, month] = selectedMonth.split('-').map(Number);
  const monthlyTransactions = getMonthlyTransactions(year, month - 1);
  
  if (monthlyTransactions.length === 0) {
    transactionList.innerHTML = `<div style="text-align:center; padding:20px; color:#9ca095;">
      🍃 ${year}年${month}月還沒有紀錄喔！
    </div>`;
    // 清空圖表
    if (expenseChart) {
      expenseChart.destroy();
      expenseChart = null;
    }
    chartContainer.style.display = 'none';
    return;
  }
  
  chartContainer.style.display = 'block';

  // 按 ID 排序（新的在前），如果 ID 相同才按日期
  const sorted = [...monthlyTransactions].sort((a, b) => {
    // 嘗試將 ID 轉為數字比較（處理 txn-timestamp 格式）
    const getIdNum = (id) => {
      const match = id.match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    };
    const idDiff = getIdNum(b.id) - getIdNum(a.id);
    if (idDiff !== 0) return idDiff;

    // ID 無法比較時，按日期排序
    return new Date(b.date) - new Date(a.date);
  });

  transactionList.innerHTML = sorted
    .map(
      (txn) => {
        const paidBy = (txn.paid_by || "").trim();
        // 判斷是否已補款：後端返回的是 "true" 或 "false" 字串
        // 後端會將 is_reimbursed 標準化為 "true" 或 "false" 字串
        const isReimbursedValue = txn.is_reimbursed;
        const isReimbursed = isReimbursedValue === true || 
                            isReimbursedValue === "true" || 
                            String(isReimbursedValue).trim().toLowerCase() === "true" ||
                            isReimbursedValue === 1 ||
                            String(isReimbursedValue) === "1";
        
        const hasPaidBy = paidBy === "Alan" || paidBy === "Peiya";
        
        // 建立代墊標籤 HTML
        // 已補款時不顯示任何標籤（不顯示代墊人標籤，也不顯示已補款標籤）
        // 只有未補款且有代墊人時才顯示標籤和補款按鈕
        let paidByBadge = "";
        const showPaidByInfo = hasPaidBy && !isReimbursed;
        if (showPaidByInfo) {
          paidByBadge = `<span class="paid-by-badge">${paidBy} 代墊</span>`;
        }

        return `
      <div class="transaction-item">
        <div class="left">
          <div class="category-icon" style="background-color: ${
            txn.category_color_hex || "#9E9E9E"
          }">
            ${txn.category_name.charAt(0)}
          </div>
          <div class="info">
            <span class="note">${txn.note || txn.category_name}${paidByBadge}</span>
            <span class="meta">${txn.date} · ${txn.category_name}</span>
          </div>
        </div>
        <div class="right">
          <span class="amount ${txn.type}">
            ${txn.type === "income" ? "+" : "-"}${Number(
        txn.amount
      ).toLocaleString()}
          </span>
          ${showPaidByInfo ? `<button class="reimburse-btn" onclick="window.markReimbursed('${txn.id}')" title="標記為已補款"><i class="ph ph-check"></i></button>` : ""}
          <button class="edit-btn" onclick="window.editTransaction('${
            txn.id
          }')"><i class="ph ph-pencil-simple"></i></button>
          <button class="delete-btn" onclick="window.deleteTransaction('${
            txn.id
          }')"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    `;
      }
    )
    .join("");
  
  // 渲染圖表
  renderExpenseChart(monthlyTransactions);
}

function updateSummary() {
  if (!selectedMonth) {
    const now = new Date();
    selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    updateMonthDisplay();
  }
  
  const [year, month] = selectedMonth.split('-').map(Number);

  const monthlyTransactions = getMonthlyTransactions(year, month - 1);

  const income = monthlyTransactions
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const expense = monthlyTransactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  totalIncome.textContent = income.toLocaleString();
  totalExpense.textContent = expense.toLocaleString();

  // 計算代墊統計 (只計算未補款的支出)
  const alanProxy = monthlyTransactions
    .filter((txn) => txn.type === "expense" && txn.paid_by === "Alan" && 
                     !(txn.is_reimbursed === true || txn.is_reimbursed === "true" || String(txn.is_reimbursed).toLowerCase() === "true"))
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const peiyaProxy = monthlyTransactions
    .filter((txn) => txn.type === "expense" && txn.paid_by === "Peiya" && 
                     !(txn.is_reimbursed === true || txn.is_reimbursed === "true" || String(txn.is_reimbursed).toLowerCase() === "true"))
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  alanProxyAmount.textContent = alanProxy.toLocaleString();
  peiyaProxyAmount.textContent = peiyaProxy.toLocaleString();

  // 計算差距
  if (alanProxy === 0 && peiyaProxy === 0) {
    settlementDiffMsg.textContent = "本月暫無未結清代墊款項";
  } else if (alanProxy === peiyaProxy) {
    settlementDiffMsg.textContent = "兩人代墊金額相等，暫時扯平！";
  } else if (alanProxy > peiyaProxy) {
    const diff = alanProxy - peiyaProxy;
    settlementDiffMsg.innerHTML = `Peiya 應付給 Alan <span class="income">$${diff.toLocaleString()}</span>`;
  } else {
    const diff = peiyaProxy - alanProxy;
    settlementDiffMsg.innerHTML = `Alan 應付給 Peiya <span class="income">$${diff.toLocaleString()}</span>`;
  }

  // Update Budget UI
  const budgetAmount = Number(budget.amount);
  const remaining = budgetAmount - expense;
  const percent =
    budgetAmount > 0 ? Math.round((remaining / budgetAmount) * 100) : 0;

  budgetRemaining.textContent = `$${remaining.toLocaleString()}`;
  totalBudget.textContent = `$${budgetAmount.toLocaleString()}`;
  budgetPercent.textContent = `${percent}%`;

  // Progress Bar
  let progressWidth = budgetAmount > 0 ? (remaining / budgetAmount) * 100 : 0;
  progressWidth = Math.max(0, Math.min(100, progressWidth)); // Clamp between 0-100
  budgetProgressBar.style.width = `${progressWidth}%`;

  // Colors
  budgetProgressBar.className = "progress-bar-fill"; // reset
  if (percent < 20) {
    budgetProgressBar.classList.add("danger");
  } else if (percent < 50) {
    budgetProgressBar.classList.add("warning");
  }
}

// ===== 渲染支出分類圖表 =====
function renderExpenseChart(monthlyTransactions) {
  // 只統計支出
  const expenses = monthlyTransactions.filter(txn => txn.type === 'expense');
  
  if (expenses.length === 0) {
    if (expenseChart) {
      expenseChart.destroy();
      expenseChart = null;
    }
    chartContainer.style.display = 'none';
    return;
  }
  
  // 按分類統計金額
  const categoryMap = {};
  expenses.forEach(txn => {
    const catId = txn.category_id;
    const catName = txn.category_name;
    const catColor = txn.category_color_hex || "#9E9E9E";
    
    if (!categoryMap[catId]) {
      categoryMap[catId] = {
        name: catName,
        color: catColor,
        amount: 0
      };
    }
    categoryMap[catId].amount += Number(txn.amount);
  });
  
  // 轉換為陣列並排序（金額由大到小）
  const chartData = Object.values(categoryMap)
    .sort((a, b) => b.amount - a.amount);
  
  const labels = chartData.map(item => item.name);
  const data = chartData.map(item => item.amount);
  const colors = chartData.map(item => item.color);
  
  const ctx = document.getElementById('expense-chart').getContext('2d');
  
  // 如果圖表已存在，先銷毀
  if (expenseChart) {
    expenseChart.destroy();
  }
  
  expenseChart = new Chart(ctx, {
    type: 'doughnut', // 圓餅圖
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            font: {
              family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Noto Sans TC", sans-serif',
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: $${value.toLocaleString()} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// ===== SweetAlert Flows =====

// 設定預算彈窗
async function openBudgetModal() {
  const { value: amount } = await Swal.fire({
    title: "設定每月總預算",
    input: "number",
    inputLabel: "請輸入金額",
    inputValue: budget.amount,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    inputValidator: (value) => {
      if (!value || Number(value) < 0) {
        return "請輸入有效的金額！";
      }
    },
  });

  if (amount) {
    Swal.fire({
      title: "儲存中...",
      text: "正在更新預算",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api("/api/budget", {
        method: "PUT",
        body: JSON.stringify({ amount }),
      });
      await loadBudget();
      Swal.fire("成功", "預算已更新！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

// 新增交易彈窗
async function openAddTransactionModal() {
  // 準備類別選項 HTML
  const categoryOptions = categories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join("");

  const today = new Date().toISOString().split("T")[0];

  const { value: formValues } = await Swal.fire({
    title: "記一筆",
    html: `
      <form id="swal-txn-form" class="swal-form">
        <div class="form-group">
          <label>項目名稱</label>
          <input type="text" id="swal-note" class="swal2-input" placeholder="例如：午餐、搭公車、買卡片" required autofocus>
        </div>
        <div class="form-group">
          <label>類別</label>
          <select id="swal-category" class="swal2-select">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label>金額</label>
          <input type="number" id="swal-amount" class="swal2-input" placeholder="多少錢？" min="1" required inputmode="numeric">
        </div>
        <div class="form-group">
          <label>收支</label>
          <select id="swal-type" class="swal2-select">
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input type="date" id="swal-date" class="swal2-input" value="${today}" required>
        </div>
        <div class="form-group">
          <label>代墊人（選填）</label>
          <select id="swal-paid-by" class="swal2-select">
            <option value="">無（無代墊）</option>
            <option value="Alan">Alan</option>
            <option value="Peiya">Peiya</option>
          </select>
        </div>
      </form>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "記帳！",
    cancelButtonText: "算了",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        date: document.getElementById("swal-date").value,
        type: document.getElementById("swal-type").value,
        category_id: document.getElementById("swal-category").value,
        amount: document.getElementById("swal-amount").value,
        note: document.getElementById("swal-note").value,
        paid_by: document.getElementById("swal-paid-by").value,
      };
    },
  });

  if (formValues) {
    if (!formValues.amount)
      return Swal.fire("哎呀！", "金額沒填喔！", "warning");

    // 顯示 loading
    Swal.fire({
      title: "處理中...",
      text: "正在儲存記帳資料",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await createTransaction(formValues);
      Swal.fire("成功！", "記帳完成！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

// 管理類別彈窗
async function openManageCategoryModal() {
  const categoryListHtml = categories
    .map(
      (cat) => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:8px; background:#f9f9f9; border-radius:8px;">
        <div style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1;" onclick="window.editCategory('${
          cat.id
        }', '${cat.name}', '${cat.color_hex}')">
          <span style="width:12px; height:12px; border-radius:50%; background:${
            cat.color_hex
          }"></span>
          <span>${cat.name}</span>
          <span style="font-size:0.8em; color:#999;">(點擊編輯)</span>
        </div>
        ${
          cat.id !== "1"
            ? `<button onclick="window.deleteCategory('${cat.id}')" style="border:none; background:none; color:red; cursor:pointer; padding:4px 8px;">✕</button>`
            : ""
        }
      </div>
    `
    )
    .join("");

  const { value: newCat } = await Swal.fire({
    title: "管理類別",
    html: `
      <div style="text-align:left; margin-bottom:16px;">
        <label style="font-weight:bold;">新增類別</label>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <input id="swal-cat-name" class="swal2-input" placeholder="名稱" style="margin:0 !important;">
          <input id="swal-cat-color" type="color" value="#5abf98" style="height:46px; width:60px; padding:0; border:none; background:none;">
        </div>
      </div>
      <hr style="border:0; border-top:1px dashed #ccc; margin:16px 0;">
      <div style="text-align:left; max-height:200px; overflow-y:auto;">
        <label style="font-weight:bold; margin-bottom:8px; display:block;">現有類別 (點擊可編輯)</label>
        ${categoryListHtml}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "新增類別",
    cancelButtonText: "關閉",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      const name = document.getElementById("swal-cat-name").value;
      const color = document.getElementById("swal-cat-color").value;
      if (!name) return null;
      return { name, color_hex: color };
    },
  });

  if (newCat) {
    Swal.fire({
      title: "新增中...",
      text: "正在建立類別",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify(newCat),
      });
      await loadCategories();
      Swal.fire("成功", "類別已新增！", "success").then(() =>
        openManageCategoryModal()
      );
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

// 編輯類別
window.editCategory = async function (id, currentName, currentColor) {
  const { value: updatedCat } = await Swal.fire({
    title: "編輯類別",
    html: `
      <div style="text-align:left;">
        <div style="margin-bottom:16px;">
          <label>類別名稱</label>
          <input id="edit-cat-name" class="swal2-input" value="${currentName}" placeholder="名稱">
        </div>
        <div>
          <label>代表色</label>
          <input id="edit-cat-color" type="color" value="${currentColor}" style="width:100%; height:50px; padding:0; border:none;">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        name: document.getElementById("edit-cat-name").value,
        color_hex: document.getElementById("edit-cat-color").value,
      };
    },
  });

  if (updatedCat) {
    Swal.fire({
      title: "更新中...",
      text: "正在儲存變更",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedCat),
      });
      await loadCategories();
      // 編輯完後重新打開管理列表，方便繼續操作
      Swal.fire("成功", "類別已更新！", "success").then(() =>
        openManageCategoryModal()
      );
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// ===== CRUD Operations =====
async function createTransaction(payload) {
  await api("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      id: `txn-${Date.now()}`,
      amount: Number(payload.amount),
    }),
  });
  await loadTransactions();
}

// 編輯交易
window.editTransaction = async function (id) {
  const txn = transactions.find((t) => t.id === id);
  if (!txn) return;

  const categoryOptions = categories
    .map(
      (cat) =>
        `<option value="${cat.id}" ${
          cat.id === txn.category_id ? "selected" : ""
        }>${cat.name}</option>`
    )
    .join("");

  const { value: formValues } = await Swal.fire({
    title: "編輯記帳",
    html: `
      <form id="swal-txn-form" class="swal-form">
        <div class="form-group">
          <label>項目名稱</label>
          <input type="text" id="swal-note" class="swal2-input" placeholder="例如：午餐、搭公車、買卡片" value="${
            txn.note || ""
          }" required autofocus>
        </div>
        <div class="form-group">
          <label>類別</label>
          <select id="swal-category" class="swal2-select">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label>金額</label>
          <input type="number" id="swal-amount" class="swal2-input" placeholder="多少錢？" min="1" value="${
            txn.amount
          }" required inputmode="numeric">
        </div>
        <div class="form-group">
          <label>收支</label>
          <select id="swal-type" class="swal2-select">
            <option value="expense" ${
              txn.type === "expense" ? "selected" : ""
            }>支出</option>
            <option value="income" ${
              txn.type === "income" ? "selected" : ""
            }>收入</option>
          </select>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input type="date" id="swal-date" class="swal2-input" value="${
            txn.date
          }" required>
        </div>
        <div class="form-group">
          <label>代墊人（選填）</label>
          <select id="swal-paid-by" class="swal2-select">
            <option value="" ${
              !txn.paid_by || txn.paid_by === "" ? "selected" : ""
            }>無（無代墊）</option>
            <option value="Alan" ${
              txn.paid_by === "Alan" ? "selected" : ""
            }>Alan</option>
            <option value="Peiya" ${
              txn.paid_by === "Peiya" ? "selected" : ""
            }>Peiya</option>
          </select>
        </div>
      </form>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        date: document.getElementById("swal-date").value,
        type: document.getElementById("swal-type").value,
        category_id: document.getElementById("swal-category").value,
        amount: document.getElementById("swal-amount").value,
        note: document.getElementById("swal-note").value,
        paid_by: document.getElementById("swal-paid-by").value,
      };
    },
  });

  if (formValues) {
    if (!formValues.amount)
      return Swal.fire("哎呀！", "金額沒填喔！", "warning");

    // 顯示 loading
    Swal.fire({
      title: "更新中...",
      text: "正在儲存變更",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api(`/api/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...formValues,
          amount: Number(formValues.amount),
        }),
      });
      await loadTransactions();
      Swal.fire("成功！", "記帳已更新！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// 把刪除函式掛載到 window 以便在 innerHTML onclick 中呼叫
window.deleteTransaction = async function (id) {
  const result = await Swal.fire({
    title: "確定要刪除嗎？",
    text: "這筆紀錄會消失在時空縫隙中喔！",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ff7675",
    confirmButtonText: "刪除",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      await api(`/api/transactions/${id}`, { method: "DELETE" });
      await loadTransactions();
      Swal.fire("已刪除！", "紀錄已移除。", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

window.deleteCategory = async function (id) {
  const result = await Swal.fire({
    title: "刪除類別？",
    text: "該類別無法復原喔！",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ff7675",
    confirmButtonText: "刪除",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      await loadCategories();
      Swal.fire("已刪除！", "類別已移除。", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// 標記為已補款
window.markReimbursed = async function (id) {
  const result = await Swal.fire({
    title: "標記為已補款？",
    text: "確認這筆代墊款項已經補款完成",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#5abf98",
    confirmButtonText: "確認",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      Swal.fire({
        title: "處理中...",
        text: "正在更新補款狀態",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await api(`/api/transactions/${id}/reimburse`, {
        method: "PATCH",
        body: JSON.stringify({ is_reimbursed: true }),
      });
      
      // 重新載入並渲染（會從伺服器獲取最新資料）
      await loadTransactions();
      Swal.fire("成功！", "已標記為已補款", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// 一鍵結清所有代墊
window.markAllReimbursed = async function () {
  if (!selectedMonth) return;
  const [year, month] = selectedMonth.split('-').map(Number);
  const monthlyTransactions = getMonthlyTransactions(year, month - 1);
  
  // 找出所有未補款的代墊交易
  const pendingTxns = monthlyTransactions.filter(txn => {
    const isReimbursed = txn.is_reimbursed === true || 
                        txn.is_reimbursed === "true" || 
                        String(txn.is_reimbursed).toLowerCase() === "true";
    return (txn.paid_by === "Alan" || txn.paid_by === "Peiya") && !isReimbursed;
  });

  if (pendingTxns.length === 0) {
    return Swal.fire("提示", "本月沒有需要結清的代墊款項喔！", "info");
  }

  const result = await Swal.fire({
    title: "一鍵結清所有代墊？",
    text: `確定要將本月 ${pendingTxns.length} 筆代墊紀錄標記為已補款嗎？`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#5abf98",
    confirmButtonText: "確認結清",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      Swal.fire({
        title: "處理中...",
        text: "正在大規模結清中...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // 由於沒有批量 API，逐一發送請求
      // 使用 Promise.all 可能會對 Google Sheets API 造成壓力，這裡建議順序執行或限制並行
      for (const txn of pendingTxns) {
        await api(`/api/transactions/${txn.id}/reimburse`, {
          method: "PATCH",
          body: JSON.stringify({ is_reimbursed: true }),
        });
      }
      
      await loadTransactions();
      Swal.fire("成功！", "本月所有代墊已結清", "success");
    } catch (error) {
      Swal.fire("失敗", "結清過程中出錯：" + error.message, "error");
    }
  }
};

// ===== Event Listeners =====
goLoginBtn.addEventListener("click", showLogin);
backToLandingBtn.addEventListener("click", showLanding);

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    await login(username, password);
    showMain();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", logout);
btnAddTransaction.addEventListener("click", openAddTransactionModal);
btnManageCategory.addEventListener("click", openManageCategoryModal);
budgetSection.addEventListener("click", openBudgetModal);
btnClearAllSettlements.addEventListener("click", window.markAllReimbursed);

// 月份選擇器事件監聽
prevMonthBtn.addEventListener('click', goToPrevMonth);
nextMonthBtn.addEventListener('click', goToNextMonth);
transactionListTitle.addEventListener('click', openMonthPickerModal);

// ===== Initialize =====
async function init() {
  if (token) {
    const isValid = await validateToken();
    if (isValid) {
      showMain();
    } else {
      showLanding();
    }
  } else {
    showLanding();
  }
}

init();
