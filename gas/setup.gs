const OCM_PROXY_URL = 'https://cocproxy.royaleapi.dev/v1';
const OCM_PROXY_IP = '45.79.218.79';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('O-Clan Manager')
    .addItem('Setup / Configure', 'showOClanManagerSetup')
    .addItem('Check configuration', 'showOClanManagerStatus')
    .addSeparator()
    .addItem('Install collector', 'installOClanManagerCollector')
    .addToUi();
}

function showOClanManagerSetup() {
  const html = HtmlService.createHtmlOutput(`
<style>body{font:14px Arial;padding:18px;color:#2d241c;background:#f5ead5}h2{margin:0 0 6px}p{line-height:1.45}.box{padding:12px;background:#fff8e9;border:1px solid #c9a56b;border-radius:8px;margin:12px 0}label{display:block;font-weight:700;margin-top:12px}input{box-sizing:border-box;width:100%;padding:9px;margin-top:5px;border:1px solid #9d7b4c;border-radius:6px}button{width:100%;margin-top:16px;padding:10px;border:0;border-radius:7px;background:#d99b27;font-weight:700;cursor:pointer}.small{font-size:12px;color:#6f604e}.ip{font-family:monospace;font-weight:700}#status{margin-top:12px;white-space:pre-wrap}</style>
<h2>O-Clan Manager Setup</h2><p>Connect this spreadsheet to the Clash of Clans API.</p>
<div class="box"><b>Supercell API key</b><br>Allowed IP for the key:<br><span class="ip">${OCM_PROXY_IP}</span><button type="button" onclick="copyIp()">Copy allowed IP</button><p class="small">API traffic uses RoyaleAPI's Clash of Clans proxy so Apps Script does not need a fixed outbound IP.</p></div>
<label>Clan tag</label><input id="tag" placeholder="#2ABCDEF"><label>Supercell API token</label><input id="token" type="password" placeholder="Paste token here"><button onclick="save()">Save configuration</button><div id="status"></div>
<script>function copyIp(){navigator.clipboard.writeText('${OCM_PROXY_IP}')}function save(){const tag=document.getElementById('tag').value.trim(),token=document.getElementById('token').value.trim(),s=document.getElementById('status');if(!tag||!token){s.textContent='Clan tag and API token are required.';return}s.textContent='Saving…';google.script.run.withSuccessHandler(r=>s.textContent=r.message).withFailureHandler(e=>s.textContent='Error: '+e.message).saveOClanManagerSetup(tag,token)}</script>`).setTitle('O-Clan Manager Setup').setWidth(390);
  SpreadsheetApp.getUi().showSidebar(html);
}

function saveOClanManagerSetup(clanTag, token) {
  let tag = String(clanTag || '').trim().toUpperCase();
  if (tag && !tag.startsWith('#')) tag = '#' + tag;
  const apiToken = String(token || '').trim();
  if (!/^#[0289PYLQGRJCUV]+$/.test(tag)) throw new Error('Invalid Clash of Clans clan tag.');
  if (!apiToken) throw new Error('API token is required.');
  PropertiesService.getScriptProperties().setProperties({CLAN_TAG: tag, COC_API_TOKEN: apiToken, BASE_URL: OCM_PROXY_URL}, false);
  return {ok:true,message:'Saved. Now choose O-Clan Manager → Install collector, then deploy the Apps Script project as a Web App.'};
}

function installOClanManagerCollector() {
  setupCollector();
  SpreadsheetApp.getUi().alert('O-Clan Manager', 'Collector sheets created and the existing 30-minute collector trigger installed.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function getOClanManagerStatus_() {
  const p=PropertiesService.getScriptProperties(), triggers=ScriptApp.getProjectTriggers();
  return {clanConfigured:Boolean(p.getProperty('CLAN_TAG')),tokenConfigured:Boolean(p.getProperty('COC_API_TOKEN')),proxyConfigured:p.getProperty('BASE_URL')===OCM_PROXY_URL,syncTriggerInstalled:triggers.some(t=>t.getHandlerFunction()==='runCollector'),clanTag:p.getProperty('CLAN_TAG')||''};
}

function showOClanManagerStatus() {
  const s=getOClanManagerStatus_();
  SpreadsheetApp.getUi().alert('O-Clan Manager status',[`Clan: ${s.clanConfigured?s.clanTag:'not configured'}`,`API token: ${s.tokenConfigured?'configured':'missing'}`,`API proxy: ${s.proxyConfigured?'configured':'missing'}`,`Collector trigger: ${s.syncTriggerInstalled?'installed':'missing'}`].join('\n'),SpreadsheetApp.getUi().ButtonSet.OK);
}
