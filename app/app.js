const STORAGE_KEY = "pf_app_v1";

const initialState = {
  version: 1,
  goals: [],
  months: {},
  importedSummaries: {}
};

const state = loadState();
const els = {
  tabs: document.getElementById("tabs"),
  panels: document.querySelectorAll(".panel"),
  monthSelect: document.getElementById("monthSelect"),
  activeMonthLabel: document.getElementById("activeMonthLabel"),
  kpiIncome: document.getElementById("kpiIncome"),
  kpiExpense: document.getElementById("kpiExpense"),
  kpiInvest: document.getElementById("kpiInvest"),
  kpiCashflow: document.getElementById("kpiCashflow"),
  kpiAssets: document.getElementById("kpiAssets"),
  kpiAssetGoal: document.getElementById("kpiAssetGoal"),
  kpiPassiveCf: document.getElementById("kpiPassiveCf"),
  kpiPassiveIncome: document.getElementById("kpiPassiveIncome"),
  kpiInvestIncomeRatio: document.getElementById("kpiInvestIncomeRatio"),
  kpiRealita: document.getElementById("kpiRealita"),
  kpiPredikce: document.getElementById("kpiPredikce"),
  kpiAssetChange: document.getElementById("kpiAssetChange"),
  entryForm: document.getElementById("entryForm"),
  entryType: document.getElementById("entryType"),
  entryName: document.getElementById("entryName"),
  entryAmount: document.getElementById("entryAmount"),
  entryPeriodic: document.getElementById("entryPeriodic"),
  incomeList: document.getElementById("incomeList"),
  expenseList: document.getElementById("expenseList"),
  investmentList: document.getElementById("investmentList"),
  assetForm: document.getElementById("assetForm"),
  assetName: document.getElementById("assetName"),
  assetValue: document.getElementById("assetValue"),
  assetList: document.getElementById("assetList"),
  goalForm: document.getElementById("goalForm"),
  goalName: document.getElementById("goalName"),
  goalTarget: document.getElementById("goalTarget"),
  goalList: document.getElementById("goalList"),
  trendChart: document.getElementById("trendChart"),
  assetChart: document.getElementById("assetChart"),
  macroChart: document.getElementById("macroChart"),
  assetMacroChart: document.getElementById("assetMacroChart"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  importJsonInput: document.getElementById("importJsonInput"),
  importCsvInput: document.getElementById("importCsvInput"),
  resetBtn: document.getElementById("resetBtn"),
  status: document.getElementById("status")
};

boot();

function boot() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  els.monthSelect.value = month;

  ensureMonth(els.monthSelect.value);
  wireEvents();
  registerSW();
  render();
}

function wireEvents() {
  els.tabs.addEventListener("click", onTabClick);
  els.monthSelect.addEventListener("change", () => {
    ensureMonth(els.monthSelect.value);
    render();
  });

  els.entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addEntry({
      month: els.monthSelect.value,
      type: els.entryType.value,
      name: els.entryName.value.trim(),
      amount: Number(els.entryAmount.value),
      periodic: els.entryPeriodic.checked
    });
    els.entryForm.reset();
    render();
  });

  els.assetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addAsset({
      month: els.monthSelect.value,
      name: els.assetName.value.trim(),
      value: Number(els.assetValue.value)
    });
    els.assetForm.reset();
    render();
  });

  els.goalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.goals.push({
      id: crypto.randomUUID(),
      name: els.goalName.value.trim(),
      target: Number(els.goalTarget.value),
      createdAt: Date.now()
    });
    saveState();
    els.goalForm.reset();
    render();
  });

  els.exportJsonBtn.addEventListener("click", exportJson);
  els.importJsonInput.addEventListener("change", importJson);
  els.importCsvInput.addEventListener("change", importCsvSheet);

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Opravdu smazat všechna lokální data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}

function onTabClick(event) {
  const tab = event.target.closest("button[data-tab]");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach((node) => node.classList.remove("active"));
  tab.classList.add("active");

  els.panels.forEach((panel) => panel.classList.remove("active"));
  document.getElementById(tab.dataset.tab).classList.add("active");
}

