# SOC Lab Dashboard

A live console showing Wazuh alerts as they come in, pulled directly from the
Wazuh indexer (OpenSearch) via a small local proxy.

## Why a proxy?

The Wazuh indexer uses a self-signed cert and doesn't have CORS enabled, so a
browser can't query it directly from a page served elsewhere. `server.js` is
a tiny Node script (no dependencies) that runs on your machine, forwards
requests to the indexer, and serves the dashboard page.

## Setup

1. Make sure Node.js is installed on your machine :
   ```bash
   node --version
   ```
   If it's missing: `sudo apt install nodejs -y`

2. Check the credentials in `server.js` match your Wazuh indexer login.
   The dashboard login (`admin`/`admin`) may or may not be the same as the
   indexer's — if the dashboard shows alerts fine but this proxy gets 401s,
   the indexer password differs. Find it with:
   ```bash
   # run inside the Wazuh VM
   sudo find / -iname "*wazuh-passwords*" 2>/dev/null
   ```

3. Run the server:
   ```bash
   node server.js
   ```

4. Open in your browser:
   ```
   http://localhost:3000
   ```

## What it shows

- Live count of alerts in the last 24h, split by severity
- Number of agents currently reporting
- The most frequent rule triggered
- A live-updating table of the most recent alerts (polls every 5 seconds)

## Next steps to extend it

- Add a chart of alert volume over time (Chart.js via CDN, same no-build approach)
- Filter by agent or rule level
- Add a sound/visual flash when a critical (level 10+) alert lands