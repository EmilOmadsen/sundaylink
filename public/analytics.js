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

  // Top songs
  loadTopSongs();
  
  // Song popularity pie chart
  loadSongPieChart();

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

// Load top songs for the current campaign
async function loadTopSongs() {
  const container = el('topSongs');
  container.innerHTML = 'Loading...';
  
  try {
    const campaignId = new URLSearchParams(window.location.search).get('campaignId');
    if (!campaignId) {
      container.innerHTML = 'No campaign selected';
      return;
    }
    
    const response = await fetch(`/api/metrics/campaigns/${campaignId}/songs`);
    const data = await response.json();
    
    if (data.songs && data.songs.length > 0) {
      container.innerHTML = data.songs.slice(0, 10).map((song, index) => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eee;">
          <div style="font-weight: bold; color: #1db954; min-width: 20px;">#${index + 1}</div>
          <div style="flex: 1;">
            <div style="font-weight: 500;">${song.track_name}</div>
            <div style="font-size: 12px; color: #666;">${song.artist_name}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #666;">
            <div style="font-weight: bold; color: #1db954;">${song.play_count} plays</div>
            <div>${song.unique_listeners} listeners</div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = 'No songs data available yet. Click tracking links and stream music!';
    }
  } catch (error) {
    console.error('Error loading top songs:', error);
    container.innerHTML = 'Error loading songs data';
  }
}

// Load song popularity pie chart across all campaigns
async function loadSongPieChart() {
  const canvas = el('songPieChart');
  if (!canvas) return;
  
  try {
    // Get all campaigns with their song data
    const campaignsResponse = await fetch('/api/metrics/campaigns');
    const campaignsData = await campaignsResponse.json();
    
    if (!campaignsData.campaigns || campaignsData.campaigns.length === 0) {
      canvas.parentElement.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No campaigns found</div>';
      return;
    }
    
    // Collect all songs from all campaigns
    const allSongs = [];
    for (const campaign of campaignsData.campaigns) {
      try {
        const songsResponse = await fetch(`/api/metrics/campaigns/${campaign.id}/songs`);
        const songsData = await songsResponse.json();
        
        if (songsData.songs && songsData.songs.length > 0) {
          songsData.songs.forEach(song => {
            allSongs.push({
              ...song,
              campaign_name: campaign.name,
              campaign_id: campaign.id
            });
          });
        }
      } catch (error) {
        console.error(`Error fetching songs for campaign ${campaign.id}:`, error);
      }
    }
    
    if (allSongs.length === 0) {
      canvas.parentElement.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No songs data found</div>';
      return;
    }
    
    // Group songs by track and sum play counts
    const songMap = new Map();
    allSongs.forEach(song => {
      const key = `${song.track_name} - ${song.artist_name}`;
      if (songMap.has(key)) {
        songMap.get(key).play_count += song.play_count;
        songMap.get(key).unique_listeners += song.unique_listeners;
      } else {
        songMap.set(key, {
          track_name: song.track_name,
          artist_name: song.artist_name,
          play_count: song.play_count,
          unique_listeners: song.unique_listeners,
          spotify_url: song.spotify_url,
          campaign_name: song.campaign_name
        });
      }
    });
    
    // Sort by play count and take top 8 for better pie chart readability
    const topSongs = Array.from(songMap.values())
      .sort((a, b) => b.play_count - a.play_count)
      .slice(0, 8);
    
    if (topSongs.length === 0) {
      canvas.parentElement.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No songs data available</div>';
      return;
    }
    
    // Generate colors for the pie chart
    const colors = [
      '#1db954', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
    ];
    
    const chartData = {
      labels: topSongs.map(song => song.track_name.length > 20 ? 
        song.track_name.substring(0, 20) + '...' : song.track_name),
      datasets: [{
        data: topSongs.map(song => song.play_count),
        backgroundColor: colors.slice(0, topSongs.length),
        borderColor: '#fff',
        borderWidth: 2,
        hoverBorderWidth: 3
      }]
    };
    
    // Destroy existing chart if it exists
    if (window.songPieChart) {
      window.songPieChart.destroy();
    }
    
    window.songPieChart = new Chart(canvas, {
      type: 'pie',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const song = topSongs[context.dataIndex];
                return [
                  `${song.track_name}`,
                  `Artist: ${song.artist_name}`,
                  `Plays: ${song.play_count}`,
                  `Listeners: ${song.unique_listeners}`,
                  `Campaign: ${song.campaign_name}`
                ];
              }
            }
          }
        },
        onClick: function(event, elements) {
          if (elements.length > 0) {
            const song = topSongs[elements[0].index];
            if (song.spotify_url) {
              window.open(song.spotify_url, '_blank');
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error loading song pie chart:', error);
    canvas.parentElement.innerHTML = '<div style="text-align: center; color: #d32f2f; padding: 20px;">Error loading chart</div>';
  }
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


