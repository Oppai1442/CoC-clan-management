# O-Clan Manager

Self-hosted Clash of Clans clan-management dashboard from O-Project. Google Sheets is the data store, Google Apps Script is the collector/API, and the React frontend is the dashboard.

> O-Project does not host your clan backend or store your Supercell API token. Each clan owns its own Sheet and Apps Script deployment.

## Architecture

`Clash of Clans API → RoyaleAPI proxy → Google Apps Script → Google Sheet → O-Clan Manager UI`

The proxy is used because Apps Script does not provide a stable outbound IP suitable for a Supercell API key allowlist.

## Setup

### 1. Create the spreadsheet + bound Apps Script

Until the public Google Sheet template is published, create a Google Sheet, open **Extensions → Apps Script**, and add the repository files:

- `gas/syncWarToSheet.gs`
- `gas/doGet.gs`
- `gas/setup.gs`

After the public template exists, this step becomes a single **Make a copy** action; the bound script will travel with the copied spreadsheet.

Reload the spreadsheet. A new **O-Clan Manager** menu should appear.

### 2. Create the Supercell API key

Open the Supercell developer portal and create a Clash of Clans API key.

Use this allowed IP for the key:

```text
45.79.218.79
```

This is the IP used by the RoyaleAPI Clash of Clans proxy configured by O-Clan Manager.

### 3. Configure the Sheet

In the spreadsheet choose **O-Clan Manager → Setup / Configure**.

Enter:

- your clan tag;
- your Supercell API token.

The installer stores these in Apps Script Script Properties and configures:

```text
BASE_URL=https://cocproxy.royaleapi.dev/v1
```

The token is not stored in a spreadsheet cell.

Then choose **O-Clan Manager → Install collector**. This calls the project's existing `setupCollector()` routine, creates the required sheets, and installs the existing 30-minute `runCollector` trigger.

Use **O-Clan Manager → Check configuration** at any time to verify the local setup state.

### 4. Deploy the Apps Script API

In Apps Script choose **Deploy → New deployment → Web app**.

Deploy the app under the account that owns/configures the spreadsheet and choose an access level appropriate for the dashboard users. Copy the resulting URL ending in `/exec`.

### 5. Connect the dashboard

Install and build the frontend:

```bash
npm install
npm run build
```

Host `dist/` on any static host, or run locally during development with:

```bash
npm run dev
```

On first launch O-Clan Manager asks for the Apps Script Web App URL. Paste the `/exec` URL and choose **Test & connect**. The URL is stored in that browser's `localStorage`.

For a preconfigured private deployment you can alternatively provide this at build time:

```bash
VITE_COC_BOOTSTRAP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Do not commit a private deployment URL unless you intentionally want it in the built frontend.

## Updating

Frontend updates do not require moving clan data. Pull the new source, rebuild, and redeploy the static frontend.

Apps Script updates currently require updating the bound script files. A future template/updater flow can automate this without replacing the user's spreadsheet data.

## Data and credentials

Clan data stays in the user's Google Sheet. The Supercell token is stored in that Sheet's bound Apps Script project through Script Properties. Browser authentication/session state and the selected backend URL use browser local storage.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS · Google Apps Script · Google Sheets · Clash of Clans API

## Project status

The self-host onboarding flow is being productized for O-Project. The next UI pass will replace the current generic dark dashboard shell with the O-Clan Manager Clash-inspired command-center design while preserving the data-heavy table UX.
