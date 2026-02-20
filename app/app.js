const STORAGE_KEY = "pf_app_v1";
const APP_VERSION = "v1.0.3";
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
let viewportRenderTimeout = null;
const els = {
  runtimeError: document.getElementById("runtimeError"),
  tabs: document.getElementById("tabs"),
  panels: document.querySelectorAll(".panel"),
  monthSelect: document.getElementById("monthSelect"),
  startNextMonthBtn: document.getElementById("startNextMonthBtn"),
  appCurrencySelect: document.getElementById("appCurrencySelect"),
  appVersionLabel: document.getElementById("appVersionLabel"),
  activeMonthLabel: document.getElementById("activeMonthLabel"),
  kpiIncome: document.getElementById("kpiIncome"),
  kpiExpense: document.getElementById("kpiExpense"),
  kpiInvest: document.getElementById("kpiInvest"),
  kpiCashflow: document.getElementById("kpiCashflow"),
  kpiAssets: document.getElementById("kpiAssets"),
  kpiPassiveCf: document.getElementById("kpiPassiveCf"),
  kpiInvestIncomeRatio: document.getElementById("kpiInvestIncomeRatio"),
  kpiFreeCash: document.getElementById("kpiFreeCash"),
  kpiAssetChange: document.getElementById("kpiAssetChange"),
  entryForm: document.getElementById("entryForm"),
  entryType: document.getElementById("entryType"),
  entryName: document.getElementById("entryName"),
  entryAmount: document.getElementById("entryAmount"),
  entryCategoryWrap: document.getElementById("entryCategoryWrap"),
  entryCategory: document.getElementById("entryCategory"),
  entryPassiveWrap: document.getElementById("entryPassiveWrap"),
  entryPassive: document.getElementById("entryPassive"),
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
  cashflowChart: document.getElementById("cashflowChart"),
  incomeChart: document.getElementById("incomeChart"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  importJsonInput: document.getElementById("importJsonInput"),
  refreshCacheBtn: document.getElementById("refreshCacheBtn"),
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

  if (els.appVersionLabel) {
    els.appVersionLabel.textContent = `Version ${APP_VERSION}`;
  }

  ensureCurrencySettings();
  ensureMonth(els.monthSelect.value);
  ensureGoalTimeline();
  initCurrencyUi();
  wireEvents();
  registerSW();
  await refreshExchangeRates({ silent: true, auto: true });
  render();
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
      isPassive: type === "income" ? Boolean(els.entryPassive && els.entryPassive.checked) : false,
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
  els.goalTableBody.addEventListener("change", onGoalTableInputChange);
  els.goalTableBody.addEventListener("focusin", onGoalTableInputFocusIn);
  els.goalTableBody.addEventListener("focusout", onGoalTableInputFocusOut);

  els.exportJsonBtn.addEventListener("click", exportJson);
  els.importJsonInput.addEventListener("change", importJson);

  if (els.refreshCacheBtn) {
    els.refreshCacheBtn.addEventListener("click", refreshAppCache);
  }

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Do you really want to delete all local data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  const onViewportChange = () => {
    if (viewportRenderTimeout) clearTimeout(viewportRenderTimeout);
    viewportRenderTimeout = setTimeout(() => {
      render();
    }, 120);
  };

  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", onViewportChange);
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

function addEntry({ month, type, name, amount, periodic, category, isPassive }) {
  if (!month || !name || Number.isNaN(amount)) return;
  ensureMonth(month);

  const id = createId();
  const item = { id, name, amount, periodic, createdAt: Date.now() };
  const normalizedCategory = type === "expense" ? normalizeExpenseCategory(category) : "";
  if (normalizedCategory) item.category = normalizedCategory;
  if (type === "income") item.isPassive = Boolean(isPassive);

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
        isPassive: Boolean(type === "income" && item.isPassive),
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
        isPassive: Boolean(type === "income" && item.isPassive),
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
    setStatus("Cannot compute next month.");
    return;
  }

  const confirmed = confirm(`Switch to ${nextMonth} and carry all items from ${currentMonth}?`);
  if (!confirmed) return;

  ensureMonth(currentMonth);
  ensureMonth(nextMonth);
  carryAllEntriesToNextMonth(currentMonth, nextMonth);
  carryAssetsToNextMonth(currentMonth, nextMonth);

  els.monthSelect.value = nextMonth;
  saveState();
  render();
  setStatus(`Month ${nextMonth} created and all items carried from ${currentMonth}.`);
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
        isPassive: Boolean(type === "income" && item.isPassive),
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

  setKpiWithYearly(els.kpiIncome, totals.income);
  setKpiWithYearly(els.kpiExpense, totals.expense);
  setKpiWithYearly(els.kpiInvest, totals.investment);
  setKpiWithYearly(els.kpiCashflow, totals.cashflow);
  setKpiWithSideMeta(els.kpiAssets, totals.assets, [
    { label: "Asset goal", value: totals.goal, reached: totals.assets >= totals.goal },
    { label: "Asset prediction", value: totals.predikce, reached: totals.assets >= totals.predikce }
  ]);
  setKpiWithYearly(els.kpiPassiveCf, totals.passiveCf);
  els.kpiInvestIncomeRatio.textContent = formatPercent(totals.investIncomeRatio);
  els.kpiFreeCash.textContent = formatCurrency(totals.freeCash);
  setKpiWithSideMeta(els.kpiAssetChange, totals.assetChange, [
    { label: "Asset change goal", value: totals.assetGoal, reached: totals.assetChange >= totals.assetGoal },
    { label: "Asset change prediction", value: totals.assetPrediction, reached: totals.assetChange >= totals.assetPrediction }
  ]);

  renderLists(month);
  renderGoalsTable();
  renderTrendChart();
  renderAssetChart();
  renderMacroChart();
  renderAssetMacroChart();
  renderCashflowChart();
  renderIncomeChart();
}

function setKpiWithYearly(element, monthlyValue) {
  const yearlyValue = Number(monthlyValue || 0) * 12;
  element.innerHTML = `${formatCurrency(monthlyValue)}<span class="kpi-yearly"><small>Yearly value</small><small>${formatCurrency(yearlyValue)}</small></span>`;
}

function setKpiWithSideMeta(element, mainValue, rows) {
  const sideHtml = rows
    .map((row) => {
      const reachedClass = row.reached ? "kpi-meta-reached" : "kpi-meta-missed";
      return `<small>${escapeHtml(row.label)}</small><small class="${reachedClass}">${formatCurrency(row.value)}</small>`;
    })
    .join("");
  element.innerHTML = `${formatCurrency(mainValue)}<span class="kpi-side-meta">${sideHtml}</span>`;
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
    li.innerHTML = "<small>No data</small>";
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
    const passiveBadge = type === "income" && item.isPassive
      ? '<small class="item-badge passive-badge">PASSIVE</small>'
      : "";
    const categoryLine = type === "expense" && normalizeExpenseCategory(item.category)
      ? `<small class="item-category-line">${escapeHtml(normalizeExpenseCategory(item.category))}</small>`
      : "";
    const autoText = item.carriedFrom ? `<small class="item-auto-line">(auto from ${item.carriedFrom})</small>` : "";
    li.innerHTML = `
      <span class="entry-main">
        <span class="entry-name">${escapeHtml(item.name)}</span>
        <span class="entry-meta-line">
          ${item.periodic !== undefined ? periodicBadge : ""}
          ${passiveBadge}
        </span>
        ${categoryLine}
        ${autoText}
      </span>
      <span class="entry-actions">
        <strong class="entry-amount">${formatCurrency(item.amount || 0)}</strong>
        <span class="entry-buttons">
          <button data-action="edit-entry" data-month="${month}" data-type="${type}" data-id="${item.id}" type="button">Edit</button>
          <button data-action="delete-entry" data-month="${month}" data-type="${type}" data-id="${item.id}" type="button" class="danger">Delete</button>
        </span>
      </span>
    `;
    listEl.appendChild(li);
  };

  periodicItems.forEach(appendEntryRow);

  if (type === "expense") {
    renderExpenseSummarySection(listEl, periodicItems, "Total periodic expenses", "periodic");
  }

  if (oneTimeItems.length) {
    const oneTimeHeader = document.createElement("li");
    oneTimeHeader.className = "entry-section-header";
    oneTimeHeader.innerHTML = "<small>One-time</small>";
    listEl.appendChild(oneTimeHeader);
  }

  oneTimeItems.forEach(appendEntryRow);

  if (type === "expense") {
    renderExpenseSummarySection(listEl, items, "Total expenses (incl. one-time)", "overall");
  }

  if (type === "investment") {
    renderInvestmentSummarySection(listEl, month, items);
  }

  bindRowActions(listEl);
}