function addEntry({ month, type, name, amount, periodic }) {
  if (!month || !name || Number.isNaN(amount)) return;
  ensureMonth(month);

  const id = crypto.randomUUID();
  const item = { id, name, amount, periodic, createdAt: Date.now() };

  if (type === "income") state.months[month].income.push(item);
  if (type === "expense") state.months[month].expense.push(item);
  if (type === "investment") state.months[month].investment.push(item);

  saveState();
}

function addAsset({ month, name, value }) {
  if (!month || !name || Number.isNaN(value)) return;
  ensureMonth(month);
  state.months[month].assets.push({
    id: crypto.randomUUID(),
    name,
    value,
    createdAt: Date.now()
  });
  saveState();
}

function ensureMonth(month) {
  if (!state.months[month]) {
    state.months[month] = {
      income: [],
      expense: [],
      investment: [],
      assets: []
    };
    carryPeriodicFromPreviousMonth(month);
    saveState();
  }

  syncPeriodicPrefill(month);
}

function carryPeriodicFromPreviousMonth(month) {
  const previous = getPreviousMonth(month);
  if (!previous || !state.months[previous]) return;

  ["income", "expense", "investment"].forEach((type) => {
    const periodicItems = state.months[previous][type].filter((item) => item.periodic);
    periodicItems.forEach((item) => {
      state.months[month][type].push({
        id: crypto.randomUUID(),
        name: item.name,
        amount: item.amount,
        periodic: true,
        carriedFrom: previous,
        sourcePeriodicKey: `${type}|${item.name}|${item.amount}`,
        createdAt: Date.now()
      });
    });
  });
}

function syncPeriodicPrefill(month) {
  const previous = getPreviousMonth(month);
  if (!previous || !state.months[previous]) return;

  ["income", "expense", "investment"].forEach((type) => {
    const current = state.months[month][type];
    const existingKeys = new Set(
      current
        .filter((item) => item.periodic)
        .map((item) => item.sourcePeriodicKey || `${type}|${item.name}|${item.amount}`)
    );

    const periodicFromPrev = state.months[previous][type].filter((item) => item.periodic);
    periodicFromPrev.forEach((item) => {
      const key = `${type}|${item.name}|${item.amount}`;
      if (existingKeys.has(key)) return;

      current.push({
        id: crypto.randomUUID(),
        name: item.name,
        amount: item.amount,
        periodic: true,
        carriedFrom: previous,
        sourcePeriodicKey: key,
        createdAt: Date.now()
      });
      existingKeys.add(key);
    });
  });
}

