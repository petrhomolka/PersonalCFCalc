const STORAGE_KEY = "pf_app_v1";
const HISTORICAL_IMPORT_VERSION = 3;

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneState(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

const initialState = {
  version: 1,
  historicalImportVersion: 0,
  months: {},
  importedSummaries: {},
  monthGoals: {},
  goalTimeline: []
};

const state = loadState();
let nextMonthArmTimeout = null;
let isNextMonthArmed = false;
const els = {
  runtimeError: document.getElementById("runtimeError"),
  tabs: document.getElementById("tabs"),
  panels: document.querySelectorAll(".panel"),
  monthSelect: document.getElementById("monthSelect"),
  startNextMonthBtn: document.getElementById("startNextMonthBtn"),
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
  kpiFreeCash: document.getElementById("kpiFreeCash"),
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
  assetIsCash: document.getElementById("assetIsCash"),
  assetList: document.getElementById("assetList"),
  goalTableBody: document.getElementById("goalTableBody"),
  addYearBtn: document.getElementById("addYearBtn"),
  removeYearBtn: document.getElementById("removeYearBtn"),
  trendChart: document.getElementById("trendChart"),
  assetChart: document.getElementById("assetChart"),
  macroChart: document.getElementById("macroChart"),
  assetMacroChart: document.getElementById("assetMacroChart"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  importJsonInput: document.getElementById("importJsonInput"),
  importCsvInput: document.getElementById("importCsvInput"),
  reimportHistoricalBtn: document.getElementById("reimportHistoricalBtn"),
  resetBtn: document.getElementById("resetBtn"),
  status: document.getElementById("status")
};

window.addEventListener("error", (event) => {
  showRuntimeError(`Runtime error: ${event.message}`);
});

window.addEventListener("unhandledrejection", () => {
  showRuntimeError("Unhandled promise rejection in app.");
});

boot();

function showRuntimeError(message) {
  if (!els.runtimeError) return;
  els.runtimeError.hidden = false;
  els.runtimeError.textContent = message;
}

async function boot() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  els.monthSelect.value = month;

  ensureMonth(els.monthSelect.value);
  ensureGoalTimeline();
  wireEvents();
  registerSW();
  await seedHistoricalDataIfEmpty();
  render();
}

async function seedHistoricalDataIfEmpty() {
  if (!shouldSeedHistoricalData()) return;

  try {
    const response = await fetch("./assets/historical.csv", { cache: "no-store" });
    if (!response.ok) return;
    const text = await response.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return;

    clearImportedSummaryData();
    const parsedCount = hydrateFromSheetRows(rows);
    if (parsedCount > 0) {
      state.historicalImportVersion = HISTORICAL_IMPORT_VERSION;
      saveState();
      setStatus(`Historická data automaticky importována (${parsedCount} měsíců).`);
    } else {
      setStatus("Historický CSV nalezen, ale nepodařilo se z něj načíst měsíce.");
    }
  } catch {
    setStatus("Automatický import historických dat se nepovedl (spusť app přes http server nebo importuj CSV ručně v Data).\n");
  }
}

function shouldSeedHistoricalData() {
  if (Number(state.historicalImportVersion || 0) < HISTORICAL_IMPORT_VERSION) return true;

  const summaries = state.importedSummaries || {};
  const months = Object.keys(summaries);
  if (months.length === 0) return true;

  const likelyOldBrokenMapping = months.length >= 6 && months.filter((month) => {
    const row = summaries[month] || {};
    const income = Number(row.income || 0);
    const ratio = Number(row.investIncomeRatio || 0);
    return income > 0 && income < 1000 && ratio > 100;
  }).length >= Math.ceil(months.length * 0.4);

  if (likelyOldBrokenMapping) return true;

  const hasAnyValue = months.some((month) => {
    const row = summaries[month] || {};
    return Object.values(row).some((value) => Number(value) !== 0);
  });

  return !hasAnyValue;
}

function wireEvents() {
  els.tabs.addEventListener("click", onTabClick);
  els.monthSelect.addEventListener("change", () => {
    ensureMonth(els.monthSelect.value);
    render();
  });

  if (els.startNextMonthBtn) {
    els.startNextMonthBtn.addEventListener("click", onStartNextMonthClick);
  }

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
      value: Number(els.assetValue.value),
      isCash: Boolean(els.assetIsCash && els.assetIsCash.checked)
    });
    els.assetForm.reset();
    render();
  });

  els.addYearBtn.addEventListener("click", addFutureYearGoals);
  els.removeYearBtn.addEventListener("click", removeLastFutureYearGoals);
  els.goalTableBody.addEventListener("input", onGoalTableInputChange);

  els.exportJsonBtn.addEventListener("click", exportJson);
  els.importJsonInput.addEventListener("change", importJson);
  els.importCsvInput.addEventListener("change", importCsvSheet);
  els.reimportHistoricalBtn.addEventListener("click", reimportHistoricalData);

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Opravdu smazat všechna lokální data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}