function renderInvestmentSummarySection(listEl, month, investmentItems) {
  const totalInvestment = sumBy(investmentItems, "amount");
  const ratio = calculateInvestmentIncomeRatio(month);

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

function calculateInvestmentIncomeRatio(month) {
  const monthData = state.months[month] || { income: [], investment: [] };
  const totalInvestment = sumBy(monthData.investment || [], "amount");
  const incomeTotal = sumBy(monthData.income || [], "amount");
  if (incomeTotal <= 0) return 0;
  return (totalInvestment / incomeTotal) * 100;
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
  const isIncome = els.entryType && els.entryType.value === "income";
  if (els.entryCategoryWrap) {
    els.entryCategoryWrap.hidden = !isExpense;
  }
  if (!isExpense && els.entryCategory) {
    els.entryCategory.value = "";
  }
  if (els.entryPassiveWrap) {
    els.entryPassiveWrap.hidden = !isIncome;
  }
  if (els.entryPassive) {
    els.entryPassive.disabled = !isIncome;
    if (!isIncome) {
      els.entryPassive.checked = false;
    }
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
  const totalAssets = (items || []).reduce((sum, item) => sum + getAssetValueInMainCurrency(item), 0);
  const totalCashAssets = (items || [])
    .filter((item) => isCashAsset(item))
    .reduce((sum, item) => sum + getAssetValueInMainCurrency(item), 0);

  if (!items.length) {
    const li = document.createElement("li");
    li.innerHTML = "<small>No data</small>";
    listEl.appendChild(li);
    appendAssetSummaryRows(listEl, totalAssets, totalCashAssets);
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
        <button data-action="edit-asset" data-month="${month}" data-id="${item.id}" type="button">Edit</button>
        <button data-action="delete-asset" data-month="${month}" data-id="${item.id}" type="button" class="danger">Delete</button>
      </span>
    `;
    listEl.appendChild(li);
  });

  appendAssetSummaryRows(listEl, totalAssets, totalCashAssets);

  bindRowActions(listEl);
}

function appendAssetSummaryRows(listEl, totalAssets, totalCashAssets) {
  const header = document.createElement("li");
  header.className = "entry-section-header";
  header.innerHTML = "<small>Asset summary</small>";
  listEl.appendChild(header);

  const totalRow = document.createElement("li");
  totalRow.className = "asset-summary";
  totalRow.innerHTML = `
    <span>Total assets</span>
    <span class="row-actions"><strong>${formatCurrency(totalAssets)}</strong></span>
  `;
  listEl.appendChild(totalRow);

  const cashRow = document.createElement("li");
  cashRow.className = "asset-summary";
  cashRow.innerHTML = `
    <span>Total cash assets</span>
    <span class="row-actions"><strong>${formatCurrency(totalCashAssets)}</strong></span>
  `;
  listEl.appendChild(cashRow);
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
    { key: "name", label: "Name", type: "text", value: item.name || "", required: true },
    { key: "amount", label: "Amount", type: "number", value: String(item.amount ?? ""), required: true },
    { key: "periodic", label: "Periodical", type: "checkbox", value: Boolean(item.periodic) }
  ];

  if (type === "expense") {
    fields.push({
      key: "category",
      label: "Expense category",
      type: "text",
      value: normalizeExpenseCategory(item.category)
    });
  }
  if (type === "income") {
    fields.push({
      key: "isPassive",
      label: "Passive income",
      type: "checkbox",
      value: Boolean(item.isPassive)
    });
  }

  const edited = await showEditModal({
    title: type === "expense" ? "Edit expense" : type === "income" ? "Edit income" : "Edit investment",
    fields,
    submitText: "Save"
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
  if (type === "income") {
    item.isPassive = Boolean(edited.isPassive);
  } else {
    delete item.isPassive;
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
    title: "Edit asset",
    fields: [
      { key: "name", label: "Asset name", type: "text", value: item.name || "", required: true },
      { key: "value", label: "Amount", type: "number", value: String(getAssetAmount(item) ?? ""), required: true, step: "0.0001" },
      {
        key: "currency",
        label: "Currency",
        type: "select",
        value: getAssetCurrency(item),
        options: getCurrencySelectOptions()
      },
      { key: "isCash", label: "Cash asset", type: "checkbox", value: isCashAsset(item) }
    ],
    submitText: "Save"
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
    const totals = getTotalsForMonth(month);
    const year = month.slice(0, 4);
    const isGoalReached = totals.assets >= Number(goalRow.goal || 0);
    const isAssetGoalReached = totals.assetChange >= Number(goalRow.assetGoal || 0);
    const isPredictionReached = totals.assets >= Number(goalRow.predikce || 0);
    const isAssetPredictionReached = totals.assetChange >= Number(goalRow.assetPrediction || 0);
    const shouldColorize = month <= currentMonth;
    const goalClass = shouldColorize ? (isGoalReached ? "goal-reached" : "goal-missed") : "";
    const assetGoalClass = shouldColorize ? (isAssetGoalReached ? "goal-reached" : "goal-missed") : "";
    const predictionClass = shouldColorize ? (isPredictionReached ? "goal-reached" : "goal-missed") : "";
    const assetPredictionClass = shouldColorize ? (isAssetPredictionReached ? "goal-reached" : "goal-missed") : "";

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
      <td data-label="Month">${escapeHtml(month)}</td>
      <td data-label="Assets Goal"><input class="${goalClass}" type="text" inputmode="decimal" data-month="${month}" data-field="goal" value="${formatGoalsCurrency(goalRow.goal)}" /></td>
      <td data-label="Assets Prediction"><input class="${predictionClass}" type="text" inputmode="decimal" data-month="${month}" data-field="predikce" value="${formatGoalsCurrency(goalRow.predikce)}" /></td>
      <td data-label="Assets Change Goal"><input class="${assetGoalClass}" type="text" inputmode="decimal" data-month="${month}" data-field="assetGoal" value="${formatGoalsCurrency(goalRow.assetGoal)}" /></td>
      <td data-label="Assets Change Prediction"><input class="${assetPredictionClass}" type="text" inputmode="decimal" data-month="${month}" data-field="assetPrediction" value="${formatGoalsCurrency(goalRow.assetPrediction)}" /></td>
    `;
    els.goalTableBody.appendChild(tr);
  });
}

function formatGoalsCurrency(value) {
  return formatCurrency(Number(value || 0), getMainCurrency(), { minFractionDigits: 0, maxFractionDigits: 2 });
}

function formatGoalsEditableNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return String(Math.round(numeric * 100) / 100).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function parseGoalsInputNumber(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) return 0;

  const cleaned = text
    .replace(/\u00A0/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return NaN;

  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (commaIndex > dotIndex) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (dotIndex > commaIndex) {
    normalized = cleaned.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function onGoalTableInputFocusIn(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const month = input.dataset.month;
  const field = input.dataset.field;
  if (!month || !field) return;

  ensureGoalMonth(month);
  const numeric = Number(state.monthGoals[month][field] || 0);
  input.value = formatGoalsEditableNumber(numeric);
}

function onGoalTableInputFocusOut(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const month = input.dataset.month;
  const field = input.dataset.field;
  if (!month || !field) return;

  ensureGoalMonth(month);
  const numeric = Number(state.monthGoals[month][field] || 0);
  input.value = formatGoalsCurrency(numeric);
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

  const parsedValue = parseGoalsInputNumber(input.value);
  if (!Number.isFinite(parsedValue)) {
    onGoalTableInputFocusOut(event);
    return;
  }

  ensureGoalMonth(month);
  state.monthGoals[month][field] = parsedValue;
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
    setStatus(`Year ${lastYear} cannot be removed because it is current or past.`);
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
  const localPassiveIncome = (monthData.income || [])
    .filter((item) => Boolean(item.isPassive))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const imported = state.importedSummaries[month] || {};
  ensureGoalMonth(month);
  const monthGoal = state.monthGoals[month] || {};

  const importedIncome = convertAmountToMainCurrency(imported.income || 0, "CZK");
  const importedExpense = convertAmountToMainCurrency(imported.expense || 0, "CZK");
  const importedInvestment = convertAmountToMainCurrency(imported.investment || 0, "CZK");
  const importedAssets = convertAmountToMainCurrency(imported.assets || 0, "CZK");
  const importedGoal = convertAmountToMainCurrency(imported.goal || 0, "CZK");
  const importedPredikce = convertAmountToMainCurrency(imported.predikce || 0, "CZK");
  const importedAssetGoal = convertAmountToMainCurrency(imported.assetGoal || 0, "CZK");
  const importedAssetPrediction = convertAmountToMainCurrency(imported.assetPrediction || 0, "CZK");
  const importedFreeCash = convertAmountToMainCurrency(imported.freeCash || 0, "CZK");
  const importedCashFlow = convertAmountToMainCurrency(imported.cashFlow || 0, "CZK");
  const importedPassiveCf = convertAmountToMainCurrency(imported.passiveCf || 0, "CZK");
  const importedPassiveIncome = convertAmountToMainCurrency(imported.passiveIncome || 0, "CZK");

  const income = localIncome || importedIncome || 0;
  const expense = localExpense || importedExpense || 0;
  const investment = localInvestment || importedInvestment || 0;
  const assets = localAssets || importedAssets || 0;
  const previousMonth = getPreviousMonth(month);
  const previousAssets = previousMonth ? getAssetsTotalForMonth(previousMonth) : 0;
  const passiveIncome = localIncome > 0 ? localPassiveIncome : (importedPassiveIncome || 0);
  const hasLocalCashflowInputs = (monthData.income || []).some((item) => item && item.source !== "imported-csv-summary")
    || (monthData.expense || []).some((item) => item && item.source !== "imported-csv-summary");
  const derivedCashflow = income - expense;
  const cashflow = hasLocalCashflowInputs ? derivedCashflow : importedCashFlow;

  return {
    income,
    expense,
    investment,
    assets,
    cashflow,
    realita: convertAmountToMainCurrency(imported.realita || 0, "CZK"),
    goal: Number(monthGoal.goal || importedGoal || 0),
    predikce: Number(monthGoal.predikce || importedPredikce || 0),
    assetChange: assets - previousAssets,
    assetGoal: Number(monthGoal.assetGoal || importedAssetGoal || 0),
    assetPrediction: Number(monthGoal.assetPrediction || importedAssetPrediction || 0),
    freeCash: localFreeCash || importedFreeCash || 0,
    passiveCf: importedPassiveCf || 0,
    passiveIncome,
    investIncomeRatio: calculateInvestmentIncomeRatio(month)
  };
}

function getAssetsTotalForMonth(month) {
  const monthData = state.months[month] || { assets: [] };
  const localAssets = (monthData.assets || []).reduce((sum, item) => sum + getAssetValueInMainCurrency(item), 0);
  const imported = state.importedSummaries[month] || {};
  const importedAssets = convertAmountToMainCurrency(imported.assets || 0, "CZK");
  return localAssets || importedAssets || 0;
}

function renderTrendChart() {
  const labels = getCashMonthAxis();
  const assets = labels.map((month) => getTotalsForMonth(month).assets);
  const prediction = labels.map((month) => getTotalsForMonth(month).predikce);
  const goal = labels.map((month) => getTotalsForMonth(month).goal);
  const trendline = buildTrendlineFromRealValues(assets, labels.length);

  drawCashChart(els.trendChart, labels, {
    assets,
    prediction,
    goal,
    trendline
  });
}

function getCashMonthAxis() {
  return Object.keys(state.months)
    .concat(Object.keys(state.importedSummaries))
    .concat(state.goalTimeline || [])
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort();
}

function renderAssetChart() {
  const labels = getCashMonthAxis();
  const assetChange = labels.map((month) => getTotalsForMonth(month).assetChange);
  const prediction = labels.map((month) => getTotalsForMonth(month).assetPrediction);
  const goal = labels.map((month) => getTotalsForMonth(month).assetGoal);
  const trendline = buildTrendlineFromRealValues(assetChange, labels.length);

  drawCashChart(els.assetChart, labels, {
    assets: assetChange,
    prediction,
    goal,
    trendline
  });
}

function renderMacroChart() {
  const labels = getCashMonthAxis();
  const currentMonth = getChartCutoffMonth();
  const passiveCf = labels.map((month) => getTotalsForMonth(month).passiveCf);
  const passiveIncome = labels.map((month) => getTotalsForMonth(month).passiveIncome);
  const passiveCfUntilCurrent = maskValuesAfterCurrentMonth(labels, passiveCf, currentMonth);
  const passiveIncomeUntilCurrent = maskValuesAfterCurrentMonth(labels, passiveIncome, currentMonth);

  drawLineChart(els.macroChart, labels, [
    { name: "Passive CF", values: passiveCfUntilCurrent, color: "#3b82f6" },
    { name: "Passive income", values: passiveIncomeUntilCurrent, color: "#ef4444" }
  ], {
    yAxisLabel: ""
  });
}

function buildLinearTrendline(values, targetLength) {
  const points = [];

  values.forEach((value, index) => {
    if (value === null || value === undefined) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    points.push({ x: index + 1, y: numeric });
  });

  if (!points.length) return Array.from({ length: targetLength }, () => null);
  if (points.length === 1) return Array.from({ length: targetLength }, () => points[0].y);

  const count = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  points.forEach((point) => {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  });

  const denominator = (count * sumXX) - (sumX * sumX);
  if (Math.abs(denominator) < 1e-9) {
    const average = sumY / count;
    return Array.from({ length: targetLength }, () => average);
  }

  const slope = ((count * sumXY) - (sumX * sumY)) / denominator;
  const intercept = (sumY - (slope * sumX)) / count;

  return Array.from({ length: targetLength }, (_, index) => intercept + (slope * (index + 1)));
}

function renderAssetMacroChart() {
  const labels = getCashMonthAxis();
  const currentMonth = getChartCutoffMonth();
  const investIncomeRatio = labels.map((month) => getTotalsForMonth(month).investIncomeRatio);
  const investIncomeRatioUntilCurrent = maskValuesAfterCurrentMonth(labels, investIncomeRatio, currentMonth);
  const trendline = buildTrendlineFromRealValues(investIncomeRatio, labels.length);

  drawLineChart(els.assetMacroChart, labels, [
    { name: "Investment/Income ratio", values: investIncomeRatioUntilCurrent, color: "#3b82f6" },
    { name: "Trendline", values: trendline, color: "#93c5fd" }
  ], {
    yAxisType: "percent",
    yAxisLabel: ""
  });
}

function renderCashflowChart() {
  const labels = getCashMonthAxis();
  const currentMonth = getChartCutoffMonth();
  const cashFlow = labels.map((month) => getTotalsForMonth(month).cashflow);
  const cashFlowUntilCurrent = maskValuesAfterCurrentMonth(labels, cashFlow, currentMonth);
  const trendline = buildLinearTrendline(cashFlowUntilCurrent, labels.length);

  drawLineChart(els.cashflowChart, labels, [
    { name: "CashFlow", values: cashFlowUntilCurrent, color: "#3b82f6" },
    { name: "Trendline", values: trendline, color: "#93c5fd" }
  ], {
    yAxisLabel: ""
  });
}

function renderIncomeChart() {
  const labels = getCashMonthAxis();
  const currentMonth = getChartCutoffMonth();
  const income = labels.map((month) => getTotalsForMonth(month).income);
  const incomeUntilCurrent = maskValuesAfterCurrentMonth(labels, income, currentMonth);
  const trendline = buildLinearTrendline(incomeUntilCurrent, labels.length);

  drawLineChart(els.incomeChart, labels, [
    { name: "Income", values: incomeUntilCurrent, color: "#22c55e" },
    { name: "Trendline", values: trendline, color: "#93c5fd" }
  ], {
    yAxisLabel: ""
  });
}

function maskValuesAfterCurrentMonth(labels, values, currentMonth = getCurrentMonthKey()) {
  let cutoffIndex = -1;
  for (let index = 0; index < labels.length; index += 1) {
    const month = labels[index];
    if (month && month <= currentMonth) cutoffIndex = index;
  }

  return values.map((value, index) => (index <= cutoffIndex ? value : null));
}

function getChartCutoffMonth() {
  const actualCurrentMonth = getCurrentMonthKey();
  const selectedMonth = els.monthSelect && typeof els.monthSelect.value === "string"
    ? String(els.monthSelect.value).trim()
    : "";

  if (/^\d{4}-\d{2}$/.test(selectedMonth)) {
    return selectedMonth <= actualCurrentMonth ? selectedMonth : actualCurrentMonth;
  }

  return actualCurrentMonth;
}

function getMonthAxis() {
  const months = Object.keys(state.months)
    .concat(Object.keys(state.importedSummaries))
    .concat(state.goalTimeline || [])
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort();
  return months.slice(-24);
}

function buildTrendlineFromRealValues(realValues, targetLength) {
  const points = [];

  realValues.forEach((value, index) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    points.push({ x: index + 1, y: numeric });
  });

  if (points.length < 2) {
    return Array.from({ length: targetLength }, () => null);
  }

  const count = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  points.forEach((point) => {
    const logX = Math.log(point.x);
    const logY = Math.log(point.y);
    sumX += logX;
    sumY += logY;
    sumXY += logX * logY;
    sumXX += logX * logX;
  });

  const denominator = (count * sumXX) - (sumX * sumX);
  if (Math.abs(denominator) < 1e-9) {
    const constant = Math.exp(sumY / count);
    return Array.from({ length: targetLength }, () => constant);
  }

  const exponent = ((count * sumXY) - (sumX * sumY)) / denominator;
  const intercept = (sumY - (exponent * sumX)) / count;
  const coefficient = Math.exp(intercept);

  return Array.from({ length: targetLength }, (_, index) => {
    const x = index + 1;
    const value = coefficient * Math.pow(x, exponent);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
}

function getXAxisLabelStep(labelsCount, plotWidthCssPx, minSpacingCssPx) {
  if (labelsCount <= 2) return 1;
  const slots = Math.max(2, Math.floor(plotWidthCssPx / minSpacingCssPx));
  return Math.max(1, Math.ceil((labelsCount - 1) / (slots - 1)));
}

function isPhoneLikeViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse) and (hover: none) and (max-width: 900px)").matches;
}

function formatChartAxisLabel(value, { type = "currency", compact = false } = {}) {
  const numeric = Number(value || 0);
  if (type === "percent") {
    return `${numeric.toFixed(compact ? 1 : 2)} %`;
  }

  if (!compact) {
    return formatCurrency(numeric, getMainCurrency(), { minFractionDigits: 0, maxFractionDigits: 2 });
  }

  try {
    const shortened = new Intl.NumberFormat("cs-CZ", {
      notation: "compact",
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(numeric);
    return `${shortened} ${getMainCurrency()}`;
  } catch {
    return formatCurrency(numeric, getMainCurrency(), { minFractionDigits: 0, maxFractionDigits: 1 });
  }
}

function drawCashChart(canvas, labels, data) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(1, canvas.clientWidth || 0);
  const cssHeight = Math.max(1, canvas.clientHeight || Number(canvas.getAttribute("height")) || 220);
  const isPhone = isPhoneLikeViewport();
  const isCompact = cssWidth < 430;
  const useCompactYAxisLabels = isPhone && isCompact;
  const width = canvas.width = Math.floor(cssWidth * dpr);
  const height = canvas.height = Math.floor(cssHeight * dpr);

  ctx.clearRect(0, 0, width, height);
  if (!labels.length) return;

  const positiveValues = [];
  [data.assets, data.prediction, data.goal, data.trendline].forEach((series) => {
    series.forEach((value) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) positiveValues.push(numeric);
    });
  });

  if (!positiveValues.length) return;

  const minPositive = Math.min(...positiveValues);
  const maxPositive = Math.max(...positiveValues);
  let minPower = Math.floor(Math.log10(minPositive));
  let maxPower = Math.ceil(Math.log10(maxPositive));

  if (minPower === maxPower) {
    minPower -= 1;
    maxPower += 1;
  }

  const axisMin = Math.pow(10, minPower);
  const axisMax = Math.pow(10, maxPower);
  const axisLogRange = Math.log10(axisMax) - Math.log10(axisMin);

  const yAxisLabels = [];
  for (let power = minPower; power <= maxPower; power += 1) {
    const value = Math.pow(10, power);
    yAxisLabels.push(formatChartAxisLabel(value, { compact: useCompactYAxisLabels }));
  }

  const axisFontCssPx = useCompactYAxisLabels ? 9 : 10;
  ctx.font = `${axisFontCssPx * dpr}px sans-serif`;
  const maxYAxisLabelWidth = yAxisLabels.reduce((maxWidth, label) => {
    const widthForLabel = ctx.measureText(label).width;
    return Math.max(maxWidth, widthForLabel);
  }, 0);

  const minLeft = (isCompact ? 52 : 72) * dpr;
  const maxLeft = Math.floor(width * (isCompact ? 0.36 : 0.33));
  const left = Math.max(minLeft, Math.min(maxLeft, Math.ceil(maxYAxisLabelWidth + (16 * dpr))));
  const right = (isCompact ? 18 : 28) * dpr;
  const top = 30 * dpr;
  const bottom = (isCompact ? 42 : 34) * dpr;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(1, height - top - bottom);
  const axisStrokeWidth = (isPhone ? 0.8 : 1) * dpr;
  const seriesStrokeWidth = (isPhone ? 1.4 : 2) * dpr;

  const xForIndex = (index) => {
    if (labels.length <= 1) return left + (plotWidth / 2);
    return left + ((index * plotWidth) / (labels.length - 1));
  };

  const yForValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return top + plotHeight;
    const clamped = Math.min(Math.max(numeric, axisMin), axisMax);
    const ratio = (Math.log10(clamped) - Math.log10(axisMin)) / axisLogRange;
    return top + plotHeight - (ratio * plotHeight);
  };

  ctx.strokeStyle = "#2c3c59";
  ctx.lineWidth = axisStrokeWidth;
  ctx.fillStyle = "#8ea2c2";
  ctx.font = `${axisFontCssPx * dpr}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  yAxisLabels.forEach((label, index) => {
    const power = minPower + index;
    const value = Math.pow(10, power);
    const y = yForValue(value);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotWidth, y);
    ctx.stroke();
    ctx.fillText(label, left - (8 * dpr), y);
  });

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + plotHeight);
  ctx.lineTo(left + plotWidth, top + plotHeight);
  ctx.stroke();

  const barWidth = Math.max(2 * dpr, Math.min(26 * dpr, (plotWidth / Math.max(labels.length, 1)) * 0.62));
  ctx.fillStyle = "#3b82f6";
  data.assets.forEach((value, index) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const x = xForIndex(index);
    const y = yForValue(numeric);
    const barHeight = Math.max(1 * dpr, (top + plotHeight) - y);
    ctx.fillRect(x - (barWidth / 2), y, barWidth, barHeight);
  });

  const drawSeries = (values, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = seriesStrokeWidth;
    ctx.beginPath();

    let started = false;
    values.forEach((value, index) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        started = false;
        return;
      }

      const x = xForIndex(index);
      const y = yForValue(numeric);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  };

  drawSeries(data.prediction, "#f59e0b");
  drawSeries(data.goal, "#ef4444");
  drawSeries(data.trendline, "#93c5fd");

  ctx.fillStyle = "#8ea2c2";
  ctx.textBaseline = "top";
  const labelStep = getXAxisLabelStep(labels.length, plotWidth / dpr, isCompact ? 76 : 58);
  labels.forEach((month, index) => {
    const isLast = index === labels.length - 1;
    if (!isLast && index % labelStep !== 0) return;
    const x = xForIndex(index);
    const shortMonth = String(month || "").replace("-", "/");
    if (index === 0) ctx.textAlign = "left";
    else if (isLast) ctx.textAlign = "right";
    else ctx.textAlign = "center";
    ctx.fillText(shortMonth, x, top + plotHeight + (6 * dpr));
  });

  const legend = [
    { label: "Actual", color: "#3b82f6", box: true },
    { label: "Trendline", color: "#93c5fd", box: false },
    { label: "Goal", color: "#ef4444", box: false },
    { label: "Prediction", color: "#f59e0b", box: false }
  ];

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `${11 * dpr}px sans-serif`;

  const legendY = 12 * dpr;
  let legendX = left + (12 * dpr);
  legend.forEach((item) => {
    if (item.box) {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY - (5 * dpr), 10 * dpr, 10 * dpr);
      legendX += 16 * dpr;
    } else {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = seriesStrokeWidth;
      ctx.beginPath();
      ctx.moveTo(legendX, legendY);
      ctx.lineTo(legendX + (12 * dpr), legendY);
      ctx.stroke();
      legendX += 18 * dpr;
    }

    ctx.fillStyle = "#d5deec";
    ctx.fillText(item.label, legendX, legendY);
    legendX += (ctx.measureText(item.label).width + (18 * dpr));
  });
}

function drawLineChart(canvas, labels, series, options = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(1, canvas.clientWidth || Number(canvas.getAttribute("width")) || 300);
  const cssHeight = Math.max(1, canvas.clientHeight || Number(canvas.getAttribute("height")) || 220);
  const isPhone = isPhoneLikeViewport();
  const isCompact = cssWidth < 430;
  const useCompactYAxisLabels = isPhone && isCompact;
  const width = canvas.width = Math.floor(cssWidth * dpr);
  const height = canvas.height = Math.floor(cssHeight * dpr);

  ctx.clearRect(0, 0, width, height);

  if (!labels.length) return;

  const allValues = series
    .reduce((acc, line) => acc.concat(line.values), [])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!allValues.length) return;

  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  if (Math.abs(max - min) < 1e-9) {
    const padding = Math.max(1, Math.abs(max) * 0.1);
    max += padding;
    min -= padding;
  }
  const range = max - min;

  const yTicks = isCompact ? 4 : 5;
  const yAxisType = options.yAxisType === "percent" ? "percent" : "currency";
  const hasYAxisLabelOption = Object.prototype.hasOwnProperty.call(options, "yAxisLabel");
  const yAxisLabel = hasYAxisLabelOption
    ? String(options.yAxisLabel || "")
    : `Values (${getMainCurrency()})`;
  const formatYAxisValue = (value) => formatChartAxisLabel(value, { type: yAxisType, compact: useCompactYAxisLabels });

  const axisFontCssPx = useCompactYAxisLabels ? 9 : 10;
  ctx.font = `${axisFontCssPx * dpr}px sans-serif`;
  const yTickLabels = Array.from({ length: yTicks + 1 }, (_, tick) => {
    const ratio = tick / yTicks;
    const value = max - (ratio * range);
    return formatYAxisValue(value);
  });
  const maxYAxisLabelWidth = yTickLabels.reduce((maxWidth, label) => {
    const widthForLabel = ctx.measureText(label).width;
    return Math.max(maxWidth, widthForLabel);
  }, 0);

  const minLeft = (isCompact ? 52 : 72) * dpr;
  const maxLeft = Math.floor(width * (isCompact ? 0.36 : 0.33));
  const left = Math.max(minLeft, Math.min(maxLeft, Math.ceil(maxYAxisLabelWidth + (16 * dpr))));
  const right = (isCompact ? 18 : 24) * dpr;
  const top = 30 * dpr;
  const bottom = (isCompact ? 42 : 34) * dpr;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(1, height - top - bottom);
  const axisStrokeWidth = (isPhone ? 0.8 : 1) * dpr;
  const seriesStrokeWidth = (isPhone ? 1.4 : 2) * dpr;

  const xForIndex = (index) => {
    if (labels.length <= 1) return left + (plotWidth / 2);
    return left + ((index * plotWidth) / (labels.length - 1));
  };

  const yForValue = (value) => {
    const ratio = (Number(value) - min) / range;
    return top + plotHeight - (ratio * plotHeight);
  };

  ctx.strokeStyle = "#2c3c59";
  ctx.lineWidth = axisStrokeWidth;
  ctx.fillStyle = "#8ea2c2";
  ctx.font = `${axisFontCssPx * dpr}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let tick = 0; tick <= yTicks; tick += 1) {
    const ratio = tick / yTicks;
    const value = max - (ratio * range);
    const y = top + (ratio * plotHeight);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotWidth, y);
    ctx.stroke();
    ctx.fillText(formatYAxisValue(value), left - (8 * dpr), y);
  }

  ctx.strokeStyle = "#3a4b6a";
  ctx.lineWidth = axisStrokeWidth;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + plotHeight);
  ctx.lineTo(left + plotWidth, top + plotHeight);
  ctx.stroke();

  series.forEach((line) => {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = seriesStrokeWidth;
    ctx.beginPath();

    let started = false;
    line.values.forEach((value, index) => {
      if (value === null || value === undefined) {
        started = false;
        return;
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        started = false;
        return;
      }
      const x = xForIndex(index);
      const y = yForValue(numeric);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  });

  ctx.fillStyle = "#8ea2c2";
  ctx.font = `${10 * dpr}px sans-serif`;
  ctx.textBaseline = "top";
  const labelStep = getXAxisLabelStep(labels.length, plotWidth / dpr, isCompact ? 76 : 58);
  labels.forEach((month, index) => {
    const isLast = index === labels.length - 1;
    if (!isLast && index % labelStep !== 0) return;
    const x = xForIndex(index);
    const shortMonth = String(month || "").replace("-", "/");
    if (index === 0) ctx.textAlign = "left";
    else if (isLast) ctx.textAlign = "right";
    else ctx.textAlign = "center";
    ctx.fillText(shortMonth, x, top + plotHeight + (6 * dpr));
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `${11 * dpr}px sans-serif`;
  const legendY = 12 * dpr;
  let legendX = left + (12 * dpr);
  series.forEach((line) => {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = seriesStrokeWidth;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + (12 * dpr), legendY);
    ctx.stroke();
    legendX += 18 * dpr;

    ctx.fillStyle = "#d5deec";
    ctx.fillText(String(line.name || ""), legendX, legendY);
    legendX += (ctx.measureText(String(line.name || "")).width + (18 * dpr));
  });

  ctx.fillStyle = "#8ea2c2";
  ctx.font = `${10 * dpr}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (yAxisLabel) {
    ctx.fillText(yAxisLabel, left, top - (8 * dpr));
  }
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
  setStatus("JSON export completed.");
}

async function importJson(event) {
  const file = event.target && event.target.files ? event.target.files[0] : null;
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.months) throw new Error("Invalid file");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    setStatus("JSON import completed, loading data...");
    location.reload();
  } catch {
    setStatus("Error importing JSON.");
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

  upsertImportedEntry(monthData.income, "Salary", mzda, { isPassive: false });
  upsertImportedEntry(monthData.income, "Savings account", passiveIncome, { isPassive: true });
  upsertImportedEntry(monthData.expense, "Imported expenses (CSV)", summary.expense);
  upsertImportedEntry(monthData.investment, "Imported investments (CSV)", summary.investment);
  upsertImportedAsset(monthData.assets, "Imported assets total (CSV)", summary.assets, false);
}

function upsertImportedEntry(list, name, amount, options = {}) {
  if (!Number.isFinite(amount)) return;
  const existing = list.find((item) => item.source === "imported-csv-summary" && item.name === name);
  if (existing) {
    existing.amount = amount;
    if (Object.prototype.hasOwnProperty.call(options, "isPassive")) {
      existing.isPassive = Boolean(options.isPassive);
    }
    existing.updatedAt = Date.now();
    return;
  }

  list.push({
    id: createId(),
    name,
    amount,
    periodic: false,
    isPassive: Boolean(options.isPassive),
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
  return text.startsWith("cash")
    || text.includes("free cash")
    || text.includes("of which free cash")
    || text.includes("z toho free cash");
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

async function refreshAppCache() {
  if (els.refreshCacheBtn) els.refreshCacheBtn.disabled = true;

  try {
    setStatus("Refreshing app cache...");

    let registration = null;
    if ("serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    setStatus("App cache refreshed. Reloading...");
    setTimeout(() => {
      location.reload();
    }, 150);
  } catch {
    setStatus("App cache refresh failed.");
    if (els.refreshCacheBtn) els.refreshCacheBtn.disabled = false;
  }
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

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