function getPreviousMonth(month) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || !monthNumber) return null;

  const date = new Date(year, monthNumber - 2, 1);
  const prevYear = date.getFullYear();
  const prevMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${prevYear}-${prevMonth}`;
}

function render() {
  const month = els.monthSelect.value;
  els.activeMonthLabel.textContent = month;

  const totals = getTotalsForMonth(month);
  const userGoal = state.goals[state.goals.length - 1]?.target || 0;
  const assetGoalKpi = totals.assetGoal || userGoal;

  els.kpiIncome.textContent = formatCurrency(totals.income);
  els.kpiExpense.textContent = formatCurrency(totals.expense);
  els.kpiInvest.textContent = formatCurrency(totals.investment);
  els.kpiCashflow.textContent = formatCurrency(totals.cashflow);
  els.kpiAssets.textContent = formatCurrency(totals.assets);
  els.kpiAssetGoal.textContent = formatCurrency(assetGoalKpi);
  els.kpiPassiveCf.textContent = formatCurrency(totals.passiveCf);
  els.kpiPassiveIncome.textContent = formatCurrency(totals.passiveIncome);
  els.kpiInvestIncomeRatio.textContent = formatPercent(totals.investIncomeRatio);
  els.kpiRealita.textContent = formatCurrency(totals.realita);
  els.kpiPredikce.textContent = formatCurrency(totals.predikce);
  els.kpiAssetChange.textContent = formatCurrency(totals.assetChange);

  renderLists(month);
  renderGoals();
  renderTrendChart();
  renderAssetChart();
  renderMacroChart();
  renderAssetMacroChart();
}

function renderLists(month) {
  ensureMonth(month);
  const data = state.months[month];

  renderEntryList(els.incomeList, month, "income", data.income);
  renderEntryList(els.expenseList, month, "expense", data.expense);
  renderEntryList(els.investmentList, month, "investment", data.investment);
  renderAssetList(els.assetList, month, data.assets);
}

function renderEntryList(listEl, month, type, items) {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.innerHTML = "<small>Žádná data</small>";
    listEl.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const periodicText = item.periodic ? "periodical" : "one-time";
    const autoText = item.carriedFrom ? `<small>(auto z ${item.carriedFrom})</small>` : "";
    li.innerHTML = `
      <span>
        ${escapeHtml(item.name)}
        ${item.periodic !== undefined ? `<small>(${periodicText})</small>` : ""}
        ${autoText}
      </span>
      <span class="row-actions">
        <strong>${formatCurrency(item.amount || 0)}</strong>
        <button data-action="edit-entry" data-month="${month}" data-type="${type}" data-id="${item.id}" type="button">Upravit</button>
        <button data-action="delete-entry" data-month="${month}" data-type="${type}" data-id="${item.id}" type="button" class="danger">Smazat</button>
      </span>
    `;
    listEl.appendChild(li);
  });

  bindRowActions(listEl);
}

function renderAssetList(listEl, month, items) {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.innerHTML = "<small>Žádná data</small>";
    listEl.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${escapeHtml(item.name)}</span>
      <span class="row-actions">
        <strong>${formatCurrency(item.value || 0)}</strong>
        <button data-action="edit-asset" data-month="${month}" data-id="${item.id}" type="button">Upravit</button>
        <button data-action="delete-asset" data-month="${month}" data-id="${item.id}" type="button" class="danger">Smazat</button>
      </span>
    `;
    listEl.appendChild(li);
  });

  bindRowActions(listEl);
}

function bindRowActions(container) {
  container.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", onRowActionClick);
  });
}

function onRowActionClick(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;

  if (action === "edit-entry") {
    editEntry(button.dataset.month, button.dataset.type, button.dataset.id);
    return;
  }

  if (action === "delete-entry") {
    deleteEntry(button.dataset.month, button.dataset.type, button.dataset.id);
    return;
  }

  if (action === "edit-asset") {
    editAsset(button.dataset.month, button.dataset.id);
    return;
  }

  if (action === "delete-asset") {
    deleteAsset(button.dataset.month, button.dataset.id);
  }
}

function editEntry(month, type, id) {
  const list = state.months[month]?.[type] || [];
  const item = list.find((row) => row.id === id);
  if (!item) return;

  const name = prompt("Název", item.name);
  if (name === null) return;
  const amountText = prompt("Částka (Kč)", String(item.amount));
  if (amountText === null) return;
  const amount = Number(amountText);
  if (!name.trim() || Number.isNaN(amount)) return;

  const periodic = confirm("Je položka periodical? OK = ano, Cancel = ne");
  item.name = name.trim();
  item.amount = amount;
  item.periodic = periodic;
  item.updatedAt = Date.now();

  saveState();
  render();
}

function deleteEntry(month, type, id) {
  if (!state.months[month]) return;
  const list = state.months[month][type] || [];
  state.months[month][type] = list.filter((row) => row.id !== id);
  saveState();
  render();
}

function editAsset(month, id) {
  const list = state.months[month]?.assets || [];
  const item = list.find((row) => row.id === id);
  if (!item) return;

  const name = prompt("Název asset", item.name);
  if (name === null) return;
  const valueText = prompt("Hodnota (Kč)", String(item.value));
  if (valueText === null) return;
  const value = Number(valueText);
  if (!name.trim() || Number.isNaN(value)) return;

  item.name = name.trim();
  item.value = value;
  item.updatedAt = Date.now();

  saveState();
  render();
}

function deleteAsset(month, id) {
  if (!state.months[month]) return;
  const list = state.months[month].assets || [];
  state.months[month].assets = list.filter((row) => row.id !== id);
  saveState();
  render();
}

