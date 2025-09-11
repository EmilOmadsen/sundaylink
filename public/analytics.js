/* Analytics page logic - vanilla JS + Chart.js */
const qs = new URLSearchParams(location.search);
const campaignId = qs.get('campaignId');
let rangeDays = 14;
let utmMode = 'streams';

// Elements
const el = (id) => document.getElementById(id);

// Formatters
const fmt = new Intl.NumberFormat();
const pct = (n) => `${(n*100).toFixed(0)}%`;
const safe = (n) => Math.max(n ?? 0, 0);
const computeSL = (streams, listeners) => safe(streams) / Math.max(safe(listeners), 1);

// Date helpers
const toLocal = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString();
const addDays = (d, delta) => new Date(new Date(d).getTime() + delta*86400000);

function rangeFromSeries(series, days){
  const sorted = [...(series||[])].sort((a,b)=>a.date.localeCompare(b.date));
  if(!sorted.length) return {cur:[], prev:[]};
  const last = sorted.at(-1).date;
  const end = new Date(`${last}T00:00:00Z`).getTime();
  const start = end - (days-1)*86400000;
  const prevStart = start - days*86400000, prevEnd = start - 86400000;
  const between=(t,a,b)=>t>=a && t<=b;
  const cur = sorted.filter(p=>between(new Date(`${p.date}T00:00:00Z`).getTime(), start, end));
  const prev = sorted.filter(p=>between(new Date(`${p.date}T00:00:00Z`).getTime(), prevStart, prevEnd));
  return {cur, prev};
}

const sumBy=(arr,sel)=>arr.reduce((a,x)=>a+(sel(x)||0),0);
const totals=(series)=>({
  clicks: sumBy(series,s=>s.clicks),
  listeners: sumBy(series,s=>s.listeners),
  streams: sumBy(series,s=>s.streams),
});
const deltaPct=(c,p)=> p<=0 ? (c>0?1:0) : (c-p)/p;

// Charts
let trendsChart, utmChart, attribChart, funnelChart, followersSpark;

function tinySparkConfig(data, color){
  return {
    type:'line', data:{ labels:data.map((_,i)=>i), datasets:[{ data, borderColor:color, tension:0.35, fill:false } ] },
    options:{ plugins:{legend:{display:false}, tooltip:{enabled:false}}, scales:{x:{display:false}, y:{display:false}}, elements:{point:{radius:0}} }
  };
}

function lineChartConfig(labels, streams, listeners, clicks){
  return {
    type:'line',
    data:{ labels, datasets:[
      { label:'Streams', data:streams, borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,0.1)', tension:0.3, fill:true },
      { label:'Listeners', data:listeners, borderColor:'#059669', backgroundColor:'rgba(5,150,105,0.1)', tension:0.3, fill:true },
      { label:'Clicks', data:clicks, borderColor:'#2563eb', borderDash:[4,4], tension:0.3, fill:false }
    ]},
    options:{ responsive:true, plugins:{ tooltip:{ callbacks:{ label:(ctx)=> `${ctx.dataset.label}: ${fmt.format(ctx.parsed.y)}` } } } }
  };
}

function hbarConfig(labels, values, color){
  return {
    type:'bar', data:{ labels, datasets:[{ label:'Value', data:values, backgroundColor:color }] },
    options:{ indexAxis:'y', plugins:{legend:{display:false}, tooltip:{callbacks:{label:(c)=>fmt.format(c.parsed.x)}}}, scales:{ x:{beginAtZero:true} } }
  };
}

function doughnutConfig(labels, values, colors){
  return { type:'doughnut', data:{ labels, datasets:[{ data:values, backgroundColor:colors }] }, options:{ plugins:{legend:{position:'bottom'}} } };
}

function funnelConfig(clicks, listeners, streams){
  const c2l = listeners/Math.max(clicks,1);
  const l2s = streams/Math.max(listeners,1);
  return { type:'bar', data:{ labels:['Clicks','Listeners','Streams'], datasets:[{ data:[clicks,listeners,streams], backgroundColor:['#2563eb','#059669','#7c3aed'] }] }, options:{ plugins:{tooltip:{callbacks:{label:(c)=>fmt.format(c.parsed.y)}}} } };
}

