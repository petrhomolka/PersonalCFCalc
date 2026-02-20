const STORAGE_KEY = "pf_app_v1";
const HISTORICAL_IMPORT_VERSION = 3;
const DEFAULT_MAIN_CURRENCY = "CZK";
const MAJOR_CRYPTO_CURRENCIES = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT", "LTC", "LINK",
  "AVAX", "MATIC", "TRX", "BCH", "XLM", "ATOM", "UNI", "NEAR", "ETC", "ICP"
];
const CRYPTO_API_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LTC: "litecoin",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  TRX: "tron",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  ATOM: "cosmos",
  UNI: "uniswap",
  NEAR: "near",
  ETC: "ethereum-classic",
  ICP: "internet-computer"
};
const FIAT_CURRENCIES = typeof Intl.supportedValuesOf === "function"
  ? Intl.supportedValuesOf("currency")
  : ["CZK", "USD", "EUR", "GBP", "CHF", "JPY", "AUD", "CAD", "NOK", "SEK", "PLN", "HUF"];
const SUPPORTED_CURRENCIES = Array.from(new Set([...FIAT_CURRENCIES, ...MAJOR_CRYPTO_CURRENCIES])).sort();
const DEFAULT_FAVORITE_CURRENCIES = ["CZK", "USD", "EUR", "BTC"];
const DEFAULT_RATES_TO_CZK = {
  CZK: 1,
  USD: 23,
  EUR: 25,
  BTC: 2200000,
  ETH: 120000,
  SOL: 2500,
  BNB: 13000,
  XRP: 13,
  ADA: 15,
  DOGE: 3,
  DOT: 160,
  LTC: 1800,
  LINK: 450,
  AVAX: 900,
  MATIC: 20,
  TRX: 3,
  BCH: 12000,
  XLM: 3,
  ATOM: 220,
  UNI: 280,
  NEAR: 140,
  ETC: 650,
  ICP: 260
};

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
  goalTimeline: [],
  settings: {
    mainCurrency: DEFAULT_MAIN_CURRENCY,
    favoriteCurrencies: DEFAULT_FAVORITE_CURRENCIES,
    ratesToCzk: DEFAULT_RATES_TO_CZK,
    ratesUpdatedAt: 0
  }
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
  appCurrencySelect: document.getElementById("appCurrencySelect"),
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
  entryCategoryWrap: document.getElementById("entryCategoryWrap"),
  entryCategory: document.getElementById("entryCategory"),
  entryPeriodic: document.getElementById("entryPeriodic"),
  incomeList: document.getElementById("incomeList"),
  expenseList: document.getElementById("expenseList"),
  investmentList: document.getElementById("investmentList"),
  assetForm: document.getElementById("assetForm"),
  assetName: document.getElementById("assetName"),
  assetValue: document.getElementById("assetValue"),
  assetCurrency: document.getElementById("assetCurrency"),
  assetIsCash: document.getElementById("assetIsCash"),
  manageFavoritesBtn: document.getElementById("manageFavoritesBtn"),
  favoritesSummary: document.getElementById("favoritesSummary"),
  refreshRatesBtn: document.getElementById("refreshRatesBtn"),
  ratesStatus: document.getElementById("ratesStatus"),
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

  ensureCurrencySettings();
  ensureMonth(els.monthSelect.value);
  ensureGoalTimeline();
  initCurrencyUi();
  wireEvents();
  registerSW();
  await refreshExchangeRates({ silent: true, auto: true });
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

  if (els.appCurrencySelect) {
    els.appCurrencySelect.addEventListener("change", onMainCurrencyChange);
  }

  if (els.manageFavoritesBtn) {
    els.manageFavoritesBtn.addEventListener("click", onManageFavoritesClick);
  }

  if (els.refreshRatesBtn) {
    els.refreshRatesBtn.addEventListener("click", refreshExchangeRates);
  }

  if (els.startNextMonthBtn) {
    els.startNextMonthBtn.addEventListener("click", onStartNextMonthClick);
  }

  els.entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const type = els.entryType.value;
    addEntry({
      month: els.monthSelect.value,
      type,
      name: els.entryName.value.trim(),
      amount: Number(els.entryAmount.value),
      periodic: els.entryPeriodic.checked,
      category: type === "expense" ? normalizeExpenseCategory(els.entryCategory && els.entryCategory.value) : ""
    });
    els.entryForm.reset();
    onEntryTypeChange();
    render();
  });

  els.entryType.addEventListener("change", onEntryTypeChange);
  onEntryTypeChange();

  els.assetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addAsset({
      month: els.monthSelect.value,
      name: els.assetName.value.trim(),
      value: Number(els.assetValue.value),
      currency: els.assetCurrency ? els.assetCurrency.value : getMainCurrency(),
      isCash: Boolean(els.assetIsCash && els.assetIsCash.checked)
    });
    els.assetForm.reset();
    if (els.assetCurrency) {
      els.assetCurrency.value = getMainCurrency();
    }
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

