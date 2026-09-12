const OCM_PROXY_URL = 'https://cocproxy.royaleapi.dev/v1';
const OCM_PROXY_IP = '45.79.218.79';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('O-Clan Manager')
    .addItem('Setup / Configure', 'showOClanManagerSetup')
    .addItem('Check configuration', 'showOClanManagerStatus')
    .addSeparator()
    .addItem('Install sync trigger', 'installOClanManagerTrigger')
    .addToUi();
}

function showOClanManagerSetup() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body{font:14px Arial,sans-serif;padding:18px;color:#2d241c;background:#f5ead5}h2{margin:0 0 6px}p{line-height:1.45}.box{padding:12px;background:#fff8e9;border:1px solid #c9a56b;border-radius:8px;margin:12px 0}label{display:block;font-weight:700;margin-top:12px}input{box-sizing:border-box;width:100%;padding:9px;margin-top:5px;border:1px solid #9d7b4c;border-radius:6px}button{width:100%;margin-top:16px;padding:10px;border:0;border-radius:7px;background:#d99b27;font-weight:700;cursor:pointer}.small{font-size:12px;color:#6f604e}.ip{font-family:monospace;font-weight:700}#status{margin-top:12px;white-space:pre-wrap}
    </style>
    <h2>O-Clan Manager Setup</h2>
    <p>Connect this spreadsheet to the Clash of Clans API.</p>
    <div class="box"><b>Supercell API key</b><br>When creating the key, add this allowed IP:<br><span class="ip">${OCM_PROXY_IP}</span><br><button type="button" onclick="copyIp()">Copy allowed IP</button><p class="small">API traffic uses RoyaleAPI's Clash of Clans proxy so Apps Script does not need a fixed outbound IP.</p></div>
    <label>Clan tag</label><input id="tag" placeholder="#2ABCDEF" autocomplete="off">
    <label>Supercell API token</label><input id="token" type="password" placeholder="Paste token here" autocomplete="off">
    <button onclick="save()">Save configuration</button>
    <div id="status"></div>
    <script>
      function copyIp(){navigator.clipboard.writeText('${OCM_PROXY_IP}');}
      function save(){
        const tag=document.getElementById('tag').value.trim();
        const token=document.getElementById('token').value.trim();
        const status=document.getElementById('status');
        if(!tag||!token){status.textContent='Clan tag and API token are required.';return;}
        status.textContent='Saving…';
        google.script.run.withSuccessHandler(r=>{status.textContent=r.message;}).withFailureHandler(e=>{status.textContent='Error: '+e.message;}).saveOClanManagerSetup(tag,token);
      }
    </script>`).setTitle('O-Clan Manager Setup').setWidth(390);
  SpreadsheetApp.getUi().showSidebar(html);
}

function saveOClanManagerSetup(clanTag, token) {
  const tag = String(clanTag || '').trim().toUpperCase();
  const apiToken = String(token || '').trim();
  if (!/^#[0289PYLQGRJCUV]+$/.test(tag)) throw new Error('Invalid Clash of Clans clan tag.');
  if (!apiToken) throw new Error('API token is required.');

  PropertiesService.getScriptProperties().setProperties({
    CLAN_TAG: tag,
    COC_API_TOKEN: apiToken,
    BASE_URL: OCM_PROXY_URL
  }, false);

  return { ok: true, message: 'Configuration saved. Next: install the sync trigger, then deploy this Apps Script project as a Web App.' };
}

function installOClanManagerTrigger() {
  const ui = SpreadsheetApp.getUi();
  const handler = 'syncWarToSheet';
  const existing = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === handler);
  existing.forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  ui.alert('O-Clan Manager', 'Sync trigger installed: every 5 minutes.', ui.ButtonSet.OK);
}

function getOClanManagerStatus_() {
  const props = PropertiesService.getScriptProperties();
  const tag = props.getProperty('CLAN_TAG');
  const token = props.getProperty('COC_API_TOKEN');
  const baseUrl = props.getProperty('BASE_URL');
  const triggers = ScriptApp.getProjectTriggers();
  return {
    clanConfigured: Boolean(tag),
    tokenConfigured: Boolean(token),
    proxyConfigured: baseUrl === OCM_PROXY_URL,
    syncTriggerInstalled: triggers.some(t => t.getHandlerFunction() === 'syncWarToSheet'),
    clanTag: tag || ''
  };
}

function showOClanManagerStatus() {
  const s = getOClanManagerStatus_();
  SpreadsheetApp.getUi().alert(
    'O-Clan Manager status',
    [
      `Clan: ${s.clanConfigured ? s.clanTag : 'not configured'}`,
      `API token: ${s.tokenConfigured ? 'configured' : 'missing'}`,
      `API proxy: ${s.proxyConfigured ? 'configured' : 'missing'}`,
      `Sync trigger: ${s.syncTriggerInstalled ? 'installed' : 'missing'}`
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