async function loadData(){
  if(!campaignId){
    el('narrative').textContent = 'Provide ?campaignId=... in URL.';
    return;
  }
  // Determine date range via ?from/&to if present; else compute from series later
  const res = await fetch(`/api/metrics/campaigns/${encodeURIComponent(campaignId)}`);
  const json = await res.json();

  // Header
  el('campaignName').textContent = json.campaign?.name || 'Campaign';
  el('campaignCreated').textContent = json.campaign?.created ? `Created ${new Date(json.campaign.created).toLocaleDateString()}` : '';
  el('campaignStatus').textContent = json.campaign?.status || '—';

  const series = json.series || [];
  const {cur, prev} = rangeFromSeries(series, rangeDays);
  const tCur = totals(cur), tPrev = totals(prev);
  const slCur = computeSL(tCur.streams, tCur.listeners);
  const slPrev = computeSL(tPrev.streams, tPrev.listeners);

  const dClicks = deltaPct(tCur.clicks, tPrev.clicks);
  const dListeners = deltaPct(tCur.listeners, tPrev.listeners);
  const dStreams = deltaPct(tCur.streams, tPrev.streams);
  const dSL = deltaPct(slCur, slPrev);

  // Narrative
  const trend = dClicks>0.05?'up':(dClicks<-0.05?'down':'flat');
  const conv = dSL>0.02?'improving':(dSL<-0.02?'worse':'flat');
  el('narrative').textContent = `Traffic ${trend} ${Math.abs(dClicks*100).toFixed(0)}% vs prior ${rangeDays} days; conversion ${conv}.`;

  // KPI render
  const kpis=[
    {label:'Clicks', val:tCur.clicks, delta:dClicks, color:'#2563eb', data:cur.map(p=>p.clicks||0)},
    {label:'Listeners', val:tCur.listeners, delta:dListeners, color:'#059669', data:cur.map(p=>p.listeners||0)},
    {label:'Streams', val:tCur.streams, delta:dStreams, color:'#7c3aed', data:cur.map(p=>p.streams||0)},
    {label:'S/L', val:Number(slCur.toFixed(2)), delta:dSL, color:'#111827', data:cur.map(p=>computeSL(p.streams,p.listeners))},
  ];
  const grid = el('kpiGrid'); grid.innerHTML='';
  kpis.forEach((k,i)=>{
    const c = document.createElement('div'); c.className='card';
    c.innerHTML = `<div class="row"><div><div class="muted">${k.label}</div><div class="kpi-value">${fmt.format(k.val)}</div></div>
      <div class="delta ${k.delta>=0?'up':'down'}">${k.delta>=0?'▲':'▼'} ${pct(Math.abs(k.delta))}</div></div>
      <canvas height="40" aria-hidden="true"></canvas>`;
    grid.appendChild(c);
    const ctx = c.querySelector('canvas'); new Chart(ctx, tinySparkConfig(k.data, k.color));
  });

  // Trends chart
  const labels = cur.map(p=>toLocal(p.date));
  trendsChart?.destroy();
  trendsChart = new Chart(el('trendsChart'), lineChartConfig(labels, cur.map(p=>p.streams||0), cur.map(p=>p.listeners||0), cur.map(p=>p.clicks||0)));

  // Funnel
  funnelChart?.destroy();
  funnelChart = new Chart(el('funnelChart'), funnelConfig(tCur.clicks, tCur.listeners, tCur.streams));

  // Followers sparkline (use cumulative delta over period as a flat line baseline)
  followersSpark?.destroy();
  followersSpark = new Chart(el('followersSpark'), tinySparkConfig(cur.map(p=> (p.streams||0) ), '#111827'));

  // UTM breakdown
  const utm = json.utm || [];
  const roll = new Map();
  utm.forEach(u=>{
    const key = [u.source,u.medium].filter(Boolean).join(' / ') || 'unknown';
    const v = utmMode==='streams' ? (u.streams||0) : (u.clicks||0);
    roll.set(key, (roll.get(key)||0)+v);
  });
  const top = [...roll.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  utmChart?.destroy();
  utmChart = new Chart(el('utmChart'), hbarConfig(top.map(x=>x[0]), top.map(x=>x[1]), utmMode==='streams'?'#7c3aed':'#2563eb'));

  // Attribution doughnut
  const a = json.attribution || {}; const vals=[a.direct1_0||0, a.assisted0_6||0, a.assisted0_3||0];
  attribChart?.destroy();
  attribChart = new Chart(el('attribChart'), doughnutConfig(['1.0 High','0.6 Medium','0.3 Low'], vals, ['#059669','#f59e0b','#ef4444']));

  // Recent activity
  const recent = (json.recent||[]).slice(0,20);
  const list = el('recentList'); list.innerHTML='';
  recent.forEach(r=>{
    const li=document.createElement('li');
    li.innerHTML = `<b>${r.type}</b> · ${new Date(r.ts).toLocaleString()} · ${(r.utm_source||'-')}/${(r.utm_medium||'-')}`;
    list.appendChild(li);
  });

  el('empty').style.display = cur.length===0 ? 'block' : 'none';
}

// Event wiring
el('range24h').onclick = ()=>{ rangeDays=1; loadData(); };
el('range7').onclick = ()=>{ rangeDays=7; loadData(); };
el('range14').onclick = ()=>{ rangeDays=14; loadData(); };
el('range30').onclick = ()=>{ rangeDays=30; loadData(); };
el('utmStreams').onclick = ()=>{ utmMode='streams'; loadData(); };
el('utmClicks').onclick = ()=>{ utmMode='clicks'; loadData(); };
// new ranges
const bindRange = (id, days)=>{ const b=el(id); if(b) b.onclick=()=>{ rangeDays=days; loadData(); }; };
bindRange('range60',60);
bindRange('range180',180);
bindRange('range365',365);

// Init
loadData().catch(console.error);

// Lightweight tests for helpers (console-based)
if (typeof window !== 'undefined'){
  (function(){
    console.assert(pct(0.25)==='25%','pct');
    console.assert(computeSL(10,0)===10,'sl div-by-zero');
    const r=rangeFromSeries([{date:'2025-01-01'},{date:'2025-01-02'}],7); console.assert(Array.isArray(r.cur),'range');
  })();
}