function renderGoals() {
  els.goalList.innerHTML = "";
  if (!state.goals.length) {
    const li = document.createElement("li");
    li.innerHTML = "<small>Zatím bez goal</small>";
    els.goalList.appendChild(li);
    return;
  }

  state.goals.forEach((goal) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(goal.name)}</span><strong>${formatCurrency(goal.target)}</strong>`;
    els.goalList.appendChild(li);
  });
}

function getTotalsForMonth(month) {
  const monthData = state.months[month] || { income: [], expense: [], investment: [], assets: [] };

  const localIncome = sumBy(monthData.income, "amount");
  const localExpense = sumBy(monthData.expense, "amount");
  const localInvestment = sumBy(monthData.investment, "amount");
  const localAssets = sumBy(monthData.assets, "value");

  const imported = state.importedSummaries[month] || {};

  const income = localIncome || imported.income || 0;
  const expense = localExpense || imported.expense || 0;
  const investment = localInvestment || imported.investment || 0;
  const assets = localAssets || imported.assets || 0;

  return {
    income,
    expense,
    investment,
    assets,
    cashflow: income - expense,
    realita: imported.realita || 0,
    goal: imported.goal || 0,
    predikce: imported.predikce || 0,
    assetChange: imported.assetChange || 0,
    assetGoal: imported.assetGoal || 0,
    assetPrediction: imported.assetPrediction || 0,
    passiveCf: imported.passiveCf || 0,
    passiveIncome: imported.passiveIncome || 0,
    investIncomeRatio: imported.investIncomeRatio || 0
  };
}

function renderTrendChart() {
  const labels = getMonthAxis();
  const income = labels.map((month) => getTotalsForMonth(month).income);
  const expense = labels.map((month) => getTotalsForMonth(month).expense);
  const invest = labels.map((month) => getTotalsForMonth(month).investment);
  const cashflow = labels.map((month) => getTotalsForMonth(month).cashflow);

  drawLineChart(els.trendChart, labels, [
    { name: "Příjem", values: income, color: "#34d399" },
    { name: "Výdaje", values: expense, color: "#f87171" },
    { name: "Investice", values: invest, color: "#38bdf8" },
    { name: "CashFlow", values: cashflow, color: "#fbbf24" }
  ]);
}

function renderAssetChart() {
  const labels = getMonthAxis();
  const assets = labels.map((month) => getTotalsForMonth(month).assets);
  const userGoal = state.goals[state.goals.length - 1]?.target || 0;
  const goals = labels.map((month) => {
    const importedGoal = getTotalsForMonth(month).assetGoal;
    return importedGoal || userGoal;
  });

  drawLineChart(els.assetChart, labels, [
    { name: "Assets", values: assets, color: "#a78bfa" },
    { name: "Goal", values: goals, color: "#22d3ee" }
  ]);
}

function renderMacroChart() {
  const labels = getMonthAxis();
  const realita = labels.map((month) => getTotalsForMonth(month).realita);
  const goal = labels.map((month) => getTotalsForMonth(month).goal);
  const predikce = labels.map((month) => getTotalsForMonth(month).predikce);

  drawLineChart(els.macroChart, labels, [
    { name: "Realita", values: realita, color: "#f59e0b" },
    { name: "Goal", values: goal, color: "#22d3ee" },
    { name: "Predikce", values: predikce, color: "#10b981" }
  ]);
}

function renderAssetMacroChart() {
  const labels = getMonthAxis();
  const assetChange = labels.map((month) => getTotalsForMonth(month).assetChange);
  const assetGoal = labels.map((month) => getTotalsForMonth(month).assetGoal);
  const assetPrediction = labels.map((month) => getTotalsForMonth(month).assetPrediction);

  drawLineChart(els.assetMacroChart, labels, [
    { name: "Asset Change", values: assetChange, color: "#f43f5e" },
    { name: "Asset Goal", values: assetGoal, color: "#38bdf8" },
    { name: "Asset Prediction", values: assetPrediction, color: "#c084fc" }
  ]);
}

function getMonthAxis() {
  const months = Object.keys(state.months)
    .concat(Object.keys(state.importedSummaries))
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort();
  return months.slice(-24);
}

function drawLineChart(canvas, labels, series) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * devicePixelRatio;

  ctx.clearRect(0, 0, width, height);

  if (!labels.length) return;

  const padding = 34 * devicePixelRatio;
  const allValues = series.flatMap((line) => line.values);
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;

  ctx.strokeStyle = "#3a4b6a";
  ctx.lineWidth = 1 * devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(padding, padding / 2);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding / 2, height - padding);
  ctx.stroke();

  series.forEach((line) => {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();

    line.values.forEach((value, index) => {
      const x = padding + (index * (width - padding * 1.5)) / Math.max(labels.length - 1, 1);
      const y = height - padding - ((value - min) / range) * (height - padding * 1.5);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });

  ctx.fillStyle = "#8ea2c2";
  ctx.font = `${11 * devicePixelRatio}px sans-serif`;
  const shortLabels = labels.map((label) => label.slice(2));

  shortLabels.forEach((label, index) => {
    if (index % 3 !== 0 && index !== shortLabels.length - 1) return;
    const x = padding + (index * (width - padding * 1.5)) / Math.max(shortLabels.length - 1, 1);
    ctx.fillText(label, x - 12 * devicePixelRatio, height - 8 * devicePixelRatio);
  });
}

function exportJson() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("JSON export hotový.");
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.months) throw new Error("Neplatný soubor");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    setStatus("JSON import hotový, načítám data...");
    location.reload();
  } catch {
    setStatus("Chyba při importu JSON.");
  } finally {
    event.target.value = "";
  }
}

async function importCsvSheet(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("CSV bez dat");

    const parsedCount = hydrateFromSheetRows(rows);
    saveState();
    render();
    setStatus(`CSV import hotový. Nalezeno měsíců: ${parsedCount}.`);
  } catch {
    setStatus("Chyba při importu CSV.");
  } finally {
    event.target.value = "";
  }
}

function hydrateFromSheetRows(rows) {
  let count = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rawMonth = (row[15] || "").trim();
    const month = parseMonth(rawMonth);
    if (!month) continue;

    const realita = parseMoney(row[16]);
    const goal = parseMoney(row[17]);
    const predikce = parseMoney(row[19]);
    const assetChange = parseMoney(row[20]);
    const assetGoal = parseMoney(row[21]);
    const assetPrediction = parseMoney(row[22]);
    const passiveCf = parseMoney(row[24]);
    const passiveIncome = parseMoney(row[25]);
    const investIncomeRatio = parsePercent(row[26]);
    const income = parseMoney(row[27]);
    const expense = parseMoney(row[28]);
    const investment = parseMoney(row[29]);
    const cashFlow = parseMoney(row[30]);
    const assets = realita;

    state.importedSummaries[month] = {
      realita,
      goal,
      predikce,
      assetChange,
      assetGoal,
      assetPrediction,
      passiveCf,
      passiveIncome,
      investIncomeRatio,
      income,
      expense,
      investment,
      cashFlow,
      assets,
      assetGoal
    };

    ensureMonth(month);
    count += 1;
  }

  if (!state.goals.length) {
    const lastMonth = Object.keys(state.importedSummaries).sort().slice(-1)[0];
    if (lastMonth) {
      const target = state.importedSummaries[lastMonth]?.assetGoal;
      if (target) {
        state.goals.push({
          id: crypto.randomUUID(),
          name: "Imported Asset Goal",
          target,
          createdAt: Date.now()
        });
      }
    }
  }

  return count;
}

function parseCsv(text) {
  const out = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      out.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    out.push(row);
  }

  return out;
}

function parseMonth(value) {
  const match = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = String(Number(match[1])).padStart(2, "0");
  const year = match[2];
  return `${year}-${month}`;
}

function parseMoney(value) {
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace("Kč", "")
    .replace("€", "")
    .replace("$", "")
    .replace(/,/g, "")
    .trim();

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parsePercent(value) {
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace("%", "")
    .replace(/,/g, "")
    .trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialState);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return structuredClone(initialState);
    return {
      version: 1,
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      months: parsed.months && typeof parsed.months === "object" ? parsed.months : {},
      importedSummaries: parsed.importedSummaries && typeof parsed.importedSummaries === "object" ? parsed.importedSummaries : {}
    };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

function setStatus(message) {
  els.status.textContent = message;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)} %`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
}
