# Personal Finance iPhone App (local-first)

## Co to umí
- Lokální ukládání dat po měsících: `prijem`, `vydaje`, `investice`, `assets`.
- Každá položka má název, částku a u položek příjem/výdaj/investice i typ `periodical` nebo `one-time`.
- Všechny uložené položky (příjem, výdaj, investice, assets) lze následně upravit nebo smazat.
- `periodical` položky se automaticky předvyplní do následujícího měsíce.
- Goal od uživatele (target amount).
- Dashboard se KPI + 4 grafy včetně makro metrik ze sheetu.
- Import CSV (Google Sheet export) pro historické měsíční souhrny.
- Export/Import JSON pro migraci na nový iPhone.
- Při prvním spuštění se automaticky načte vestavěný soubor `app/assets/historical.csv` (pokud ještě nejsou importovaná historická data).
- `Goals` tab je po měsících (včetně budoucích):
	- `Goal (real asset goal)`
	- `Asset change goal (Asset Goal)`
	- `Asset prediction (Predikce)`
	- `Asset change prediction (Asset prediction)`
- V `Goals` tab jsou tlačítka:
	- `Add 1 future year`
	- `Remove last future year` (smaže jen poslední rok, který je celý v budoucnosti)

## Spuštění lokálně (Windows)
V PowerShellu z kořene projektu:

```powershell
cd app
python -m http.server 8080
```

Pak otevři:
- Na PC: `http://localhost:8080`
- Na iPhone ve stejné Wi-Fi: `http://<IP_tvého_PC>:8080`

## Instalace na iPhone
- Otevři URL v Safari.
- Klikni `Share` -> `Add to Home Screen`.
- App běží jako web app a data ukládá lokálně v iPhone (browser storage).

## Přenos na nový iPhone
- Ve starém iPhone: `Data` -> `Export JSON`.
- Soubor přenes (AirDrop/iCloud).
- V novém iPhone: `Data` -> `Import JSON`.

## Poznámka k chartům
CSV z Google Sheetu má složitou strukturu z maker. V této verzi import mapuje tyto sloupce 1:1:

- `month` z indexu `15`
- `realita` z `16`
- `goal` z `17`
- `predikce` z `19`
- `Asset change` z `20`
- `Asset Goal` z `21`
- `Asset prediction` z `22`
- `pasivni CF` z `24`
- `pasivni prijem` z `25`
- `Investment/income` z `26` (v %)
- `Prijem` z `27`
- `Vydaje` z `28`
- `Investment` z `29`
- `CashFlow` z `30`

Grafy na Dashboardu:
- `Monthly Trend` (Prijem, Vydaje, Investment, CashFlow)
- `Assets vs Goal`
- `Realita / Goal / Predikce`
- `Asset Change / Goal / Prediction`