async function reimportHistoricalData() {
  try {
    const response = await fetch("./assets/historical.csv", { cache: "no-store" });
    if (!response.ok) {
      setStatus("Nelze načíst vestavěný historical.csv.");
      return;
    }
    const text = await response.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setStatus("Vestavěný historical.csv je prázdný.");
      return;
    }

    clearImportedSummaryData();
    const parsedCount = hydrateFromSheetRows(rows);
    state.historicalImportVersion = HISTORICAL_IMPORT_VERSION;
    saveState();
    render();
    setStatus(`Historická data re-importována (${parsedCount} měsíců).`);
  } catch {
    setStatus("Re-import historických dat se nepovedl.");
  }
}

function clearImportedSummaryData() {
  state.importedSummaries = {};

  Object.values(state.months).forEach((monthData) => {
    if (!monthData) return;
    monthData.income = (monthData.income || []).filter((item) => item.source !== "imported-csv-summary");
    monthData.expense = (monthData.expense || []).filter((item) => item.source !== "imported-csv-summary");
    monthData.investment = (monthData.investment || []).filter((item) => item.source !== "imported-csv-summary");
    monthData.assets = (monthData.assets || []).filter((item) => item.source !== "imported-csv-summary");
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

  const id = createId();
  const item = { id, name, amount, periodic, createdAt: Date.now() };

  if (type === "income") state.months[month].income.push(item);
  if (type === "expense") state.months[month].expense.push(item);
  if (type === "investment") state.months[month].investment.push(item);

  saveState();
}

function addAsset({ month, name, value, isCash }) {
  if (!month || !name || Number.isNaN(value)) return;
  ensureMonth(month);
  state.months[month].assets.push({
    id: createId(),
    name,
    value,
    isCash: Boolean(isCash),
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
        id: createId(),
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
        id: createId(),
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

function getNextMonth(month) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || !monthNumber) return null;

  const date = new Date(year, monthNumber, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function onStartNextMonthClick() {
  if (!isNextMonthArmed) {
    armStartNextMonthButton();
    return;
  }

  disarmStartNextMonthButton();
  startNextMonth();
}

function armStartNextMonthButton() {
  isNextMonthArmed = true;
  if (els.startNextMonthBtn) {
    els.startNextMonthBtn.textContent = "Confirm start next month";
  }

  if (nextMonthArmTimeout) clearTimeout(nextMonthArmTimeout);
  nextMonthArmTimeout = setTimeout(() => {
    disarmStartNextMonthButton();
  }, 7000);
}

function disarmStartNextMonthButton() {
  isNextMonthArmed = false;
  if (nextMonthArmTimeout) {
    clearTimeout(nextMonthArmTimeout);
    nextMonthArmTimeout = null;
  }

  if (els.startNextMonthBtn) {
    els.startNextMonthBtn.textContent = "Start next month";
  }
}

function startNextMonth() {
  const currentMonth = els.monthSelect.value;
  const nextMonth = getNextMonth(currentMonth);
  if (!nextMonth) {
    setStatus("Nelze spočítat další měsíc.");
    return;
  }

  const confirmed = confirm(`Přepnout na ${nextMonth} a přenést assets z ${currentMonth}?`);
  if (!confirmed) return;

  ensureMonth(currentMonth);
  ensureMonth(nextMonth);
  carryAssetsToNextMonth(currentMonth, nextMonth);

  els.monthSelect.value = nextMonth;
  saveState();
  render();
  setStatus(`Vytvořen měsíc ${nextMonth} a assets přeneseny z ${currentMonth}.`);
}

function carryAssetsToNextMonth(fromMonth, toMonth) {
  const source = (state.months[fromMonth] && state.months[fromMonth].assets) || [];
  const target = (state.months[toMonth] && state.months[toMonth].assets) || [];

  const existingKeys = new Set(target.map((item) => item.sourceAssetKey || `${item.name}|${item.value}`));

  source.forEach((item) => {
    const sourceAssetKey = `${item.name}|${item.value}`;
    if (existingKeys.has(sourceAssetKey)) return;

    target.push({
      id: createId(),
      name: item.name,
      value: Number(item.value) || 0,
      isCash: isCashAsset(item),
      carriedFrom: fromMonth,
      sourceAssetKey,
      createdAt: Date.now()
    });
    existingKeys.add(sourceAssetKey);
  });
}

function render() {
  const month = els.monthSelect.value;
  els.activeMonthLabel.textContent = month;

  const totals = getTotalsForMonth(month);

  els.kpiIncome.textContent = formatCurrency(totals.income);
  els.kpiExpense.textContent = formatCurrency(totals.expense);
  els.kpiInvest.textContent = formatCurrency(totals.investment);
  els.kpiCashflow.textContent = formatCurrency(totals.cashflow);
  els.kpiAssets.textContent = formatCurrency(totals.assets);
  els.kpiAssetGoal.textContent = formatCurrency(totals.goal);
  els.kpiPassiveCf.textContent = formatCurrency(totals.passiveCf);
  els.kpiPassiveIncome.textContent = formatCurrency(totals.passiveIncome);
  els.kpiInvestIncomeRatio.textContent = formatPercent(totals.investIncomeRatio);
  els.kpiFreeCash.textContent = formatCurrency(totals.freeCash);
  els.kpiPredikce.textContent = formatCurrency(totals.predikce);
  els.kpiAssetChange.textContent = formatCurrency(totals.assetChange);

  renderLists(month);
  renderGoalsTable();
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

  const periodicItems = items.filter((item) => item.periodic === true);
  const oneTimeItems = items.filter((item) => item.periodic !== true);
  const orderedItems = periodicItems.concat(oneTimeItems);

  if (periodicItems.length && oneTimeItems.length) {
    const periodicHeader = document.createElement("li");
    periodicHeader.className = "entry-section-header";
    periodicHeader.innerHTML = "<small>Periodical</small>";
    listEl.appendChild(periodicHeader);
  }

  orderedItems.forEach((item, index) => {
    if (periodicItems.length && oneTimeItems.length && index === periodicItems.length) {
      const oneTimeHeader = document.createElement("li");
      oneTimeHeader.className = "entry-section-header";
      oneTimeHeader.innerHTML = "<small>One-time</small>";
      listEl.appendChild(oneTimeHeader);
    }

    const li = document.createElement("li");
    li.className = item.periodic ? "periodic-item" : "one-time-item";
    const periodicText = item.periodic ? "periodical" : "one-time";
    const periodicBadge = item.periodic
      ? '<small class="item-badge periodic-badge">PERIODICAL</small>'
      : '<small class="item-badge onetime-badge">ONE-TIME</small>';
    const autoText = item.carriedFrom ? `<small>(auto z ${item.carriedFrom})</small>` : "";
    li.innerHTML = `
      <span>
        ${escapeHtml(item.name)}
        ${item.periodic !== undefined ? periodicBadge : ""}
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
    const cashTag = isCashAsset(item) ? '<small>(cash)</small>' : "";
    li.innerHTML = `
      <span>${escapeHtml(item.name)} ${cashTag}</span>
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
  const list = state.months[month] && state.months[month][type] ? state.months[month][type] : [];
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
  const list = state.months[month] && state.months[month].assets ? state.months[month].assets : [];
  const item = list.find((row) => row.id === id);
  if (!item) return;

  const name = prompt("Název asset", item.name);
  if (name === null) return;
  const valueText = prompt("Hodnota (Kč)", String(item.value));
  if (valueText === null) return;
  const value = Number(valueText);
  if (!name.trim() || Number.isNaN(value)) return;
  const cashByDefault = isCashAsset(item);
  const isCash = confirm(`Je to cash asset?\n\nOK = ano, Cancel = ne\n(${cashByDefault ? "aktuálně: ano" : "aktuálně: ne"})`);

  item.name = name.trim();
  item.value = value;
  item.isCash = isCash;
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

function renderGoalsTable() {
  ensureGoalTimeline();
  els.goalTableBody.innerHTML = "";
  const currentMonth = getCurrentMonthKey();
  let previousYear = "";

  state.goalTimeline.forEach((month) => {
    ensureGoalMonth(month);
    const goalRow = state.monthGoals[month];
    const year = month.slice(0, 4);

    if (year !== previousYear) {
      const yearHeader = document.createElement("tr");
      yearHeader.className = "year-separator";
      yearHeader.innerHTML = `<td colspan="5">Year ${escapeHtml(year)}</td>`;
      els.goalTableBody.appendChild(yearHeader);
      previousYear = year;
    }

    const yearNumber = Number(year);
    const yearClass = yearNumber % 2 === 0 ? "year-even" : "year-odd";
    const currentClass = month === currentMonth ? "is-current-month" : "";
    const tr = document.createElement("tr");
    tr.className = `${yearClass} ${currentClass}`.trim();
    tr.innerHTML = `
      <td>${escapeHtml(month)}</td>
      <td><input type="number" step="0.01" data-month="${month}" data-field="goal" value="${goalRow.goal || 0}" /></td>
      <td><input type="number" step="0.01" data-month="${month}" data-field="assetGoal" value="${goalRow.assetGoal || 0}" /></td>
      <td><input type="number" step="0.01" data-month="${month}" data-field="predikce" value="${goalRow.predikce || 0}" /></td>
      <td><input type="number" step="0.01" data-month="${month}" data-field="assetPrediction" value="${goalRow.assetPrediction || 0}" /></td>
    `;
    els.goalTableBody.appendChild(tr);
  });
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function onGoalTableInputChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const month = input.dataset.month;
  const field = input.dataset.field;
  if (!month || !field) return;

  ensureGoalMonth(month);
  state.monthGoals[month][field] = Number(input.value || 0);
  saveState();
  render();
}

function ensureGoalMonth(month) {
  if (!state.monthGoals[month]) {
    const imported = state.importedSummaries[month] || {};
    state.monthGoals[month] = {
      goal: Number(imported.goal || 0),
      assetGoal: Number(imported.assetGoal || 0),
      predikce: Number(imported.predikce || 0),
      assetPrediction: Number(imported.assetPrediction || 0)
    };
  }

  if (!state.goalTimeline.includes(month)) {
    state.goalTimeline.push(month);
    state.goalTimeline.sort();
  }
}

function ensureGoalTimeline() {
  if (!Array.isArray(state.goalTimeline)) state.goalTimeline = [];

  const months = Object.keys(state.importedSummaries)
    .concat(Object.keys(state.months))
    .concat(Object.keys(state.monthGoals || {}))
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort();

  if (!state.goalTimeline.length) {
    state.goalTimeline = months;
  } else {
    months.forEach((month) => {
      if (!state.goalTimeline.includes(month)) state.goalTimeline.push(month);
    });
    state.goalTimeline.sort();
  }

  state.goalTimeline.forEach((month) => ensureGoalMonth(month));
}

function addFutureYearGoals() {
  ensureGoalTimeline();
  const lastMonth = state.goalTimeline[state.goalTimeline.length - 1] || els.monthSelect.value;
  const [yearText, monthText] = lastMonth.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  if (!year || !month) return;

  for (let index = 0; index < 12; index += 1) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const nextMonth = `${year}-${String(month).padStart(2, "0")}`;
    ensureGoalMonth(nextMonth);
  }

  saveState();
  render();
}

function removeLastFutureYearGoals() {
  ensureGoalTimeline();
  if (!state.goalTimeline.length) return;

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const lastMonth = state.goalTimeline[state.goalTimeline.length - 1];
  const lastYear = Number(lastMonth.slice(0, 4));

  const yearMonths = state.goalTimeline.filter((month) => Number(month.slice(0, 4)) === lastYear);
  const hasNonFuture = yearMonths.some((month) => month <= currentMonth);
  if (hasNonFuture) {
    setStatus(`Rok ${lastYear} nelze smazat, protože už probíhá nebo je v minulosti.`);
    return;
  }

  state.goalTimeline = state.goalTimeline.filter((month) => Number(month.slice(0, 4)) !== lastYear);
  yearMonths.forEach((month) => {
    delete state.monthGoals[month];
  });

  saveState();
  render();
}

function getTotalsForMonth(month) {
  const monthData = state.months[month] || { income: [], expense: [], investment: [], assets: [] };

  const localIncome = sumBy(monthData.income, "amount");
  const localExpense = sumBy(monthData.expense, "amount");
  const localInvestment = sumBy(monthData.investment, "amount");
  const localAssets = sumBy(monthData.assets, "value");
  const localFreeCash = monthData.assets
    .filter((item) => isCashAsset(item))
    .reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  const imported = state.importedSummaries[month] || {};
  ensureGoalMonth(month);
  const monthGoal = state.monthGoals[month] || {};

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
    goal: Number(monthGoal.goal || imported.goal || 0),
    predikce: Number(monthGoal.predikce || imported.predikce || 0),
    assetChange: imported.assetChange || 0,
    assetGoal: Number(monthGoal.assetGoal || imported.assetGoal || 0),
    assetPrediction: Number(monthGoal.assetPrediction || imported.assetPrediction || 0),
    freeCash: localFreeCash || imported.freeCash || 0,
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
  const goals = labels.map((month) => getTotalsForMonth(month).assetGoal);

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
    .concat(state.goalTimeline || [])
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
  const allValues = series.reduce((acc, line) => acc.concat(line.values), []);
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
  const file = event.target && event.target.files ? event.target.files[0] : null;
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
  const file = event.target && event.target.files ? event.target.files[0] : null;
  if (!file) return;

  try {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("CSV bez dat");

    const parsedCount = hydrateFromSheetRows(rows);
    state.historicalImportVersion = HISTORICAL_IMPORT_VERSION;
    saveState();
    render();
    if (parsedCount > 0) {
      setStatus(`CSV import hotový. Nalezeno měsíců: ${parsedCount}.`);
    } else {
      setStatus("CSV načten, ale nebyly rozpoznány měsíce (zkontroluj formát sloupce měsíc).\n");
    }
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
    const monthIndex = row.findIndex((value) => /^\d{1,2}\/\d{4}$/.test((value || "").trim()));
    if (monthIndex < 0) continue;

    const rawMonth = (row[monthIndex] || "").trim();
    const month = parseMonth(rawMonth);
    if (!month) continue;

    const realita = parseMoney(row[monthIndex + 1]);
    const goal = parseMoney(row[monthIndex + 2]);
    const notes = (row[monthIndex + 3] || "").trim();
    const predikce = parseMoney(row[monthIndex + 4]);
    const freeCash = parseFreeCash(row, monthIndex);
    const assetChange = parseMoney(row[monthIndex + 6]);
    const assetGoal = parseMoney(row[monthIndex + 7]);
    const assetPrediction = parseMoney(row[monthIndex + 8]);
    const passiveCf = parseMoney(row[monthIndex + 10]);
    const passiveIncome = parseMoney(row[monthIndex + 11]);
    const investIncomeRatio = parsePercent(row[monthIndex + 12]);
    const income = parseMoney(row[monthIndex + 13]);
    const expense = parseMoney(row[monthIndex + 14]);
    const investment = parseMoney(row[monthIndex + 15]);
    const cashFlow = parseMoney(row[monthIndex + 16]);
    const assets = realita;

    state.importedSummaries[month] = {
      realita,
      goal,
      predikce,
      assetChange,
      assetGoal,
      assetPrediction,
      freeCash,
      passiveCf,
      passiveIncome,
      investIncomeRatio,
      notes,
      income,
      expense,
      investment,
      cashFlow,
      assets,
      assetGoal
    };

    ensureMonth(month);
    ensureGoalMonth(month);
    state.monthGoals[month].goal = Number(goal || 0);
    state.monthGoals[month].assetGoal = Number(assetGoal || 0);
    state.monthGoals[month].predikce = Number(predikce || 0);
    state.monthGoals[month].assetPrediction = Number(assetPrediction || 0);
    upsertImportedMonthlyRows(month, state.importedSummaries[month]);
    count += 1;
  }

  return count;
}

function parseFreeCash(row, monthIndex) {
  const possibleLabels = [
    row[monthIndex - 5],
    row[monthIndex - 4],
    row[monthIndex - 3]
  ];

  const hasFreeCashLabel = possibleLabels.some((value) => String(value || "").toLowerCase().includes("free cash"));
  if (!hasFreeCashLabel) return 0;

  const preferredValue = parseMoney(row[monthIndex - 2]);
  if (preferredValue !== 0) return preferredValue;

  return parseMoney(row[monthIndex - 3]);
}

function upsertImportedMonthlyRows(month, summary) {
  const monthData = state.months[month];
  if (!monthData) return;

  const passiveIncome = Number(summary.passiveIncome || 0);
  const totalIncome = Number(summary.income || 0);
  const mzda = totalIncome - passiveIncome;

  upsertImportedEntry(monthData.income, "mzda", mzda);
  upsertImportedEntry(monthData.income, "sporici ucet", passiveIncome);
  upsertImportedEntry(monthData.expense, "Imported výdaje (CSV)", summary.expense);
  upsertImportedEntry(monthData.investment, "Imported investice (CSV)", summary.investment);
  upsertImportedAsset(monthData.assets, "Imported assets total (CSV)", summary.assets, false);
}

function upsertImportedEntry(list, name, amount) {
  if (!Number.isFinite(amount)) return;
  const existing = list.find((item) => item.source === "imported-csv-summary" && item.name === name);
  if (existing) {
    existing.amount = amount;
    existing.updatedAt = Date.now();
    return;
  }

  list.push({
    id: createId(),
    name,
    amount,
    periodic: false,
    source: "imported-csv-summary",
    createdAt: Date.now()
  });
}

function upsertImportedAsset(list, name, value, isCash = false) {
  if (!Number.isFinite(value)) return;
  const existing = list.find((item) => item.source === "imported-csv-summary" && item.name === name);
  if (existing) {
    existing.value = value;
    existing.isCash = Boolean(isCash);
    existing.updatedAt = Date.now();
    return;
  }

  list.push({
    id: createId(),
    name,
    value,
    isCash: Boolean(isCash),
    source: "imported-csv-summary",
    createdAt: Date.now()
  });
}

function isCashAsset(asset) {
  if (!asset) return false;
  if (typeof asset.isCash === "boolean") return asset.isCash;
  return isCashAssetName(asset.name);
}

function isCashAssetName(name) {
  const text = String(name || "").trim().toLowerCase();
  return text.startsWith("cash") || text.includes("free cash") || text.includes("z toho free cash");
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
  const normalized = String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "")
    .replace(/,/g, "");

  const cleaned = normalized.replace(/[^0-9.\-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parsePercent(value) {
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/[^0-9.\-]/g, "")
    .trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneState(initialState);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return cloneState(initialState);
    return {
      version: 1,
      historicalImportVersion: Number(parsed.historicalImportVersion || 0),
      months: parsed.months && typeof parsed.months === "object" ? parsed.months : {},
      importedSummaries: parsed.importedSummaries && typeof parsed.importedSummaries === "object" ? parsed.importedSummaries : {},
      monthGoals: parsed.monthGoals && typeof parsed.monthGoals === "object" ? parsed.monthGoals : {},
      goalTimeline: Array.isArray(parsed.goalTimeline) ? parsed.goalTimeline : []
    };
  } catch {
    return cloneState(initialState);
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
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });

  if (window.caches && caches.keys) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key.indexOf("pf-app-") === 0) caches.delete(key);
      });
    });
  }
}
