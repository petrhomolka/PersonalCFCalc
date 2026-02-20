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

## Native iPhone build (Capacitor + Xcode)
Projekt je připravený pro Capacitor iOS wrapper (`ios/` složka už existuje).

### 1) Co jde a nejde na Windows
- Na Windows můžeš připravit project (`npm install`, `npm run ios:sync`).
- Finální `.ipa` build + podpis pro App Store/TestFlight musí proběhnout na macOS v Xcode.

### 2) Příprava na Macu
V root složce projektu spusť:

```bash
npm install
npm run ios:sync
npm run ios:open
```

To otevře nativní iOS projekt v Xcode.

### 3) Xcode nastavení (jednorázově)
- V `App` target nastav `Bundle Identifier` (musí být unikátní).
- `Signing & Capabilities` -> vyber svůj `Team`.
- Zvyšte `Version` a `Build` při každém releasu.
- Ověř minimální iOS verzi (`Deployment Target`) podle potřeby.

### 4) Test na zařízení
- Připoj iPhone k Macu.
- V Xcode vyber zařízení a dej `Run`.
- Ověř import/export JSON, načtení `historical.csv`, grafy a ukládání dat.

### 5) TestFlight / App Store Connect
- Xcode: `Product` -> `Archive`.
- V Organizer: `Distribute App` -> `App Store Connect` -> `Upload`.
- V App Store Connect vytvoř app záznam (pokud není), doplň metadata a přidej build do TestFlight.
- Po schválení interního/externího testování můžeš build distribuovat testerům.

### 6) Aktualizace web části po změnách
Po každé změně v `app/` spusť:

```bash
npm run ios:sync
```

Pak znovu buildni/archivuj v Xcode.

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