function addEntry({ month, type, name, amount, periodic, category }) {
  if (!month || !name || Number.isNaN(amount)) return;
  ensureMonth(month);

  const id = createId();
  const item = { id, name, amount, periodic, createdAt: Date.now() };
  const normalizedCategory = type === "expense" ? normalizeExpenseCategory(category) : "";
  if (normalizedCategory) item.category = normalizedCategory;

  if (type === "income") state.months[month].income.push(item);
  if (type === "expense") state.months[month].expense.push(item);
  if (type === "investment") state.months[month].investment.push(item);

  saveState();
}

function addAsset({ month, name, value, currency, isCash }) {
  if (!month || !name || Number.isNaN(value)) return;
  ensureMonth(month);
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const convertedValue = convertAmountToMainCurrency(value, normalizedCurrency);
  state.months[month].assets.push({
    id: createId(),
    name,
    amount: value,
    currency: normalizedCurrency,
    value: convertedValue,
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
      const sourceEntryId = resolveSourceEntryId(item);
      const periodicKey = buildPeriodicKey(type, item, sourceEntryId);
      state.months[month][type].push({
        id: createId(),
        name: item.name,
        amount: item.amount,
        category: normalizeExpenseCategory(item.category),
        periodic: true,
        carriedFrom: previous,
        sourceEntryId,
        sourcePeriodicKey: periodicKey,
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
        .map((item) => item.sourcePeriodicKey || buildPeriodicKey(type, item))
    );

    const periodicFromPrev = state.months[previous][type].filter((item) => item.periodic);
    periodicFromPrev.forEach((item) => {
      const sourceEntryId = resolveSourceEntryId(item);
      const key = buildPeriodicKey(type, item, sourceEntryId);
      if (existingKeys.has(key)) return;

      current.push({
        id: createId(),
        name: item.name,
        amount: item.amount,
        category: normalizeExpenseCategory(item.category),
        periodic: true,
        carriedFrom: previous,
        sourceEntryId,
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

  const confirmed = confirm(`Přepnout na ${nextMonth} a přenést všechny položky z ${currentMonth}?`);
  if (!confirmed) return;

  ensureMonth(currentMonth);
  ensureMonth(nextMonth);
  carryAllEntriesToNextMonth(currentMonth, nextMonth);
  carryAssetsToNextMonth(currentMonth, nextMonth);

  els.monthSelect.value = nextMonth;
  saveState();
  render();
  setStatus(`Vytvořen měsíc ${nextMonth} a všechny položky přeneseny z ${currentMonth}.`);
}

function carryAllEntriesToNextMonth(fromMonth, toMonth) {
  ["income", "expense", "investment"].forEach((type) => {
    const source = (state.months[fromMonth] && state.months[fromMonth][type]) || [];
    const target = (state.months[toMonth] && state.months[toMonth][type]) || [];

    const existingKeys = new Set(
      target.map((item) => item.sourceCarryKey || `${type}|${resolveSourceEntryId(item)}`)
    );

    source.forEach((item) => {
      const sourceEntryId = resolveSourceEntryId(item);
      const sourceCarryKey = `${type}|${sourceEntryId}`;
      if (existingKeys.has(sourceCarryKey)) return;

      const nextItem = {
        id: createId(),
        name: item.name,
        amount: Number(item.amount) || 0,
        periodic: Boolean(item.periodic),
        category: normalizeExpenseCategory(item.category),
        carriedFrom: fromMonth,
        sourceEntryId,
        sourceCarryKey,
        createdAt: Date.now()
      };

      if (!nextItem.category) delete nextItem.category;
      if (!nextItem.periodic) delete nextItem.sourcePeriodicKey;
      if (nextItem.periodic) {
        nextItem.sourcePeriodicKey = buildPeriodicKey(type, nextItem, sourceEntryId);
      }

      target.push(nextItem);
      existingKeys.add(sourceCarryKey);
    });
  });
}

function carryAssetsToNextMonth(fromMonth, toMonth) {
  const source = (state.months[fromMonth] && state.months[fromMonth].assets) || [];
  const target = (state.months[toMonth] && state.months[toMonth].assets) || [];

  const existingKeys = new Set(target.map((item) => item.sourceAssetKey || resolveSourceAssetId(item)));

  source.forEach((item) => {
    const sourceAssetKey = resolveSourceAssetId(item);
    if (existingKeys.has(sourceAssetKey)) return;

    const amount = getAssetAmount(item);
    const currency = getAssetCurrency(item);

    target.push({
      id: createId(),
      name: item.name,
      amount,
      currency,
      value: convertAmountToMainCurrency(amount, currency),
      isCash: isCashAsset(item),
      carriedFrom: fromMonth,
      sourceAssetId: sourceAssetKey,
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

  if (periodicItems.length) {
    const periodicHeader = document.createElement("li");
    periodicHeader.className = "entry-section-header";
    periodicHeader.innerHTML = "<small>Periodical</small>";
    listEl.appendChild(periodicHeader);
  }

  const appendEntryRow = (item) => {
    const li = document.createElement("li");
    li.className = item.periodic ? "periodic-item" : "one-time-item";
    const periodicBadge = item.periodic
      ? '<small class="item-badge periodic-badge">PERIODICAL</small>'
      : '<small class="item-badge onetime-badge">ONE-TIME</small>';
    const categoryLine = type === "expense" && normalizeExpenseCategory(item.category)
      ? `<small class="item-category-line">${escapeHtml(normalizeExpenseCategory(item.category))}</small>`
      : "";
    const autoText = item.carriedFrom ? `<small>(auto z ${item.carriedFrom})</small>` : "";
    li.innerHTML = `
      <span>
        ${escapeHtml(item.name)}
        ${item.periodic !== undefined ? periodicBadge : ""}
        ${categoryLine}
        ${autoText}
      </span>
      <span class="row-actions">
        <strong>${formatCurrency(item.amount || 0)}</strong>
        <button data-action="edit-entry" data-month="${month}" data-type="${type}" data-id="${item.id}" type="button">Upravit</button>
        <button data-action="delete-entry" data-month="${month}" data-type="${type}" data-id="${item.id}" type="button" class="danger">Smazat</button>
      </span>
    `;
    listEl.appendChild(li);
  };

  periodicItems.forEach(appendEntryRow);

  if (type === "expense") {
    renderExpenseSummarySection(listEl, periodicItems, "Součet periodických výdajů", "periodic");
  }

  if (oneTimeItems.length) {
    const oneTimeHeader = document.createElement("li");
    oneTimeHeader.className = "entry-section-header";
    oneTimeHeader.innerHTML = "<small>One-time</small>";
    listEl.appendChild(oneTimeHeader);
  }

  oneTimeItems.forEach(appendEntryRow);

  if (type === "expense") {
    renderExpenseSummarySection(listEl, items, "Celkem výdaje (vč. one-time)", "overall");
  }

  if (type === "investment") {
    renderInvestmentSummarySection(listEl, month, items);
  }

  bindRowActions(listEl);
}

function renderInvestmentSummarySection(listEl, month, investmentItems) {
  const totalInvestment = sumBy(investmentItems, "amount");
  const monthData = state.months[month] || { income: [] };
  const incomeTotal = sumBy(monthData.income || [], "amount");
  const ratio = incomeTotal > 0 ? (totalInvestment / incomeTotal) * 100 : 0;

  const header = document.createElement("li");
  header.className = "entry-section-header";
  header.innerHTML = "<small>Investment summary</small>";
  listEl.appendChild(header);

  const totalRow = document.createElement("li");
  totalRow.className = "investment-summary";
  totalRow.innerHTML = `
    <span>Total investments</span>
    <span class="row-actions"><strong>${formatCurrency(totalInvestment)}</strong></span>
  `;
  listEl.appendChild(totalRow);

  const ratioRow = document.createElement("li");
  ratioRow.className = "investment-summary";
  ratioRow.innerHTML = `
    <span>Investment/Income ratio</span>
    <span class="row-actions"><strong>${formatPercent(ratio)}</strong></span>
  `;
  listEl.appendChild(ratioRow);
}

function renderExpenseSummarySection(listEl, expenseItems, title, mode) {
  const total = sumBy(expenseItems, "amount");
  const summaryHeader = document.createElement("li");
  summaryHeader.className = "entry-section-header";
  summaryHeader.innerHTML = `<small>${escapeHtml(title)}</small>`;
  listEl.appendChild(summaryHeader);

  const totalRow = document.createElement("li");
  totalRow.className = `expense-summary expense-summary-total expense-summary-${mode}`;
  totalRow.innerHTML = `
    <span>Overall sum</span>
    <span class="row-actions"><strong>${formatCurrency(total)}</strong></span>
  `;
  listEl.appendChild(totalRow);

  const categoryTotals = getExpenseCategoryTotals(expenseItems);
  Object.keys(categoryTotals).sort((left, right) => left.localeCompare(right, "cs")).forEach((category) => {
    const row = document.createElement("li");
    row.className = `expense-summary expense-summary-category expense-summary-${mode}`;
    row.innerHTML = `
      <span>${escapeHtml(category)}</span>
      <span class="row-actions"><strong>${formatCurrency(categoryTotals[category])}</strong></span>
    `;
    listEl.appendChild(row);
  });
}

function getExpenseCategoryTotals(expenseItems) {
  return expenseItems.reduce((acc, item) => {
    const category = normalizeExpenseCategory(item.category);
    if (!category) return acc;
    acc[category] = (acc[category] || 0) + (Number(item.amount) || 0);
    return acc;
  }, {});
}

function onEntryTypeChange() {
  const isExpense = els.entryType && els.entryType.value === "expense";
  if (els.entryCategoryWrap) {
    els.entryCategoryWrap.hidden = !isExpense;
  }
  if (!isExpense && els.entryCategory) {
    els.entryCategory.value = "";
  }
}

function ensureCurrencySettings() {
  if (!state.settings || typeof state.settings !== "object") {
    state.settings = {};
  }

  state.settings.mainCurrency = normalizeCurrencyCode(state.settings.mainCurrency || DEFAULT_MAIN_CURRENCY);
  const favoriteSource = Array.isArray(state.settings.favoriteCurrencies)
    ? state.settings.favoriteCurrencies
    : DEFAULT_FAVORITE_CURRENCIES;
  state.settings.favoriteCurrencies = Array.from(new Set(favoriteSource.map(normalizeCurrencyCode)))
    .filter((code) => SUPPORTED_CURRENCIES.includes(code));

  if (!state.settings.favoriteCurrencies.length) {
    state.settings.favoriteCurrencies = DEFAULT_FAVORITE_CURRENCIES.slice();
  }

  state.settings.ratesToCzk = {
    ...DEFAULT_RATES_TO_CZK,
    ...(state.settings.ratesToCzk || {})
  };

  state.settings.ratesUpdatedAt = Number(state.settings.ratesUpdatedAt || 0);
}

function initCurrencyUi() {
  renderCurrencySelectors();
  renderFavoriteCurrencies();
  updateRatesStatus();
}

function onMainCurrencyChange() {
  if (!els.appCurrencySelect) return;
  state.settings.mainCurrency = normalizeCurrencyCode(els.appCurrencySelect.value);
  saveState();
  renderCurrencySelectors();
  render();
}

async function onManageFavoritesClick() {
  const selected = await showFavoriteCurrenciesModal(state.settings.favoriteCurrencies || []);
  if (!selected) return;

  const fallback = selected.length ? selected : [getMainCurrency()];
  state.settings.favoriteCurrencies = Array.from(new Set(fallback.map(normalizeCurrencyCode)));
  saveState();
  renderCurrencySelectors();
  renderFavoriteCurrencies();
}

function renderCurrencySelectors() {
  const options = getCurrencySelectOptions();

  if (els.appCurrencySelect) {
    els.appCurrencySelect.innerHTML = "";
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      els.appCurrencySelect.appendChild(option);
    });
    els.appCurrencySelect.value = getMainCurrency();
  }

  if (els.assetCurrency) {
    const current = normalizeCurrencyCode(els.assetCurrency.value || getMainCurrency());
    els.assetCurrency.innerHTML = "";
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      els.assetCurrency.appendChild(option);
    });
    els.assetCurrency.value = SUPPORTED_CURRENCIES.includes(current) ? current : getMainCurrency();
  }
}

function renderFavoriteCurrencies() {
  if (!els.favoritesSummary) return;
  const selected = state.settings.favoriteCurrencies || [];
  if (!selected.length) {
    els.favoritesSummary.textContent = "No favorites selected";
    return;
  }

  const preview = selected.slice(0, 6).join(", ");
  const suffix = selected.length > 6 ? ` +${selected.length - 6}` : "";
  els.favoritesSummary.textContent = `${preview}${suffix}`;
}

function showFavoriteCurrenciesModal(initialSelection) {
  return new Promise((resolve) => {
    const selected = new Set((initialSelection || []).map(normalizeCurrencyCode));
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("form");
    modal.className = "modal-card";
    modal.noValidate = true;

    const titleEl = document.createElement("h3");
    titleEl.textContent = "Favorite currencies";
    modal.appendChild(titleEl);

    const info = document.createElement("small");
    info.textContent = "Choose favorites (used at top of currency selectors).";
    modal.appendChild(info);

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search currency...";
    modal.appendChild(search);

    const listWrap = document.createElement("div");
    listWrap.className = "currency-picker-grid";
    modal.appendChild(listWrap);

    const renderItems = () => {
      const query = String(search.value || "").trim().toLowerCase();
      listWrap.innerHTML = "";

      const filtered = (codes) => codes.filter((code) => !query || code.toLowerCase().includes(query));
      const favoriteCodes = filtered(state.settings.favoriteCurrencies || []);
      const cryptoCodes = filtered(MAJOR_CRYPTO_CURRENCIES);
      const cryptoSet = new Set(MAJOR_CRYPTO_CURRENCIES);
      const fiatCodes = filtered(SUPPORTED_CURRENCIES.filter((code) => !cryptoSet.has(code)));

      const appendGroup = (title, codes) => {
        if (!codes.length) return;

        const groupTitle = document.createElement("div");
        groupTitle.className = "currency-picker-group-title";
        groupTitle.textContent = title;
        listWrap.appendChild(groupTitle);

        codes.forEach((code) => {
          const label = document.createElement("label");
          label.className = "inline compact-inline currency-picker-item";

          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = code;
          input.checked = selected.has(code);
          input.addEventListener("change", () => {
            if (input.checked) selected.add(code);
            else selected.delete(code);
          });

          label.appendChild(input);
          label.append(` ${code}`);
          listWrap.appendChild(label);
        });
      };

      appendGroup("Favorites", favoriteCodes);
      appendGroup("Fiat", fiatCodes);
      appendGroup("Crypto", cryptoCodes);

      if (!listWrap.children.length) {
        const empty = document.createElement("small");
        empty.className = "currency-picker-empty";
        empty.textContent = "No currencies found.";
        listWrap.appendChild(empty);
      }
    };

    search.addEventListener("input", renderItems);
    renderItems();

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "danger";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.textContent = "Save";

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const closeWith = (value) => {
      backdrop.remove();
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => closeWith(null));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeWith(null);
    });
    modal.addEventListener("submit", (event) => {
      event.preventDefault();
      closeWith(Array.from(selected));
    });

    search.focus();
  });
}

function getCurrencySelectOptions() {
  const favorites = new Set(state.settings.favoriteCurrencies || []);
  const ordered = [];

  (state.settings.favoriteCurrencies || []).forEach((code) => {
    if (SUPPORTED_CURRENCIES.includes(code) && !ordered.includes(code)) ordered.push(code);
  });

  SUPPORTED_CURRENCIES.forEach((code) => {
    if (!ordered.includes(code)) ordered.push(code);
  });

  return ordered.map((code) => ({
    value: code,
    label: favorites.has(code) ? `${code} ★` : code
  }));
}

async function refreshExchangeRates(options = {}) {
  const { silent = false, auto = false } = options;

  if (auto && Number(state.settings.ratesUpdatedAt || 0) > 0) {
    const ageMs = Date.now() - Number(state.settings.ratesUpdatedAt || 0);
    const oneHour = 60 * 60 * 1000;
    if (ageMs < oneHour) {
      updateRatesStatus();
      return;
    }
  }

  if (els.refreshRatesBtn) els.refreshRatesBtn.disabled = true;
  try {
    const [fiatResponse, cryptoResponse] = await Promise.all([
      fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }),
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(CRYPTO_API_IDS).join(",")}&vs_currencies=czk`, { cache: "no-store" })
    ]);

    if (!fiatResponse.ok || !cryptoResponse.ok) {
      throw new Error("Rate API error");
    }

    const fiatJson = await fiatResponse.json();
    const cryptoJson = await cryptoResponse.json();
    const fiatRates = fiatJson && fiatJson.rates ? fiatJson.rates : null;

    if (!fiatRates || !fiatRates.CZK || !fiatRates.USD) {
      throw new Error("Missing FX rates");
    }

    const usdToCzk = Number(fiatRates.CZK);
    const newRates = {
      ...state.settings.ratesToCzk,
      CZK: 1,
      USD: usdToCzk
    };

    FIAT_CURRENCIES.forEach((code) => {
      if (code === "CZK") {
        newRates.CZK = 1;
        return;
      }
      const usdToCurrency = Number(fiatRates[code]);
      if (!Number.isFinite(usdToCurrency) || usdToCurrency <= 0) return;
      newRates[code] = usdToCzk / usdToCurrency;
    });

    Object.entries(CRYPTO_API_IDS).forEach(([code, id]) => {
      const czk = Number(cryptoJson?.[id]?.czk);
      if (Number.isFinite(czk) && czk > 0) {
        newRates[code] = czk;
      }
    });

    state.settings.ratesToCzk = newRates;
    state.settings.ratesUpdatedAt = Date.now();

    saveState();
    updateRatesStatus(silent ? "" : "Rates updated.");
    render();
  } catch {
    if (!silent) updateRatesStatus("Rate refresh failed. Using saved rates.");
  } finally {
    if (els.refreshRatesBtn) els.refreshRatesBtn.disabled = false;
  }
}

function updateRatesStatus(prefix = "") {
  if (!els.ratesStatus) return;
  const updatedAt = Number(state.settings.ratesUpdatedAt || 0);
  if (!updatedAt) {
    els.ratesStatus.textContent = prefix || "Using default rates.";
    return;
  }

  const timeText = new Date(updatedAt).toLocaleString("cs-CZ");
  const usd = Number(getRateToCzk("USD") || 0).toFixed(2);
  const eur = Number(getRateToCzk("EUR") || 0).toFixed(2);
  const btc = Number(getRateToCzk("BTC") || 0).toLocaleString("cs-CZ", { maximumFractionDigits: 0 });
  els.ratesStatus.textContent = `${prefix ? `${prefix} ` : ""}Last update: ${timeText} | USD/CZK ${usd} | EUR/CZK ${eur} | BTC/CZK ${btc}`;
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
    const assetCurrency = getAssetCurrency(item);
    const assetAmount = getAssetAmount(item);
    const converted = getAssetValueInMainCurrency(item);
    const originalLine = assetCurrency === getMainCurrency()
      ? ""
      : `<small>${formatCurrency(assetAmount, assetCurrency, { maxFractionDigits: 4, minFractionDigits: 0 })}</small>`;
    li.innerHTML = `
      <span>${escapeHtml(item.name)} ${cashTag}</span>
      <span class="row-actions">
        <strong>${formatCurrency(converted)}</strong>
        ${originalLine}
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

async function editEntry(month, type, id) {
  const list = state.months[month] && state.months[month][type] ? state.months[month][type] : [];
  const item = list.find((row) => row.id === id);
  if (!item) return;

  const fields = [
    { key: "name", label: "Název", type: "text", value: item.name || "", required: true },
    { key: "amount", label: "Částka (Kč)", type: "number", value: String(item.amount ?? ""), required: true },
    { key: "periodic", label: "Periodical", type: "checkbox", value: Boolean(item.periodic) }
  ];

  if (type === "expense") {
    fields.push({
      key: "category",
      label: "Kategorie výdaje",
      type: "text",
      value: normalizeExpenseCategory(item.category)
    });
  }

  const edited = await showEditModal({
    title: type === "expense" ? "Upravit výdaj" : type === "income" ? "Upravit příjem" : "Upravit investici",
    fields,
    submitText: "Uložit"
  });
  if (!edited) return;

  const name = String(edited.name || "").trim();
  const amount = Number(edited.amount);
  if (!name || Number.isNaN(amount)) return;

  item.name = name;
  item.amount = amount;
  item.periodic = Boolean(edited.periodic);
  if (type === "expense") {
    const category = normalizeExpenseCategory(edited.category);
    if (category) item.category = category;
    else delete item.category;
  } else {
    delete item.category;
  }
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

async function editAsset(month, id) {
  const list = state.months[month] && state.months[month].assets ? state.months[month].assets : [];
  const item = list.find((row) => row.id === id);
  if (!item) return;

  const edited = await showEditModal({
    title: "Upravit asset",
    fields: [
      { key: "name", label: "Název asset", type: "text", value: item.name || "", required: true },
      { key: "value", label: "Amount", type: "number", value: String(getAssetAmount(item) ?? ""), required: true, step: "0.0001" },
      {
        key: "currency",
        label: "Měna",
        type: "select",
        value: getAssetCurrency(item),
        options: getCurrencySelectOptions()
      },
      { key: "isCash", label: "Cash asset", type: "checkbox", value: isCashAsset(item) }
    ],
    submitText: "Uložit"
  });
  if (!edited) return;

  const name = String(edited.name || "").trim();
  const value = Number(edited.value);
  const currency = normalizeCurrencyCode(edited.currency);
  if (!name || Number.isNaN(value)) return;

  item.name = name;
  item.amount = value;
  item.currency = currency;
  item.value = convertAmountToMainCurrency(value, currency);
  item.isCash = Boolean(edited.isCash);
  item.updatedAt = Date.now();

  saveState();
  render();
}

function showEditModal({ title, fields, submitText = "Save" }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("form");
    modal.className = "modal-card";
    modal.noValidate = true;

    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    modal.appendChild(titleEl);

    fields.forEach((field) => {
      const row = document.createElement("label");
      row.className = field.type === "checkbox" ? "inline" : "stack";
      row.textContent = field.label;

      if (field.type === "select") {
        const select = document.createElement("select");
        select.name = field.key;
        (field.options || []).forEach((optionData) => {
          const option = document.createElement("option");
          option.value = optionData.value;
          option.textContent = optionData.label;
          select.appendChild(option);
        });
        select.value = String(field.value || "");
        row.appendChild(select);
      } else {
        const input = document.createElement("input");
        input.name = field.key;
        input.type = field.type === "number" ? "number" : field.type === "checkbox" ? "checkbox" : "text";
        if (input.type === "number") input.step = field.step || "0.01";

        if (input.type === "checkbox") {
          input.checked = Boolean(field.value);
        } else {
          input.value = String(field.value || "");
        }

        if (field.required) input.required = true;
        row.appendChild(input);
      }
      modal.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "danger";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.textContent = submitText;

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const closeWith = (value) => {
      backdrop.remove();
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => closeWith(null));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeWith(null);
    });

    modal.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = {};
      fields.forEach((field) => {
        const control = modal.elements.namedItem(field.key);
        if (control instanceof HTMLInputElement) {
          payload[field.key] = control.type === "checkbox" ? control.checked : control.value;
          return;
        }
        if (control instanceof HTMLSelectElement) {
          payload[field.key] = control.value;
        }
      });
      closeWith(payload);
    });

    const firstInput = modal.querySelector("input");
    if (firstInput instanceof HTMLInputElement) firstInput.focus();
  });
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
  const localAssets = (monthData.assets || []).reduce((sum, item) => sum + getAssetValueInMainCurrency(item), 0);
  const localFreeCash = monthData.assets
    .filter((item) => isCashAsset(item))
    .reduce((sum, item) => sum + getAssetValueInMainCurrency(item), 0);

  const imported = state.importedSummaries[month] || {};
  ensureGoalMonth(month);
  const monthGoal = state.monthGoals[month] || {};

  const importedIncome = convertAmountToMainCurrency(imported.income || 0, "CZK");
  const importedExpense = convertAmountToMainCurrency(imported.expense || 0, "CZK");
  const importedInvestment = convertAmountToMainCurrency(imported.investment || 0, "CZK");
  const importedAssets = convertAmountToMainCurrency(imported.assets || 0, "CZK");
  const importedGoal = convertAmountToMainCurrency(imported.goal || 0, "CZK");
  const importedPredikce = convertAmountToMainCurrency(imported.predikce || 0, "CZK");
  const importedAssetChange = convertAmountToMainCurrency(imported.assetChange || 0, "CZK");
  const importedAssetGoal = convertAmountToMainCurrency(imported.assetGoal || 0, "CZK");
  const importedAssetPrediction = convertAmountToMainCurrency(imported.assetPrediction || 0, "CZK");
  const importedFreeCash = convertAmountToMainCurrency(imported.freeCash || 0, "CZK");
  const importedPassiveCf = convertAmountToMainCurrency(imported.passiveCf || 0, "CZK");
  const importedPassiveIncome = convertAmountToMainCurrency(imported.passiveIncome || 0, "CZK");

  const income = localIncome || importedIncome || 0;
  const expense = localExpense || importedExpense || 0;
  const investment = localInvestment || importedInvestment || 0;
  const assets = localAssets || importedAssets || 0;

  return {
    income,
    expense,
    investment,
    assets,
    cashflow: income - expense,
    realita: convertAmountToMainCurrency(imported.realita || 0, "CZK"),
    goal: Number(monthGoal.goal || importedGoal || 0),
    predikce: Number(monthGoal.predikce || importedPredikce || 0),
    assetChange: importedAssetChange || 0,
    assetGoal: Number(monthGoal.assetGoal || importedAssetGoal || 0),
    assetPrediction: Number(monthGoal.assetPrediction || importedAssetPrediction || 0),
    freeCash: localFreeCash || importedFreeCash || 0,
    passiveCf: importedPassiveCf || 0,
    passiveIncome: importedPassiveIncome || 0,
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
    existing.amount = value;
    existing.currency = "CZK";
    existing.value = value;
    existing.isCash = Boolean(isCash);
    existing.updatedAt = Date.now();
    return;
  }

  list.push({
    id: createId(),
    name,
    amount: value,
    currency: "CZK",
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

function normalizeExpenseCategory(value) {
  return String(value || "").trim();
}

function normalizeCurrencyCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : DEFAULT_MAIN_CURRENCY;
}

function getMainCurrency() {
  return normalizeCurrencyCode(state.settings && state.settings.mainCurrency);
}

function getRateToCzk(currencyCode) {
  const code = normalizeCurrencyCode(currencyCode);
  const rates = (state.settings && state.settings.ratesToCzk) || DEFAULT_RATES_TO_CZK;
  const rate = Number(rates[code]);
  if (Number.isFinite(rate) && rate > 0) return rate;
  const fallback = Number(DEFAULT_RATES_TO_CZK[code]);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

function convertAmountToMainCurrency(amount, fromCurrency) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return 0;
  const sourceCurrency = normalizeCurrencyCode(fromCurrency);
  const mainCurrency = getMainCurrency();
  if (sourceCurrency === mainCurrency) return value;

  const sourceRate = getRateToCzk(sourceCurrency);
  const targetRate = getRateToCzk(mainCurrency);
  if (!sourceRate || !targetRate) return value;

  const czkValue = value * sourceRate;
  return czkValue / targetRate;
}

function getAssetCurrency(asset) {
  return normalizeCurrencyCode(asset && asset.currency ? asset.currency : "CZK");
}

function getAssetAmount(asset) {
  if (!asset) return 0;
  const amount = Number(asset.amount);
  if (Number.isFinite(amount)) return amount;
  const legacy = Number(asset.value);
  return Number.isFinite(legacy) ? legacy : 0;
}

function getAssetValueInMainCurrency(asset) {
  if (!asset) return 0;
  return convertAmountToMainCurrency(getAssetAmount(asset), getAssetCurrency(asset));
}

function resolveSourceEntryId(item) {
  return item && (item.sourceEntryId || item.id) ? String(item.sourceEntryId || item.id) : createId();
}

function resolveSourceAssetId(item) {
  if (!item) return createId();
  if (item.sourceAssetId) return String(item.sourceAssetId);
  if (item.id) return String(item.id);
  return `${String(item.name || "asset")}|${String(item.value || 0)}`;
}

function buildPeriodicKey(type, item, sourceEntryId = resolveSourceEntryId(item)) {
  const categoryPart = type === "expense" ? `|${normalizeExpenseCategory(item.category)}` : "";
  return `${type}|${sourceEntryId}|${item.name}|${item.amount}${categoryPart}`;
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
    const settings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
    return {
      version: 1,
      historicalImportVersion: Number(parsed.historicalImportVersion || 0),
      months: parsed.months && typeof parsed.months === "object" ? parsed.months : {},
      importedSummaries: parsed.importedSummaries && typeof parsed.importedSummaries === "object" ? parsed.importedSummaries : {},
      monthGoals: parsed.monthGoals && typeof parsed.monthGoals === "object" ? parsed.monthGoals : {},
      goalTimeline: Array.isArray(parsed.goalTimeline) ? parsed.goalTimeline : [],
      settings: {
        mainCurrency: normalizeCurrencyCode(settings.mainCurrency || DEFAULT_MAIN_CURRENCY),
        favoriteCurrencies: Array.isArray(settings.favoriteCurrencies)
          ? settings.favoriteCurrencies.map(normalizeCurrencyCode)
          : DEFAULT_FAVORITE_CURRENCIES,
        ratesToCzk: {
          ...DEFAULT_RATES_TO_CZK,
          ...(settings.ratesToCzk || {})
        },
        ratesUpdatedAt: Number(settings.ratesUpdatedAt || 0)
      }
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

function formatCurrency(value, currency = getMainCurrency(), options = {}) {
  const numeric = Number(value || 0);
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const defaultMaxDigits = normalizedCurrency === "BTC" || normalizedCurrency === "ETH" ? 6 : 2;
  const maxDigits = Number.isFinite(Number(options.maxFractionDigits))
    ? Number(options.maxFractionDigits)
    : defaultMaxDigits;
  const minDigits = Number.isFinite(Number(options.minFractionDigits))
    ? Number(options.minFractionDigits)
    : 0;

  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: maxDigits,
      minimumFractionDigits: minDigits
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(maxDigits)} ${normalizedCurrency}`;
  }
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
