import { useState, useEffect, useMemo } from 'react'
// Pake proxy Vercel, bukan langsung ke supabase.co (biar gak ke-block DNS)
async function fetchViaProxy(table) {
  const r = await fetch(`/api/supabase?table=${table}&select=*`);
  if (!r.ok) throw new Error('Proxy gagal: ' + r.status);
  return await r.json();
}
async function saveViaProxy(table, rows) {
  const r = await fetch(`/api/supabase?table=${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error('Simpan gagal: ' + r.status + ' ' + txt.slice(0, 300));
  try { return JSON.parse(txt); } catch { return txt; }
}

const UNITS = ["UID Jaya","UID Jabar","UID NTB","UID NTT","PLN NP","UIK Dwipantara","Pusdiklat","Pusharlis","Pusmanpro","Puslitbang","PLN E","UID Kalbar","Kantor Pusat","Ex Pembangkit","PLN Batam","UID Banten","UID S2JB","UIW Babel","UID Lampung","Nusa Daya","UID Sumut","UID RKR","UID Kaltimra","PLN EMI","UID Jatim","UID Jateng","Pusertif","PLN EPI","UIP3B Sumatera","UIP3B Kalimantan","UIP3B Sulawesi","UP2B Jamali","PLN MCTN","UIT JBB","UIT JBT","UIT JBTB","ES","UID Kalselteng","UID Sulselrabar","UID Sulutenggo","PLN IP","UID Bali","UID MMU","UID P2B","PLN Icon","UID DIY","UIK TJB","UID Sumbar","UID NAD"]

const KOMPONEN_LIST = ['Komponen A','Komponen B','Komponen C','Komponen D','Komponen E']
const KOMPONEN_SHORT = ['Komp A','Komp B','Komp C','Komp D','Komp E']

// Fallback doang kalo Supabase kosong / offline. Tampilan pake auditors dari Supabase, bukan ini.
const AUDITORS_DATA = [
  {name:"DIAN PUTRI MANULLANG", units:4, progress:75},
  {name:"LITANY MEGA PUTRI", units:4, progress:75},
  {name:"RIKE ENDAH RAHMAWATI", units:4, progress:75},
  {name:"ADITIA FIRMANSYAH", units:4, progress:0},
  {name:"AGUNG ARDITYAS", units:6, progress:100},
  {name:"KHAIRAWATI", units:5, progress:80},
  {name:"RISKI NUGRAHA ANINDITYA", units:6, progress:83},
  {name:"TRIAS PRASETYO", units:4, progress:50},
  {name:"DEWI AGHNIA PUTRI HANDAYANI", units:4, progress:75},
]

const fmtRp = (n) => 'Rp' + Number(n||0).toLocaleString('id-ID');

export default function App(){
  const [search,setSearch]=useState('')
  const [selUnit,setSelUnit]=useState('Semua Unit')
  const [selKomp,setSelKomp]=useState('Semua Komponen')
  const [selAuditor,setSelAuditor]=useState('Semua Auditor')
  const [selTW,setSelTW]=useState('TW3')
  const [selAvg,setSelAvg]=useState('Avg 0%')
  const [selStatus,setSelStatus]=useState('All Status')
  const [activeMenu,setActiveMenu]=useState('Dashboard')
  const [units,setUnits]=useState(UNITS)
  const [kkData,setKkData]=useState(()=>{
    try{ const s=localStorage.getItem('nac_kk_final_v1'); return s?JSON.parse(s):{} }catch{return {}}
  })
  const [auditors,setAuditors]=useState(()=>{
    try{ const s=localStorage.getItem('nac_auditors_final_v1'); return s?JSON.parse(s): AUDITORS_DATA.map(a=>({name:a.name,nip:''})) }catch{return AUDITORS_DATA.map(a=>({name:a.name,nip:''}))}
  })
  const [assignMap,setAssignMap]=useState(()=>{
    try{ const s=localStorage.getItem('nac_assign_final_v1'); return s?JSON.parse(s):{} }catch{return {}}
  })
  const [showKelola,setShowKelola]=useState(false)
  const [showAssign,setShowAssign]=useState(false)
  const [newAudName,setNewAudName]=useState('')
  const [newAudNIP,setNewAudNIP]=useState('')
  // Save Kertas Kerja ke Supabase
  const [isDirty,setIsDirty]=useState(false)
  const [isSaving,setIsSaving]=useState(false)
  const [saveStatus,setSaveStatus]=useState('')
  // Pagination Kertas Kerja: 25 per halaman
  const [kkPage,setKkPage]=useState(1)
  const KK_PAGE_SIZE = 25
  const fmtNum = (n) => { const v = Number(n||0); return v ? v.toLocaleString('id-ID') : ''; };
  const parseNum = (s) => { const v = Number(String(s||'').replace(/\./g,'').replace(/[^0-9-]/g,'')); return isNaN(v) ? 0 : v; };

  useEffect(()=>{ localStorage.setItem('nac_auditors_final_v1',JSON.stringify(auditors)) },[auditors])
  useEffect(()=>{ localStorage.setItem('nac_assign_final_v1',JSON.stringify(assignMap)) },[assignMap])
  useEffect(()=>{ localStorage.setItem('nac_kk_final_v1',JSON.stringify(kkData)) },[kkData])

  useEffect(() => {
  (async () => {
    try {
      const unitsData = await fetchViaProxy('nac_units');
      if (unitsData?.length) setUnits(unitsData.map(d => d.name));
      const kertas = await fetchViaProxy('nac_kertas');
      if (kertas?.length) {
        const map = {};
        kertas.forEach(row => {
          // FIX: id dari hub = "UID Jaya__A" atau "UID Jaya__A__TW3"
          // UI Vite pake kunci "UID Jaya__Komponen A__TW3", jadi harus dikonversi
          const parts = (row.id || '').split('__');
          const unitPart = parts[0];
          let kompShort = parts[1] || 'A';
          if (kompShort.startsWith('Komponen ')) kompShort = kompShort.replace('Komponen ', '');
          const twPart = (parts[2] && parts[2].startsWith('TW')) ? parts[2] : 'TW3';
          const id = `${unitPart}__Komponen ${kompShort}__${twPart}`;
          map[id] = { asersi: Number(row.asersi || 0), verifikasi: Number(row.verifikasi || 0) };
        });
        setKkData(map);
      }
      const auds = await fetchViaProxy('nac_auditors');
      if (auds?.length) setAuditors(auds.map(a => ({ name: a.nama, nip: a.nip || '' })));
      const assigns = await fetchViaProxy('nac_assignments');
      if (assigns?.length && auds?.length) {
        const m = {};
        assigns.forEach(a => {
          if (!m[a.unit]) m[a.unit] = [];
          const found = auds.find(x => x.id === a.auditor_id);
          if (found && !m[a.unit].includes(found.nama)) m[a.unit].push(found.nama);
        });
        setAssignMap(m);
      }
    } catch (e) { console.log('Proxy fetch gagal, pake localStorage:', e.message); }
  })();
}, []);

  // FILTER LOGIC
  const filteredUnits = useMemo(()=>{
    let list = units
    if(search) list = list.filter(u=>u.toLowerCase().includes(search.toLowerCase()))
    if(selUnit!=='Semua Unit') list = list.filter(u=>u===selUnit)
    if(selAuditor!=='Semua Auditor'){
      list = list.filter(u=> (assignMap[u]||[]).includes(selAuditor))
    }
    return list
  },[units,search,selUnit,selAuditor,assignMap])

  const filteredKomp = useMemo(()=>{
    if(selKomp==='Semua Komponen') return KOMPONEN_LIST
    return [selKomp]
  },[selKomp])

  useEffect(()=>{ setKkPage(1); },[search, selUnit, selKomp, selAuditor, selTW]);

  // FIX: progres auditor dihitung dari kkData, bukan hardcoded AUDITORS_DATA
  const filteredAuditors = useMemo(()=>{
    let list = auditors.map((a)=>{
      const assignedUnits = Object.entries(assignMap).filter(([_,ls])=>ls.includes(a.name)).map(([u,_])=>u);
      const assignedCount = assignedUnits.length || 0;
      let total = 0, done = 0;
      assignedUnits.forEach(u=>{
        KOMPONEN_LIST.forEach(komp=>{
          const twList = selTW==='TW ALL' ? ['TW1','TW2','TW3','TW4'] : [selTW];
          twList.forEach(tw=>{
            const d = kkData[`${u}__${komp}__${tw}`];
            if(!d) return;
            total++;
            if((Number(d.asersi||0)===0 && Number(d.verifikasi||0)===0) || Number(d.verifikasi||0)>0) done++;
          });
        });
      });
      const progress = total>0 ? Math.round(done/total*100) : 0;
      return { name: a.name, nip: a.nip||'', units: assignedCount, progress };
    })
    if(selAuditor!=='Semua Auditor'){
      list = list.filter(a=>a.name===selAuditor)
    }
    if(selAvg!=='Avg 0%'){
      const threshold = parseInt(selAvg.replace('Avg ','').replace('%',''))||0
      if(selAvg.includes('>')) list = list.filter(a=>a.progress>=threshold)
      else if(threshold>0) list = list.filter(a=>a.progress>=threshold)
    }
    if(selStatus!=='All Status'){
      if(selStatus==='Selesai') list = list.filter(a=>a.progress===100)
      else if(selStatus==='Belum') list = list.filter(a=>a.progress===0)
      else if(selStatus==='Progres') list = list.filter(a=>a.progress>0 && a.progress<100)
    }
    return list
  },[auditors,assignMap,selAuditor,selAvg,selStatus,kkData,selTW])

  // FIX: KPI dihitung dari kkData, bukan hardcoded Rp21T / Rp5T
  const kpi = useMemo(()=>{
    let asersi=0, verifikasi=0, totalCell=0, doneCell=0;
    const twList = selTW==='TW ALL' ? ['TW1','TW2','TW3','TW4'] : [selTW];
    filteredUnits.forEach(u=>{
      filteredKomp.forEach(komp=>{
        twList.forEach(tw=>{
          const d = kkData[`${u}__${komp}__${tw}`];
          if(!d) return;
          asersi += Number(d.asersi||0);
          verifikasi += Number(d.verifikasi||0);
          totalCell++;
          if((Number(d.asersi||0)===0 && Number(d.verifikasi||0)===0) || Number(d.verifikasi||0)>0) doneCell++;
        });
      });
    });
    const selisih = asersi - verifikasi;
    const unitDone = filteredUnits.filter(u=>{
      // unit dianggap selesai kalo semua komponen di TW yang dipilih selesai
      let t=0, dn=0;
      filteredKomp.forEach(komp=>{
        twList.forEach(tw=>{
          const d = kkData[`${u}__${komp}__${tw}`];
          if(!d) return;
          t++;
          if((Number(d.asersi||0)===0 && Number(d.verifikasi||0)===0) || Number(d.verifikasi||0)>0) dn++;
        });
      });
      return t>0 && dn===t;
    }).length;
    const pct = totalCell>0 ? Math.round(doneCell/totalCell*100) : 0;
    return { asersi, verifikasi, selisih, totalCell, doneCell, unitDone, pct };
  },[kkData, filteredUnits, filteredKomp, selTW])

  // FIX: Chart dihitung dari kkData, bukan [{a:45,v:35}...] mati
  const chartData = useMemo(()=>{
    const twList = selTW==='TW ALL' ? ['TW1','TW2','TW3','TW4'] : [selTW];
    return KOMPONEN_LIST.map(komp=>{
      let a=0, v=0;
      filteredUnits.forEach(u=>{
        twList.forEach(tw=>{
          const d = kkData[`${u}__${komp}__${tw}`];
          if(!d) return;
          a += Number(d.asersi||0);
          v += Number(d.verifikasi||0);
        });
      });
      return { komp, a, v, selisih: a-v };
    });
  },[kkData, filteredUnits, selTW]);

  const maxChart = useMemo(()=>{
    let m = 1;
    chartData.forEach(d=>{ m = Math.max(m, d.a, d.v, d.selisih); });
    return m;
  },[chartData]);

  const downloadExcel=()=>{
    let rows=[['UNIT','Komponen','TW','Asersi','Verifikasi','Selisih','Auditor','Filter: '+selUnit+'|'+selKomp+'|'+selAuditor+'|'+selTW]]
    if(activeMenu==='Kertas Kerja'){
      filteredUnits.forEach(u=>{
        filteredKomp.forEach(komp=>{
          const twList = selTW==='TW ALL' ? ['TW1','TW2','TW3','TW4'] : [selTW]
          twList.forEach(tw=>{
            const key=`${u}__${komp}__${tw}`
            const d=kkData[key]||{}
            rows.push([u,komp,tw,d.asersi||0,d.verifikasi||0,(d.asersi||0)-(d.verifikasi||0),(assignMap[u]||[]).join('; ')])
          })
        })
      })
    } else {
      filteredAuditors.forEach(a=> rows.push([a.name,a.units+' unit',a.progress+'%','','','','']))
    }
    if(rows.length===1) rows.push(['No data','Sesuaikan filter'])
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`NAC_${selUnit}_${selKomp}_${selTW}_${new Date().toISOString().slice(0,10)}.csv`;a.click()
  }

  const handleKK = (unit,komp,tw,field,val)=>{
    const key=`${unit}__${komp}__${tw}`
    setKkData(prev=>({...prev,[key]:{...prev[key],[field]:Number(val)||0}}))
    setIsDirty(true)
    setSaveStatus('● Belum disimpan — klik Simpan biar ke Supabase')
  }

  const saveKkToSupabase = async ()=>{
    if(isSaving) return;
    setIsSaving(true); setSaveStatus('Menyimpan ke Supabase...');
    try{
      // Kembalikan kunci Vite "UID Jaya__Komponen A__TW3" ke id hub "UID Jaya__A" (TW3) / "UID Jaya__A__TW1" (TW lain)
      const rows = Object.entries(kkData).map(([key,d])=>{
        const parts = key.split('__');
        const unit = parts[0];
        let kompShort = (parts[1]||'Komponen A').replace('Komponen ','');
        const tw = parts[2]||'TW3';
        const id = tw==='TW3' ? `${unit}__${kompShort}` : `${unit}__${kompShort}__${tw}`;
        return { id, unit, komponen: kompShort, asersi: Number(d.asersi||0), verifikasi: Number(d.verifikasi||0) };
      });
      if(!rows.length) throw new Error('Tidak ada data untuk disimpan');
      await saveViaProxy('nac_kertas', rows);
      setIsDirty(false);
      setSaveStatus('✅ Tersimpan ke Supabase — ' + new Date().toLocaleTimeString('id-ID') + ' • ' + rows.length + ' baris');
    }catch(e){
      setSaveStatus('❌ Gagal simpan: ' + e.message + ' — data masih aman di browser ini');
    }finally{ setIsSaving(false); }
  };

  return (
    <>
    <style>{`
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Inter,system-ui,sans-serif;background:#f5f7fa}
      .layout{display:flex;min-height:100vh}
      .sidebar{width:200px;background:#1e293b;color:white;position:fixed;top:0;left:0;bottom:0;display:flex;flex-direction:column;justify-content:space-between}
      .main{margin-left:200px;flex:1}
      .topbar{background:white;border-bottom:1px solid #e9ecf1;padding:10px 14px;display:flex;gap:8px;align-items:center;position:sticky;top:0;z-index:10;overflow:auto}
      .pill{padding:6px 12px;border-radius:999px;border:1px solid #e9ecf1;background:white;font-size:12px;cursor:pointer;min-width:max-content}
      .pill.active,.pill-black{background:black;color:white;border-color:black}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      .card{background:white;border:1px solid #e9ecf1;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04)}
      .card-dark{background:#1e293b;color:white;border-radius:16px;padding:16px}
      .label{font-size:10px;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase}
      .value{font-weight:700;font-size:17px;margin-top:8px}
      .chart-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
      .bar-row{display:flex;align-items:end;gap:12px;height:200px;padding:0 12px}
      .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px}
      .bars{display:flex;gap:4px;align-items:end;height:160px;width:100%;justify-content:center}
      .bar1{width:40%;background:#1e293b;border-radius:4px 4px 0 0}
      .bar2{width:40%;background:#3b82f6;border-radius:4px 4px 0 0}
      .bar-single{width:50%;background:#60a5fa;border-radius:4px 4px 0 0}
      .auditor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .aud-card{border:1px solid #e9ecf1;border-radius:12px;padding:12px;background:white;cursor:pointer}
      .aud-card:hover{border-color:#cbd5e1}
      .aud-card.selected{border-color:#1e293b;background:#f8fafc}
      .progress{height:6px;background:#f1f5f9;border-radius:999px;margin-top:12px;overflow:hidden}
      .progress-fill{height:6px;background:#1e293b;border-radius:999px}
      .btn{padding:8px 16px;background:white;border:1px solid #e9ecf1;border-radius:999px;font-size:12px;cursor:pointer}
      .btn:hover{background:#f8fafc}
      .btn-primary{background:#1e293b;color:white;border-color:#1e293b}
      .search{padding:6px 12px 6px 28px;border:1px solid #e9ecf1;border-radius:999px;background:#f8fafc;font-size:12px;width:130px}
      .search:focus{outline:none;border-color:#3b82f6;background:white}
      .menu{width:100%;text-align:left;padding:10px 12px;border-radius:12px;font-size:12px;color:rgba(255,255,255,0.6);cursor:pointer;border:none;background:transparent;display:flex;justify-content:space-between;transition:0.2s}
      .menu.active{background:rgba(255,255,255,0.1);color:white}
      .menu:hover{background:rgba(255,255,255,0.05);color:white}
      .table-wrap{overflow:auto;max-height:600px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{position:sticky;top:0;background:#f8fafc;padding:10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e9ecf1;z-index:1}
      td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
      input.num{width:120px;text-align:right;padding:6px 8px;border-radius:8px;border:1px solid #a7f3d0;background:#ecfdf5;font-size:12px}
      input.num.ver{background:#eff6ff;border-color:#bfdbfe}
      input.num:focus{outline:none;border-color:#3b82f6;background:white}
      .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:50}
      .modal{background:white;border-radius:16px;width:480px;padding:20px;max-height:80vh;overflow:auto}
    `}</style>
    <div className="layout">
      <div className="sidebar">
        <div>
          <div style={{padding:'16px',borderBottom:'1px solid rgba(255,255,255,0.1)',display:'flex',gap:'8px',alignItems:'center'}}>
            <div style={{width:'32px',height:'32px',background:'rgba(255,255,255,0.1)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'11px'}}>NAC</div>
            <div><div style={{fontWeight:'700',fontSize:'12px'}}>NAC VERIFIKASI</div><div style={{fontSize:'10px',color:'rgba(255,255,255,0.5)',letterSpacing:'0.1em'}}>SPI SYSTEM</div></div>
          </div>
          <div style={{padding:'8px'}}>
            <button onClick={()=>setActiveMenu('Dashboard')} className={`menu ${activeMenu==='Dashboard'?'active':''}`}><span>Dashboard</span><span style={{fontSize:'10px',background:'rgba(255,255,255,0.1)',padding:'2px 8px',borderRadius:'999px'}}>KPI</span></button>
            <button onClick={()=>setActiveMenu('Kertas Kerja')} className={`menu ${activeMenu==='Kertas Kerja'?'active':''}`}><span>Kertas Kerja</span></button>
            <button onClick={()=>setActiveMenu('Progres Auditor')} className={`menu ${activeMenu==='Progres Auditor'?'active':''}`}><span>Progres Auditor</span><span style={{fontSize:'10px',background:'rgba(255,255,255,0.1)',padding:'2px 8px',borderRadius:'999px'}}>{filteredAuditors.filter(a=>a.progress>0).length}</span></button>
            <button onClick={()=>setShowKelola(true)} className="menu"><span>Kelola Auditor</span></button>
            <button onClick={()=>setShowAssign(true)} className="menu"><span>Assign Auditor</span></button>
          </div>
          <div style={{margin:'16px 12px',padding:'12px',background:'rgba(255,255,255,0.05)',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.1)'}}>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)'}}>{units.length} Unit • {auditors.length} Auditor</div>
            <div style={{fontSize:'11px',fontWeight:'600',marginTop:'4px'}}>{filteredUnits.length} Unit • {filteredAuditors.length} Auditor</div>
            <div style={{height:'4px',background:'rgba(255,255,255,0.1)',borderRadius:'999px',marginTop:'8px'}}><div style={{height:'4px',width:'40%',background:'rgba(255,255,255,0.3)',borderRadius:'999px'}}></div></div>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginTop:'4px'}}>Filter aktif: {selUnit!=='Semua Unit'||selAuditor!=='Semua Auditor'? 'Ya':'Tidak'}</div>
          </div>
        </div>
        <div style={{padding:'12px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
          <button style={{width:'100%',background:'white',color:'#1e293b',borderRadius:'12px',padding:'10px',fontSize:'12px',fontWeight:'500',border:'none',cursor:'pointer'}}>⚙ Setting Supabase</button>
          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',marginTop:'8px'}}>Unit list editable via Supabase</div>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div style={{position:'relative'}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari UID Jaya" className="search"/><span style={{position:'absolute',left:'8px',top:'7px',color:'#94a3b8',fontSize:'12px'}}>⌕</span></div>
          <select value={selUnit} onChange={e=>setSelUnit(e.target.value)} className="pill"><option>Semua Unit</option>{units.map(u=><option key={u}>{u}</option>)}</select>
          <select value={selKomp} onChange={e=>setSelKomp(e.target.value)} className="pill"><option>Semua Komponen</option>{KOMPONEN_LIST.map(k=><option key={k}>{k}</option>)}</select>
          <select value={selAuditor} onChange={e=>setSelAuditor(e.target.value)} className="pill"><option>Semua Auditor</option>{auditors.map(a=><option key={a.name}>{a.name}</option>)}</select>
          <div style={{display:'flex',background:'#f1f5f9',borderRadius:'999px',padding:'4px'}}>
            {['TW ALL','TW1','TW2','TW3','TW4'].map(t=><button key={t} onClick={()=>setSelTW(t)} className={`pill ${selTW===t?'pill-black':''}`} style={{border:'none',background:selTW===t?'black':'transparent',color:selTW===t?'white':'#64748b'}}>{t}</button>)}
          </div>
          <select value={selAvg} onChange={e=>setSelAvg(e.target.value)} className="pill"><option>Avg 0%</option><option>Avg 25%</option><option>Avg 50%</option><option>Avg 75%</option></select>
          <select value={selStatus} onChange={e=>setSelStatus(e.target.value)} className="pill"><option>All Status</option><option>Selesai</option><option>Progres</option><option>Belum</option></select>
          <button onClick={downloadExcel} className="btn" style={{marginLeft:'auto'}}>⬇ Download Excel ({filteredUnits.length})</button>
        </div>

        <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:'16px'}}>
          {activeMenu==='Dashboard' && (
            <>
              <div className="kpi-grid">
                <div className="card"><div className="label">Total Nilai Asersi</div><div className="value">{fmtRp(kpi.asersi)}</div><div style={{fontSize:'10px',color:'#64748b',marginTop:'4px'}}>{filteredUnits.length} unit • {kpi.totalCell} baris • {selTW}</div></div>
                <div className="card"><div className="label">Total Verifikasi</div><div className="value">{fmtRp(kpi.verifikasi)}</div><div style={{fontSize:'10px',color:'#059669',marginTop:'4px'}}>Terverifikasi {kpi.unitDone} unit • {selAuditor}</div></div>
                <div className="card"><div className="label">Total Selisih</div><div className="value" style={{color:'#3b82f6'}}>{fmtRp(kpi.selisih)}</div><div style={{fontSize:'10px',color:'#64748b',marginTop:'4px'}}>Asersi - Verifikasi • {selKomp}</div></div>
                <div className="card-dark"><div className="label" style={{color:'rgba(255,255,255,0.5)'}}>Unit Selesai / Progres Verifikasi</div><div style={{fontWeight:'700',marginTop:'8px'}}>{kpi.pct}% <span style={{fontWeight:'400',fontSize:'12px',color:'rgba(255,255,255,0.6)'}}>{kpi.unitDone}/{filteredUnits.length}</span></div><div style={{height:'6px',background:'rgba(255,255,255,0.1)',borderRadius:'999px',marginTop:'12px'}}><div style={{height:'6px',width:kpi.pct+'%',background:'rgba(255,255,255,0.3)',borderRadius:'999px'}}></div></div></div>
              </div>

              <div className="chart-grid">
                <div className="card"><div style={{fontWeight:'600',fontSize:'13px',marginBottom:'24px'}}>Asersi vs Verifikasi per Komponen A-E • {selTW}</div>
                  <div className="bar-row">
                    {chartData.map((d,i)=>(
                      <div key={i} className="bar-col"><div className="bars"><div className="bar1" style={{height:(maxChart>0? (d.a/maxChart*100):0)+'%'}}></div><div className="bar2" style={{height:(maxChart>0? (d.v/maxChart*100):0)+'%'}}></div></div><div style={{fontSize:'11px',color:'#64748b'}}>{'Komp '+['A','B','C','D','E'][i]}</div></div>
                    ))}
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:'16px',marginTop:'16px'}}><div style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{width:'12px',height:'12px',background:'#1e293b',borderRadius:'2px'}}></div><span style={{fontSize:'11px'}}>Asersi</span></div><div style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{width:'12px',height:'12px',background:'#3b82f6',borderRadius:'2px'}}></div><span style={{fontSize:'11px',color:'#3b82f6'}}>Verifikasi</span></div></div>
                </div>
                <div className="card"><div style={{fontWeight:'600',fontSize:'13px',marginBottom:'24px'}}>Total Selisih per Komponen • {selUnit}</div>
                  <div className="bar-row">
                    {chartData.map((d,i)=>(
                      <div key={i} className="bar-col"><div className="bars"><div className="bar-single" style={{height: d.selisih>0 ? (d.selisih/maxChart*100)+'%' : '2px'}}></div></div><div style={{fontSize:'11px',color:'#64748b'}}>{'Komp '+['A','B','C','D','E'][i]}</div></div>
                    ))}
                  </div>
                  <div style={{height:'20px'}}></div>
                </div>
              </div>

              <div className="card">
                <div style={{fontWeight:'600',fontSize:'13px',marginBottom:'16px'}}>Persentase Progres Masing2 Auditor • {filteredAuditors.length} auditor (filter: {selAuditor}, {selAvg}, {selStatus})</div>
                <div className="auditor-grid">
                  {filteredAuditors.map((a,i)=>(
                    <div key={i} className={`aud-card ${selAuditor===a.name?'selected':''}`} onClick={()=>setSelAuditor(a.name)}>
                      <div style={{display:'flex',justifyContent:'space-between'}}><div style={{fontWeight:'600',fontSize:'11px'}}>{a.name}</div><span style={{fontSize:'10px',background:'#f1f5f9',border:'1px solid #e9ecf1',padding:'2px 8px',borderRadius:'999px'}}>{a.progress}%</span></div>
                      <div style={{fontSize:'10px',color:'#64748b',marginTop:'4px'}}>• {a.units} unit • {selTW}</div>
                      <div className="progress"><div className="progress-fill" style={{width:a.progress+'%'}}></div></div>
                    </div>
                  ))}
                  {filteredAuditors.length===0 && <div style={{gridColumn:'span 3',textAlign:'center',padding:'20px',color:'#64748b',fontSize:'12px'}}>Tidak ada auditor sesuai filter {selAuditor} {selAvg} {selStatus}. Reset filter ke Semua Auditor / All Status.</div>}
                </div>
              </div>
            </>
          )}

          {activeMenu==='Kertas Kerja' && (
            <div className="card" style={{padding:'0',overflow:'hidden'}}>
              <div style={{padding:'16px',borderBottom:'1px solid #e9ecf1',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',flexWrap:'wrap'}}><div style={{fontWeight:'600',fontSize:'14px'}}>Kertas Kerja — {selTW} • {filteredUnits.length} Unit • {selKomp} • {selAuditor}</div><div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}><span style={{fontSize:'11px',color:isDirty?'#d97706':'#059669'}}>{saveStatus || (isDirty ? '● Ada perubahan belum disimpan' : 'Semua tersimpan')}</span><button onClick={saveKkToSupabase} disabled={isSaving} className="btn btn-primary" style={{opacity:isSaving?0.6:1}}>{isSaving?'⏳ Menyimpan...':'💾 Simpan Kertas Kerja'}</button><button onClick={downloadExcel} className="btn">⬇ Download Excel ({filteredUnits.length} unit)</button></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>UNIT (klik filter)</th><th>KOMP</th><th>TW</th><th style={{textAlign:'right'}}>A-ASR</th><th style={{textAlign:'right'}}>A-VER</th><th style={{textAlign:'right'}}>A-SEL</th><th>AUDITOR (filter aktif)</th></tr></thead>
                  <tbody>
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(filteredUnits.length / KK_PAGE_SIZE));
                      const safePage = Math.min(kkPage, totalPages);
                      const startIdx = (safePage - 1) * KK_PAGE_SIZE;
                      const pageUnits = filteredUnits.slice(startIdx, startIdx + KK_PAGE_SIZE);
                      return pageUnits.map(u=> filteredKomp.map(komp=> (selTW==='TW ALL'? ['TW1','TW2','TW3','TW4'] : [selTW]).map(tw=>{
                        const key=`${u}__${komp}__${tw}`
                        const d=kkData[key]||{}
                        return (
                          <tr key={key}><td style={{cursor:'pointer'}} onClick={()=>setSelUnit(u)}>{u}</td><td>{komp}</td><td>{tw}</td>
                          <td style={{textAlign:'right'}}><input type="text" inputMode="numeric" className="num" value={fmtNum(d.asersi)} onChange={e=>handleKK(u,komp,tw,'asersi',parseNum(e.target.value))} placeholder="0"/></td>
                          <td style={{textAlign:'right'}}><input type="text" inputMode="numeric" className="num ver" value={fmtNum(d.verifikasi)} onChange={e=>handleKK(u,komp,tw,'verifikasi',parseNum(e.target.value))} placeholder="0"/></td>
                          <td style={{textAlign:'right',fontFamily:'monospace',color:'#2563eb'}}>Rp{((d.asersi||0)-(d.verifikasi||0)).toLocaleString('id-ID')}</td>
                          <td style={{fontSize:'11px',color:'#64748b'}}><span style={{cursor:'pointer'}} onClick={()=>{ if(assignMap[u]?.[0]) setSelAuditor(assignMap[u][0]) }}>{(assignMap[u]||[]).join(', ')|| '— klik Assign'}</span></td></tr>
                        )
                      })))
                    })()}
                  </tbody>
                </table>
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / KK_PAGE_SIZE));
                  const safePage = Math.min(kkPage, totalPages);
                  const startIdx = (safePage - 1) * KK_PAGE_SIZE;
                  const endIdx = Math.min(startIdx + KK_PAGE_SIZE, filteredUnits.length);
                  return (
                    <div style={{padding:'12px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                      <div style={{fontSize:'11px',color:'#64748b'}}>Menampilkan {filteredUnits.length===0?0:startIdx+1}-{endIdx} dari {filteredUnits.length} unit • 25 per halaman</div>
                      <div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
                        <button onClick={saveKkToSupabase} disabled={isSaving} className="btn btn-primary" style={{opacity:isSaving?0.6:1}}>{isSaving?'⏳ Menyimpan...':'💾 Simpan Kertas Kerja'}</button>
                        <span style={{fontSize:'11px',color:isDirty?'#d97706':'#059669'}}>{saveStatus}</span>
                        <button className="btn" disabled={safePage<=1} onClick={()=>setKkPage(safePage-1)} style={{opacity:safePage<=1?0.5:1}}>‹ Sebelumnya</button>
                        <span style={{fontSize:'11px',color:'#334155'}}>Halaman {safePage} dari {totalPages}</span>
                        <button className="btn" disabled={safePage>=totalPages} onClick={()=>setKkPage(safePage+1)} style={{opacity:safePage>=totalPages?0.5:1}}>Berikutnya ›</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeMenu==='Progres Auditor' && (
            <div className="card">
              <div style={{fontWeight:'600',fontSize:'14px',marginBottom:'16px'}}>Progres Auditor Detail — {selTW} • Filter: {selUnit} | {selAuditor} | {selAvg} | {selStatus} — {filteredAuditors.length} auditor</div>
              <div className="auditor-grid">
                {filteredAuditors.map((a,i)=>(
                  <div key={i} className={`aud-card ${selAuditor===a.name?'selected':''}`} onClick={()=>setSelAuditor(a.name)} style={{cursor:'pointer'}}>
                    <div style={{fontWeight:'600',fontSize:'12px'}}>{a.name}</div>
                    <div style={{fontSize:'11px',color:'#64748b',marginTop:'4px'}}>{a.units} unit • {a.progress}% progres • Klik untuk filter unit</div>
                    <div className="progress"><div className="progress-fill" style={{width:a.progress+'%'}}></div></div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:'16px',display:'flex',gap:'8px'}}>
                <button onClick={()=>{setSelUnit('Semua Unit');setSelAuditor('Semua Auditor');setSelAvg('Avg 0%');setSelStatus('All Status');setSearch('')}} className="btn">Reset Semua Filter</button>
                <button onClick={downloadExcel} className="btn btn-primary">⬇ Download Excel Auditor</button>
              </div>
            </div>
          )}

          {activeMenu==='Assign' && (
            <div className="card">
              <div style={{fontWeight:'600',fontSize:'14px',marginBottom:'16px'}}>Assign Auditor ke Unit (multi-select) — {filteredUnits.length} unit terfilter</div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {filteredUnits.slice(0,15).map(u=>(
                  <div key={u} style={{border:'1px solid #e9ecf1',borderRadius:'12px',padding:'12px'}}>
                    <div style={{fontWeight:'600',fontSize:'12px',marginBottom:'8px',cursor:'pointer'}} onClick={()=>setSelUnit(u)}>{u} — klik untuk filter</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                      {auditors.map(a=>{
                        const checked=(assignMap[u]||[]).includes(a.name)
                        return (
                          <label key={a.name} style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 10px',borderRadius:'999px',border:'1px solid #e9ecf1',fontSize:'11px',cursor:'pointer',background:checked?'#1e293b':'white',color:checked?'white':'#334155'}}>
                            <input type="checkbox" checked={checked} onChange={e=>{
                              setAssignMap(prev=>{
                                const cur=prev[u]||[]
                                const next=e.target.checked? [...cur,a.name]: cur.filter(x=>x!==a.name)
                                return {...prev,[u]:next}
                              })
                            }} style={{display:'none'}}/>{a.name}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showKelola && (
        <div className="modal-bg" onClick={()=>setShowKelola(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}><div style={{fontWeight:'700'}}>Kelola Auditor — {auditors.length} auditor</div><button onClick={()=>setShowKelola(false)} style={{border:'none',background:'none',cursor:'pointer'}}>✕</button></div>
            <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
              <input value={newAudName} onChange={e=>setNewAudName(e.target.value)} placeholder="NAMA AUDITOR" style={{flex:1,padding:'8px 12px',border:'1px solid #e9ecf1',borderRadius:'8px',fontSize:'13px'}}/>
              <input value={newAudNIP} onChange={e=>setNewAudNIP(e.target.value)} placeholder="NIP" style={{width:'100px',padding:'8px 12px',border:'1px solid #e9ecf1',borderRadius:'8px',fontSize:'13px'}}/>
              <button onClick={()=>{ if(!newAudName) return; setAuditors([...auditors,{name:newAudName,nip:newAudNIP}]); setNewAudName(''); setNewAudNIP('') }} style={{padding:'8px 16px',background:'#1e293b',color:'white',borderRadius:'8px',fontSize:'12px',border:'none',cursor:'pointer'}}>Tambah</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',maxHeight:'300px',overflow:'auto'}}>
              {auditors.map((a,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid #e9ecf1',padding:'12px',borderRadius:'12px'}}>
                  <div><div style={{fontSize:'12px',fontWeight:'500',cursor:'pointer'}} onClick={()=>{setSelAuditor(a.name);setShowKelola(false);setActiveMenu('Progres Auditor')}}>{a.name} — klik untuk filter</div><div style={{fontSize:'10px',color:'#64748b'}}>{a.nip}</div></div>
                  <button onClick={()=>setAuditors(auditors.filter((_,idx)=>idx!==i))} style={{color:'#ef4444',fontSize:'11px',background:'none',border:'none',cursor:'pointer'}}>Hapus</button>
                </div>
              ))}
            </div>
            <div style={{marginTop:'16px',display:'flex',gap:'8px'}}>
              <button onClick={()=>setShowKelola(false)} className="btn" style={{flex:1}}>Tutup — filter aktif: {selAuditor}</button>
            </div>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="modal-bg" onClick={()=>setShowAssign(false)}>
          <div className="modal" style={{width:'560px'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}><div style={{fontWeight:'700'}}>Assign Auditor — {filteredUnits.length} unit terfilter (klik unit untuk filter)</div><button onClick={()=>setShowAssign(false)} style={{border:'none',background:'none',cursor:'pointer'}}>✕</button></div>
            <div style={{marginBottom:'12px',display:'flex',gap:'8px'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari unit..." style={{flex:1,padding:'8px 12px',border:'1px solid #e9ecf1',borderRadius:'8px',fontSize:'12px'}}/>
              <select value={selUnit} onChange={e=>setSelUnit(e.target.value)} className="pill"><option>Semua Unit</option>{units.map(u=><option key={u}>{u}</option>)}</select>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'12px',maxHeight:'60vh',overflow:'auto'}}>
              {filteredUnits.slice(0,20).map(u=>(
                <div key={u} style={{border:'1px solid #e9ecf1',borderRadius:'12px',padding:'12px'}}>
                  <div style={{fontWeight:'600',fontSize:'12px',marginBottom:'8px',cursor:'pointer'}} onClick={()=>setSelUnit(u)}>{u} — {assignMap[u]?.length||0} auditor</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                    {auditors.map(a=>{
                      const checked=(assignMap[u]||[]).includes(a.name)
                      return (
                        <label key={a.name} style={{padding:'6px 10px',borderRadius:'999px',border:'1px solid #e9ecf1',fontSize:'11px',cursor:'pointer',background:checked?'#1e293b':'white',color:checked?'white':'#334155'}}>
                          <input type="checkbox" checked={checked} onChange={e=>{
                            setAssignMap(prev=>{
                              const cur=prev[u]||[]
                              const next=e.target.checked? [...cur,a.name]: cur.filter(x=>x!==a.name)
                              return {...prev,[u]:next}
                            })
                          }} style={{display:'none'}}/>{a.name}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:'12px'}}><button onClick={()=>setShowAssign(false)} className="btn btn-primary" style={{width:'100%'}}>Simpan — {Object.keys(assignMap).length} unit assigned</button></div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
