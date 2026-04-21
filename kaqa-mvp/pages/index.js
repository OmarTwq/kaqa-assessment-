import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';

// ─── Utilities ───────────────────────────────────────────────
const matColor = p => p>=80?"#16A34A":p>=60?"#7C3AED":p>=40?"#D97706":p>=20?"#EA580C":"#DC2626";
const matLabel = p => p>=80?"رائد":p>=60?"متميز":p>=40?"متقدم":p>=20?"متطور":"ناشئ";
const confColor = c => c==="high"?"#16A34A":c==="medium"?"#D97706":"#DC2626";
const confLabel = c => c==="high"?"ثقة مرتفعة":c==="medium"?"ثقة متوسطة":"ثقة منخفضة";

const CRITERIA_COLORS = { 1:'#C9A84C',2:'#8B5CF6',3:'#10B981',4:'#8B5CF6',5:'#F59E0B',6:'#EF4444',7:'#06B6D4',8:'#EC4899' };

export default function Home() {
  const { session, profile, supabase, signOut } = useAuth();
  const router = useRouter();

  const [page, setPage] = useState('dashboard');
  const [assessments, setAssessments] = useState([]);
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [procStep, setProcStep] = useState(0);
  const [procMsg, setProcMsg] = useState('');
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState(null);
  const [selC, setSelC] = useState(1);
  const [tab, setTab] = useState('overview');
  const [loadingList, setLoadingList] = useState(true);
  const fileRef = useRef();

  // Redirect if not logged in
  useEffect(() => {
    if (!session) router.replace('/login');
  }, [session]);

  // Load assessments on mount
  useEffect(() => {
    if (session) loadAssessments();
  }, [session]);

  const loadAssessments = async () => {
    setLoadingList(true);
    const res = await fetch('/api/assessments', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    if (data.assessments) {
      setAssessments(data.assessments);
      if (data.assessments.length > 0 && !currentAssessment) {
        loadAssessmentDetail(data.assessments[0].id);
      }
    }
    setLoadingList(false);
  };

  const loadAssessmentDetail = async (id) => {
    const { data } = await supabase
      .from('assessments')
      .select('result')
      .eq('id', id)
      .single();
    if (data?.result) setCurrentAssessment(data.result);
  };

  const extract = async (file) => {
    const n = file.name.toLowerCase();

    if (n.endsWith('.pdf')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result.split(',')[1];
          resolve({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    if (n.endsWith('.docx')) {
      const buf = await file.arrayBuffer();
      const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
      return { type:'text', text:`[${file.name}]\n${r.value}` };
    }

    const text = await file.text();
    return { type:'text', text:`[${file.name}]\n${text}` };
  };

  const runAssessment = async () => {
    if (!files.length) return;
    setProcessing(true); setErr(null);
    try {
      setProcStep(1); setProcMsg('استيعاب الملفات واستخراج المحتوى...');
      const content = await Promise.all(files.map(({file}) => extract(file)));
      content.push({ type:'text', text:'حلّل جميع المستندات وأنتج تقرير التقييم الشامل.' });

      setProcStep(2); setProcMsg('تحليل المحتوى وفق الأبعاد الخمسة...');
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ content })
      });

      setProcStep(3); setProcMsg('حفظ التقييم في قاعدة البيانات...');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCurrentAssessment(data.result);
      setTab('overview'); setSelC(1);
      await loadAssessments();
      setFiles([]);
      setPage('results');
    } catch(e) {
      setErr('خطأ في التقييم: ' + e.message);
    } finally {
      setProcessing(false); setProcStep(0);
    }
  };

  const addFiles = fl => {
    const ok = ['.pdf','.docx','.xlsx','.txt'];
    const valid = Array.from(fl).filter(f => ok.some(e => f.name.toLowerCase().endsWith(e)));
    setFiles(p => [...p, ...valid.map(f => ({ file:f, id:Math.random().toString(36).slice(2) }))]);
  };

  if (!session) return null;

  const nav = [
    {id:'dashboard',label:'لوحة التحكم',icon:'⊞'},
    {id:'new',label:'تقييم جديد',icon:'＋'},
    {id:'results',label:'النتائج',icon:'☑'},
    {id:'history',label:'سجل التقييمات',icon:'🕐'},
    {id:'visits',label:'الزيارات الميدانية',icon:'◉'},
    {id:'reports',label:'التقارير',icon:'▦'},
    {id:'users',label:'المستخدمون',icon:'◎'},
  ];

  return (
    <div style={{ display:'flex', minHeight:'100vh', direction:'ltr', fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif", background:'#F1F5F9' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
        .slide{animation:fadeIn .3s ease}
        .row:hover{background:#F8FAFC!important}
        .navbtn:hover{background:rgba(255,255,255,0.12)!important}
        .card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.07)!important}
        input,select{outline:none}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width:240, background:'#6D28D9', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:32 }}>🏆</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#FFF', textAlign:'center' }}>نظام التقييم الذكي</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>جائزة الملك عبدالعزيز للجودة</div>
        </div>

        <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.1)', direction:'rtl' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:32, height:32, background:'rgba(255,255,255,0.2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#FFF', fontWeight:700, flexShrink:0 }}>
              {profile?.full_name?.[0] || '؟'}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'#FFF' }}>{profile?.full_name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>{profile?.role === 'admin' ? 'مدير النظام' : profile?.role === 'manager' ? 'مدير الإدارة' : 'مقيم'}</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'10px', direction:'rtl', overflowY:'auto' }}>
          {nav.map(n => {
            const active = page === n.id;
            return (
              <button key={n.id} className="navbtn" onClick={() => setPage(n.id)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer', marginBottom:2, background: active ? '#FFF' : 'transparent', color: active ? '#6D28D9' : 'rgba(255,255,255,0.85)', fontFamily:'inherit', fontSize:13, fontWeight: active ? 700 : 400, textAlign:'right', transition:'all .2s' }}>
                <span style={{ fontSize:14 }}>{n.icon}</span>{n.label}
                {n.id==='history' && assessments.length>0 && <span style={{ marginRight:'auto', background: active ? '#6D28D9' : 'rgba(255,255,255,0.25)', color:'#FFF', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{assessments.length}</span>}
              </button>
            );
          })}
        </nav>

        <div style={{ padding:'10px 10px', borderTop:'1px solid rgba(255,255,255,0.1)', direction:'rtl' }}>
          <button className="navbtn" onClick={signOut}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, border:'none', cursor:'pointer', background:'transparent', color:'rgba(255,255,255,0.7)', fontFamily:'inherit', fontSize:13 }}>
            <span>→</span> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflow:'auto', direction:'rtl' }}>
        {page==='dashboard' && <DashboardPage assessment={currentAssessment} assessments={assessments} loading={loadingList} setPage={setPage} />}
        {page==='new' && <NewAssessmentPage files={files} setFiles={setFiles} drag={drag} setDrag={setDrag} fileRef={fileRef} addFiles={addFiles} onRun={runAssessment} processing={processing} procStep={procStep} procMsg={procMsg} err={err} />}
        {page==='results' && <ResultsPage assessment={currentAssessment} selC={selC} setSelC={setSelC} tab={tab} setTab={setTab} />}
        {page==='history' && <HistoryPage assessments={assessments} loading={loadingList} onSelect={(id) => { loadAssessmentDetail(id); setPage('results'); }} session={session} onRefresh={loadAssessments} />}
        {page==='visits' && <VisitsPage assessment={currentAssessment} />}
        {page==='reports' && <ReportsPage assessment={currentAssessment} />}
        {page==='users' && <UsersPage profile={profile} supabase={supabase} />}
      </main>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
function DashboardPage({ assessment, assessments, loading, setPage }) {
  const a = assessment;
  return (
    <div className="slide">
      <PageHeader title="لوحة التحكم" sub="نظرة شاملة على حالة التقييم المؤسسي"
        action={<Btn onClick={() => setPage('new')}>+ تقييم جديد</Btn>} />
      <div style={{ padding:28 }}>
        {!a && (
          <div style={{ background:'#FFF', border:'2px dashed #DDD6FE', borderRadius:14, padding:'48px 24px', textAlign:'center', marginBottom:28 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#1E293B', marginBottom:6 }}>لا يوجد تقييم حالي</div>
            <div style={{ fontSize:13, color:'#64748B', marginBottom:20 }}>ارفع مستندات المنشأة لبدء التقييم الذكي</div>
            <Btn onClick={() => setPage('new')}>ابدأ التقييم الذكي</Btn>
          </div>
        )}
        {a && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
              {[
                {l:'إجمالي الدرجات', v:a.totalScore, s:'من 1000 درجة', c:'#6D28D9'},
                {l:'مستوى النضج', v:a.maturityLevel, s:a.maturityLevelEn, c:matColor(a.percentage)},
                {l:'الثقة الكلية', v:confLabel(a.overallConfidence), s:'في الأحكام', c:confColor(a.overallConfidence)},
                {l:'الممكنات', v:a.enablersScore?.actual, s:`من 600 (${Math.round(a.enablersScore?.actual/600*100)}%)`, c:'#C9A84C'},
                {l:'النتائج', v:a.resultsScore?.actual, s:`من 400 (${Math.round(a.resultsScore?.actual/400*100)}%)`, c:'#10B981'},
                {l:'عدد التقييمات', v:assessments.length, s:'في قاعدة البيانات', c:'#F59E0B'},
              ].map((s,i) => (
                <div key={i} className="card" style={{ background:'#FFF', borderRadius:12, padding:'18px 20px', border:'1px solid #E2E8F0', transition:'box-shadow .2s' }}>
                  <div style={{ fontSize:12, color:'#64748B', marginBottom:6 }}>{s.l}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:s.c, marginBottom:4 }}>{s.v}</div>
                  <div style={{ fontSize:11, color:'#94A3B8' }}>{s.s}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', padding:22 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1E293B', marginBottom:16 }}>أداء المعايير الثمانية</div>
              {a.criteria?.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
                  <div style={{ width:150, fontSize:12, color:'#475569', textAlign:'right', flexShrink:0 }}>{c.nameAr}</div>
                  <div style={{ flex:1, height:8, background:'#F1F5F9', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${c.percentage}%`, background:CRITERIA_COLORS[c.id]||'#6D28D9', borderRadius:4 }} />
                  </div>
                  <div style={{ width:50, fontSize:12, fontWeight:700, color:matColor(c.percentage), flexShrink:0 }}>{c.percentage?.toFixed(0)}%</div>
                  <div style={{ width:70, fontSize:11, color:'#94A3B8', flexShrink:0 }}>{c.actualScore}/{c.maxScore}د</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── New Assessment ────────────────────────────────────────────
function NewAssessmentPage({ files, setFiles, drag, setDrag, fileRef, addFiles, onRun, processing, procStep, procMsg, err }) {
  if (processing) {
    const steps = ['استيعاب الملفات','تحليل الأبعاد الخمسة','حفظ في قاعدة البيانات'];
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'80vh', padding:32 }}>
        <div style={{ width:70, height:70, background:'#F5F3FF', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, marginBottom:20 }}>🤖</div>
        <div style={{ fontSize:16, fontWeight:700, color:'#1E293B', marginBottom:6 }}>جاري التقييم الذكي...</div>
        <div style={{ fontSize:13, color:'#64748B', marginBottom:28 }}>{procMsg}</div>
        {steps.map((s,i) => {
          const done=i<procStep-1, active=i===procStep-1;
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:i<2?'1px solid #F1F5F9':'none', width:360 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:done?'#16A34A':active?'#6D28D9':'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:done||active?'#FFF':'#94A3B8', flexShrink:0 }}>
                {done?'✓':i+1}
              </div>
              <div style={{ fontSize:13, color:done?'#16A34A':active?'#6D28D9':'#94A3B8', fontWeight:active?600:400, flex:1, textAlign:'right' }}>{s}</div>
              {active && <div style={{ width:16, height:16, border:'2px solid #6D28D9', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="slide">
      <PageHeader title="تقييم جديد" sub="رفع أدلة المنشأة وتشغيل الوكيل الذكي" />
      <div style={{ padding:28, maxWidth:700 }}>
        <div style={{ background:'#F5F3FF', border:'1px solid #DDD6FE', borderRadius:12, padding:'14px 18px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#6D28D9', marginBottom:6 }}>🤖 الوكيل يحلل وفق الأبعاد الخمسة</div>
          {[{l:'المنهجية',w:'25%'},{l:'التطبيق',w:'25%'},{l:'التعلم والتحسين',w:'20%'},{l:'التكامل',w:'15%'},{l:'النتائج',w:'15%'}].map(d=>(
            <span key={d.l} style={{ display:'inline-block', background:'rgba(109,40,217,0.1)', border:'1px solid rgba(109,40,217,0.25)', borderRadius:14, padding:'2px 10px', fontSize:11, fontWeight:600, color:'#6D28D9', margin:'3px 4px' }}>{d.l} {d.w}</span>
          ))}
        </div>

        <div
          onDragOver={e=>{e.preventDefault();setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files);}}
          onClick={()=>fileRef.current?.click()}
          style={{ border:`2px dashed ${drag?'#6D28D9':'#CBD5E1'}`, borderRadius:14, padding:'48px 20px', textAlign:'center', cursor:'pointer', background:drag?'#F5F3FF':'#FAFAFA', marginBottom:16 }}>
          <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.xlsx,.txt" style={{display:'none'}} onChange={e=>addFiles(e.target.files)}/>
          <div style={{ fontSize:36, marginBottom:10 }}>📂</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#1E293B', marginBottom:5 }}>اسحب وأفلت مستندات المنشأة</div>
          <div style={{ fontSize:13, color:'#64748B' }}>PDF · DOCX · XLSX · TXT | السياسات، الخطط، التقارير، المؤشرات</div>
        </div>

        {files.length > 0 && (
          <div style={{ background:'#FFF', borderRadius:12, border:'1px solid #E2E8F0', padding:14, marginBottom:16 }}>
            {files.map(({file,id}) => (
              <div key={id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 4px', borderBottom:'1px solid #F8FAFC' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span>{file.name.endsWith('.pdf')?'📄':file.name.endsWith('.docx')?'📝':'📊'}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1E293B' }}>{file.name}</div>
                    <div style={{ fontSize:11, color:'#94A3B8' }}>{(file.size/1024).toFixed(0)} KB</div>
                  </div>
                </div>
                <button onClick={()=>setFiles(p=>p.filter(f=>f.id!==id))} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:16 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {err && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:12, color:'#DC2626', fontSize:13, marginBottom:12 }}>⚠️ {err}</div>}

        <button onClick={onRun} disabled={!files.length}
          style={{ width:'100%', padding:14, background:files.length?'#6D28D9':'#CBD5E1', border:'none', borderRadius:10, color:'#FFF', fontSize:15, fontWeight:700, cursor:files.length?'pointer':'not-allowed', fontFamily:'inherit' }}>
          🚀 تشغيل التقييم الذكي
        </button>
      </div>
    </div>
  );
}

// ─── Results Page ─────────────────────────────────────────────
function ResultsPage({ assessment: a, selC, setSelC, tab, setTab }) {
  if (!a) return <EmptyState title="لا يوجد تقييم" sub="قم بتقييم جديد أو اختر من السجل" />;
  const tabs = [{id:'overview',l:'نظرة عامة'},{id:'criteria',l:'المعايير'},{id:'dims',l:'الأبعاد'},{id:'gaps',l:'الفجوات'},{id:'report',l:'التقرير'}];

  return (
    <div className="slide">
      <PageHeader title="نتائج التقييم" sub={a.organizationName} />
      <div style={{ padding:'20px 28px' }}>
        {/* Score Hero */}
        <div style={{ background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', padding:'20px 24px', marginBottom:18, display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', width:100, height:100, flexShrink:0 }}>
            <svg width={100} height={100} style={{transform:'rotate(-90deg)'}}>
              <circle cx={50} cy={50} r={42} fill="none" stroke="#F1F5F9" strokeWidth={8}/>
              <circle cx={50} cy={50} r={42} fill="none" stroke={matColor(a.percentage)} strokeWidth={8}
                strokeDasharray={2*Math.PI*42} strokeDashoffset={2*Math.PI*42*(1-a.percentage/100)} strokeLinecap="round"/>
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <div style={{ fontSize:20, fontWeight:900, color:matColor(a.percentage) }}>{a.totalScore}</div>
              <div style={{ fontSize:10, color:'#94A3B8' }}>/1000</div>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:'#94A3B8', marginBottom:3 }}>الجهة المقيّمة</div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1E293B', marginBottom:8 }}>{a.organizationName}</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Badge label={`${a.maturityLevel} | ${a.maturityLevelEn}`} bg={`${matColor(a.percentage)}18`} color={matColor(a.percentage)}/>
              <Badge label={confLabel(a.overallConfidence)} bg={`${confColor(a.overallConfidence)}15`} color={confColor(a.overallConfidence)}/>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, borderBottom:'2px solid #E2E8F0', marginBottom:20 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ background:'none', border:'none', cursor:'pointer', padding:'9px 16px', color:tab===t.id?'#6D28D9':'#64748B', fontWeight:tab===t.id?700:400, fontSize:13, borderBottom:`2px solid ${tab===t.id?'#6D28D9':'transparent'}`, marginBottom:-2, fontFamily:'inherit' }}>
              {t.l}
            </button>
          ))}
        </div>

        {tab==='overview' && <OverviewTab a={a}/>}
        {tab==='criteria' && <CriteriaTab a={a} selC={selC} setSelC={setSelC}/>}
        {tab==='dims' && <DimsTab a={a} selC={selC} setSelC={setSelC}/>}
        {tab==='gaps' && <GapsTab a={a}/>}
        {tab==='report' && <ReportTab a={a}/>}
      </div>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────
function HistoryPage({ assessments, loading, onSelect, session, onRefresh }) {
  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا التقييم؟')) return;
    await fetch(`/api/assessments?id=${id}`, {
      method:'DELETE',
      headers:{ Authorization:`Bearer ${session.access_token}` }
    });
    onRefresh();
  };

  return (
    <div className="slide">
      <PageHeader title="سجل التقييمات" sub="جميع التقييمات المحفوظة في قاعدة البيانات" action={<Btn onClick={onRefresh} color="#475569">↻ تحديث</Btn>}/>
      <div style={{ padding:28 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#64748B' }}>⏳ جاري التحميل...</div>
        ) : assessments.length === 0 ? (
          <div style={{ background:'#FFF', border:'2px dashed #E2E8F0', borderRadius:14, padding:'48px 24px', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1E293B' }}>لا توجد تقييمات بعد</div>
          </div>
        ) : (
          <div style={{ background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#F8FAFC' }}>
                {['الجهة','الدرجة','المستوى','الثقة','التاريخ','إجراءات'].map(h=>(
                  <th key={h} style={{ padding:'12px 18px', textAlign:'right', fontSize:12, fontWeight:700, color:'#64748B', borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {assessments.map(a=>(
                  <tr key={a.id} className="row" style={{ borderBottom:'1px solid #F1F5F9' }}>
                    <td style={{ padding:'13px 18px', fontSize:13, fontWeight:600, color:'#1E293B' }}>{a.organization_name}</td>
                    <td style={{ padding:'13px 18px', fontSize:14, fontWeight:800, color:matColor(a.percentage) }}>{a.total_score}</td>
                    <td style={{ padding:'13px 18px' }}><Badge label={a.maturity_level} bg={`${matColor(a.percentage)}15`} color={matColor(a.percentage)}/></td>
                    <td style={{ padding:'13px 18px' }}><Badge label={confLabel(a.overall_confidence)} bg={`${confColor(a.overall_confidence)}12`} color={confColor(a.overall_confidence)}/></td>
                    <td style={{ padding:'13px 18px', fontSize:12, color:'#64748B' }}>{new Date(a.created_at).toLocaleDateString('ar-SA')}</td>
                    <td style={{ padding:'13px 18px', display:'flex', gap:8 }}>
                      <button onClick={()=>onSelect(a.id)} style={{ background:'#F5F3FF', border:'1px solid #DDD6FE', borderRadius:6, padding:'5px 10px', color:'#6D28D9', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:600 }}>عرض</button>
                      <button onClick={()=>handleDelete(a.id)} style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:6, padding:'5px 10px', color:'#DC2626', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reports Page ─────────────────────────────────────────────
function ReportsPage({ assessment: a }) {
  if (!a) return <EmptyState title="لا يوجد تقييم" sub="اختر تقييماً من السجل أو أنشئ تقييماً جديداً"/>;
  return (
    <div className="slide">
      <PageHeader title="التقارير" sub="التقارير المُولَّدة تلقائياً" action={<Btn onClick={()=>window.print()}>🖨️ طباعة</Btn>}/>
      <div style={{ padding:28 }}><ReportTab a={a}/></div>
    </div>
  );
}

// ─── Visits Page ──────────────────────────────────────────────
function VisitsPage({ assessment: a }) {
  if (!a) return <EmptyState title="لا توجد خطة زيارة" sub="ستُولَّد الأسئلة تلقائياً بعد إجراء التقييم"/>;
  const lowQ = a.criteria?.flatMap(c => (c.subCriteria||[]).flatMap(s => (s.visitQuestions||[]).filter(()=>s.confidence==='low').map(q=>({q, sub:s.nameAr, crit:c.nameAr})))) || [];
  const medQ = a.criteria?.flatMap(c => (c.subCriteria||[]).flatMap(s => (s.visitQuestions||[]).filter(()=>s.confidence==='medium').map(q=>({q, sub:s.nameAr, crit:c.nameAr})))) || [];

  return (
    <div className="slide">
      <PageHeader title="الزيارات الميدانية" sub="أسئلة موجهة بناءً على فجوات الأدلة"/>
      <div style={{ padding:28 }}>
        {a.visitPlan?.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1E293B', marginBottom:14 }}>خطة الزيارة الميدانية</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
              {a.visitPlan.map((v,i) => (
                <div key={i} style={{ background:'#FFF', border:'1px solid #DDD6FE', borderRadius:12, padding:18 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#6D28D9', marginBottom:10 }}>{i+1}. {v.entity}</div>
                  {(v.questions||[]).map((q,j) => <div key={j} style={{ fontSize:12, color:'#334155', marginBottom:7, lineHeight:1.6 }}>• {q}</div>)}
                </div>
              ))}
            </div>
          </div>
        )}
        {lowQ.length > 0 && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:20, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#DC2626', marginBottom:12 }}>🔴 أسئلة حرجة — ثقة منخفضة ({lowQ.length})</div>
            {lowQ.map((x,i) => <div key={i} style={{ padding:'8px 0', borderBottom:i<lowQ.length-1?'1px solid #FEF2F2':'none' }}><div style={{ fontSize:10, color:'#DC2626', marginBottom:2 }}>{x.crit} ← {x.sub}</div><div style={{ fontSize:12, color:'#1E293B' }}>• {x.q}</div></div>)}
          </div>
        )}
        {medQ.length > 0 && (
          <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#D97706', marginBottom:12 }}>🟡 أسئلة مهمة — ثقة متوسطة ({medQ.length})</div>
            {medQ.slice(0,8).map((x,i) => <div key={i} style={{ padding:'8px 0', borderBottom:i<Math.min(medQ.length,8)-1?'1px solid #FFFBEB':'none' }}><div style={{ fontSize:10, color:'#D97706', marginBottom:2 }}>{x.crit} ← {x.sub}</div><div style={{ fontSize:12, color:'#1E293B' }}>• {x.q}</div></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users Page ───────────────────────────────────────────────
function UsersPage({ profile, supabase }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('*').then(({data}) => {
      setUsers(data||[]); setLoading(false);
    });
  }, []);

  const roleColor = {admin:['#FEE2E2','#B91C1C'], manager:['#EDE9FE','#6D28D9'], assessor:['#E5E7EB','#374151']};
  const roleLabel = {admin:'مدير النظام', manager:'مدير الإدارة', assessor:'مقيم'};

  return (
    <div className="slide">
      <PageHeader title="المستخدمون" sub="إدارة أعضاء الفريق والصلاحيات"/>
      <div style={{ padding:28 }}>
        {loading ? <div style={{ textAlign:'center', color:'#64748B' }}>⏳ جاري التحميل...</div> : (
          <div style={{ background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#F8FAFC' }}>
                {['الاسم','الدور','الحالة'].map(h=><th key={h} style={{ padding:'12px 18px', textAlign:'right', fontSize:12, fontWeight:700, color:'#64748B', borderBottom:'1px solid #E2E8F0' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {users.map((u,i) => (
                  <tr key={i} className="row" style={{ borderBottom:'1px solid #F1F5F9' }}>
                    <td style={{ padding:'13px 18px', fontSize:14, fontWeight:500, color:'#1E293B' }}>{u.full_name}</td>
                    <td style={{ padding:'13px 18px' }}>
                      <Badge label={roleLabel[u.role]||u.role} bg={roleColor[u.role]?.[0]||'#E5E7EB'} color={roleColor[u.role]?.[1]||'#374151'}/>
                    </td>
                    <td style={{ padding:'13px 18px' }}>
                      <Badge label={u.is_active?'نشط':'غير نشط'} bg={u.is_active?'#DCFCE7':'#F1F5F9'} color={u.is_active?'#16A34A':'#64748B'}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {profile?.role !== 'admin' && <div style={{ marginTop:16, fontSize:13, color:'#94A3B8', textAlign:'center' }}>لإضافة مستخدمين جدد، تواصل مع مدير النظام أو استخدم Supabase Dashboard</div>}
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────
function PageHeader({ title, sub, action }) {
  return (
    <div style={{ padding:'24px 28px 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'1px solid #E2E8F0', background:'#FFF' }}>
      <div>
        <h1 style={{ fontSize:20, fontWeight:800, color:'#1E293B', margin:0, marginBottom:3 }}>{title}</h1>
        {sub && <div style={{ fontSize:13, color:'#64748B' }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
function Btn({ children, color='#6D28D9', onClick, style:sx }) {
  return <button onClick={onClick} style={{ background:color, color:'#FFF', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', ...sx }}>{children}</button>;
}
function Badge({ label, bg='#E5E7EB', color='#374151' }) {
  return <span style={{ background:bg, color, borderRadius:12, padding:'3px 10px', fontSize:12, fontWeight:600 }}>{label}</span>;
}
function EmptyState({ title, sub }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'#64748B' }}>
      <div style={{ fontSize:48, marginBottom:14 }}>📋</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#1E293B', marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13 }}>{sub}</div>
    </div>
  );
}

// ─── Overview, Criteria, Dims, Gaps, Report tabs ───────────────
function OverviewTab({ a }) {
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:20 }}>
        {a.criteria?.map(c => (
          <div key={c.id} className="card" style={{ background:'#FFF', border:`1px solid ${CRITERIA_COLORS[c.id]}25`, borderRadius:12, padding:16, transition:'box-shadow .2s' }}>
            <div style={{ fontSize:10, color:'#94A3B8', marginBottom:2 }}>المعيار {c.id}</div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E293B', marginBottom:8, lineHeight:1.4 }}>{c.nameAr}</div>
            <div style={{ height:5, background:'#F1F5F9', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
              <div style={{ height:'100%', width:`${c.percentage}%`, background:CRITERIA_COLORS[c.id]||'#6D28D9' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, color:'#94A3B8' }}>{c.actualScore}/{c.maxScore}د</span>
              <span style={{ fontSize:12, fontWeight:700, color:matColor(c.percentage) }}>{c.percentage?.toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <InsightBox title="أبرز نقاط القوة" items={a.top3Strengths} col="#16A34A" icon="✅"/>
        <InsightBox title="أولويات التحسين" items={a.top3Improvements} col="#D97706" icon="🎯"/>
      </div>
      {a.missingDocuments?.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:16, marginTop:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#DC2626', marginBottom:8 }}>⚠️ وثائق حرجة مفقودة</div>
          {a.missingDocuments.map((d,i) => <div key={i} style={{ fontSize:12, color:'#1E293B', marginBottom:4 }}>• {d}</div>)}
        </div>
      )}
    </div>
  );
}
function InsightBox({ title, items, col, icon }) {
  return (
    <div style={{ background:'#FFF', border:`1px solid ${col}20`, borderRadius:12, padding:18 }}>
      <div style={{ fontSize:13, fontWeight:700, color:col, marginBottom:12 }}>{icon} {title}</div>
      {(items||[]).map((item,i) => (
        <div key={i} style={{ display:'flex', gap:8, marginBottom:8, paddingBottom:8, borderBottom:i<items.length-1?'1px solid #F1F5F9':'none' }}>
          <span style={{ color:col, fontWeight:700, flexShrink:0 }}>{i+1}.</span>
          <span style={{ fontSize:13, color:'#334155', lineHeight:1.6 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}
function CriteriaTab({ a, selC, setSelC }) {
  const crit = a.criteria?.find(c=>c.id===selC)||a.criteria?.[0];
  const col = CRITERIA_COLORS[crit?.id]||'#6D28D9';
  return (
    <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:16 }}>
      <div style={{ background:'#FFF', borderRadius:12, border:'1px solid #E2E8F0', padding:10 }}>
        {a.criteria?.map(c=>(
          <button key={c.id} onClick={()=>setSelC(c.id)}
            style={{ width:'100%', textAlign:'right', padding:'9px 11px', borderRadius:8, border:'none', cursor:'pointer', background:c.id===selC?`${CRITERIA_COLORS[c.id]||'#6D28D9'}10`:'transparent', fontFamily:'inherit', marginBottom:3 }}>
            <div style={{ fontSize:11, fontWeight:600, color:c.id===selC?CRITERIA_COLORS[c.id]||'#6D28D9':'#475569', lineHeight:1.4, marginBottom:3 }}>{c.nameAr}</div>
            <div style={{ height:3, background:'#F1F5F9', borderRadius:2 }}><div style={{ height:'100%', width:`${c.percentage}%`, background:CRITERIA_COLORS[c.id]||'#6D28D9', borderRadius:2 }}/></div>
            <div style={{ fontSize:9, color:'#94A3B8', marginTop:2 }}>{c.percentage?.toFixed(0)}% | {c.actualScore}/{c.maxScore}</div>
          </button>
        ))}
      </div>
      {crit && (
        <div>
          <div style={{ background:'#FFF', border:`1px solid ${col}25`, borderRadius:12, padding:18, marginBottom:14 }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:col, margin:'0 0 4px' }}>المعيار {crit.id}: {crit.nameAr}</h2>
            <div style={{ fontSize:12, color:'#64748B', marginBottom:10 }}>{crit.nameEn}</div>
            <div style={{ display:'flex', gap:20 }}>
              <div><div style={{ fontSize:24, fontWeight:900, color:col }}>{crit.actualScore}<span style={{ fontSize:11, color:'#94A3B8' }}>/{crit.maxScore}</span></div></div>
              <div><div style={{ fontSize:24, fontWeight:900, color:col }}>{crit.percentage?.toFixed(0)}%</div><div style={{ fontSize:11, color:'#94A3B8' }}>نسبة الإنجاز</div></div>
            </div>
          </div>
          {crit.subCriteria?.map(sub=>(
            <div key={sub.id} style={{ background:'#FFF', border:'1px solid #E2E8F0', borderRadius:12, padding:16, marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:10, color:'#94A3B8' }}>{sub.id}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1E293B' }}>{sub.nameAr}</div>
                  {sub.adjustmentFactor && sub.adjustmentFactor!==1 && <div style={{ fontSize:10, color:sub.adjustmentFactor<1?'#DC2626':'#16A34A' }}>{sub.adjustmentFactor<1?'⬇ خُفِّضت':'⬆ رُفعت'}: معامل {sub.adjustmentFactor}</div>}
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:matColor(sub.finalPercentage||0) }}>{sub.actualScore}</div>
                  <div style={{ fontSize:10, color:'#94A3B8' }}>/{sub.maxScore}</div>
                  <Badge label={confLabel(sub.confidence)} bg={`${confColor(sub.confidence)}12`} color={confColor(sub.confidence)}/>
                </div>
              </div>
              <div style={{ height:6, background:'#F1F5F9', borderRadius:3, overflow:'hidden', marginBottom:12 }}>
                <div style={{ height:'100%', width:`${sub.finalPercentage||0}%`, background:matColor(sub.finalPercentage||0) }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <MiniList title="نقاط القوة" items={sub.strengths} col="#16A34A"/>
                <MiniList title="فرص التحسين" items={sub.improvements} col="#D97706"/>
              </div>
              {sub.missingEvidence?.length>0 && (
                <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #F1F5F9' }}>
                  <MiniList title="❌ أدلة مفقودة" items={sub.missingEvidence} col="#DC2626" sm/>
                </div>
              )}
              {sub.adjustmentReasons?.length>0 && (
                <div style={{ background:'#FFF7ED', borderRadius:7, padding:'7px 11px', marginTop:8, fontSize:11, color:'#92400E' }}>
                  ⚙️ {sub.adjustmentReasons.join(' | ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function MiniList({ title, items, col, sm }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={{ fontSize:sm?10:11, fontWeight:700, color:col, marginBottom:5 }}>{title}</div>
      {items.map((item,i) => <div key={i} style={{ fontSize:sm?10:12, color:'#334155', marginBottom:3, paddingRight:10, position:'relative' }}><span style={{ position:'absolute', right:0, color:col }}>•</span>{item}</div>)}
    </div>
  );
}
const DIMS_INFO = [{key:'methodology',ar:'المنهجية',w:0.25,c:'#3B82F6'},{key:'application',ar:'التطبيق',w:0.25,c:'#10B981'},{key:'learning',ar:'التعلم والتحسين',w:0.20,c:'#8B5CF6'},{key:'integration',ar:'التكامل',w:0.15,c:'#F59E0B'},{key:'results',ar:'النتائج',w:0.15,c:'#EF4444'}];
function DimsTab({ a, selC, setSelC }) {
  const crit = a.criteria?.find(c=>c.id===selC)||a.criteria?.[0];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:14 }}>
      <div style={{ background:'#FFF', borderRadius:12, border:'1px solid #E2E8F0', padding:8 }}>
        {a.criteria?.map(c=>(
          <button key={c.id} onClick={()=>setSelC(c.id)}
            style={{ width:'100%', textAlign:'right', padding:'8px 10px', borderRadius:7, border:'none', cursor:'pointer', background:c.id===selC?`${CRITERIA_COLORS[c.id]||'#6D28D9'}10`:'transparent', fontFamily:'inherit', marginBottom:2, fontSize:11, fontWeight:c.id===selC?700:400, color:c.id===selC?CRITERIA_COLORS[c.id]||'#6D28D9':'#475569' }}>
            {c.nameAr}
          </button>
        ))}
      </div>
      <div>
        {crit?.subCriteria?.map(sub=>(
          <div key={sub.id} style={{ background:'#FFF', border:'1px solid #E2E8F0', borderRadius:12, padding:18, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1E293B', marginBottom:8 }}>{sub.id}: {sub.nameAr}</div>
            <div style={{ display:'flex', gap:16, marginBottom:12, flexWrap:'wrap', fontSize:12, color:'#64748B' }}>
              <span>خام: <strong>{sub.rawPercentage?.toFixed(1)}%</strong></span>
              <span>× <strong style={{ color:sub.adjustmentFactor<1?'#DC2626':sub.adjustmentFactor>1?'#16A34A':'#64748B' }}>{sub.adjustmentFactor}</strong></span>
              <span>= <strong style={{ color:matColor(sub.finalPercentage||0) }}>{sub.finalPercentage?.toFixed(1)}%</strong></span>
              <span>→ <strong style={{ color:matColor(sub.finalPercentage||0) }}>{sub.actualScore}/{sub.maxScore} درجة</strong></span>
            </div>
            {DIMS_INFO.map(dim=>{
              const d = sub.dimensions?.[dim.key];
              if(!d) return null;
              return (
                <div key={dim.key} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:dim.c }}>{dim.ar} <span style={{ fontSize:10, color:'#94A3B8', fontWeight:400 }}>{Math.round(dim.w*100)}%</span></div>
                    <div style={{ fontSize:12, fontWeight:800, color:dim.c }}>{d.score}%</div>
                  </div>
                  <div style={{ height:6, background:'#F1F5F9', borderRadius:3, overflow:'hidden', marginBottom:3 }}>
                    <div style={{ height:'100%', width:`${d.score}%`, background:dim.c }}/>
                  </div>
                  {d.justification && <div style={{ fontSize:10, color:'#64748B' }}>{d.justification}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
function GapsTab({ a }) {
  const subs = a.criteria?.flatMap(c=>(c.subCriteria||[]).map(s=>({...s,cAr:c.nameAr,col:CRITERIA_COLORS[c.id]||'#6D28D9'}))).sort((x,y)=>(x.finalPercentage||0)-(y.finalPercentage||0))||[];
  return (
    <div>
      <div style={{ background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', padding:20, marginBottom:18 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1E293B', marginBottom:4 }}>مصفوفة الفجوات — الأدنى أداءً أولاً</div>
        {subs.slice(0,10).map((s,i)=>{
          const fp=s.finalPercentage||0;
          return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:i<9?'1px solid #F8FAFC':'none' }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:`${matColor(fp)}15`, color:matColor(fp), display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>#{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#1E293B' }}>{s.nameAr}</div>
                <div style={{ fontSize:10, color:'#94A3B8' }}>{s.cAr}</div>
              </div>
              <div style={{ textAlign:'center', minWidth:40 }}>
                <div style={{ fontSize:13, fontWeight:800, color:matColor(fp) }}>{fp?.toFixed(0)}%</div>
                <div style={{ fontSize:10, color:'#94A3B8' }}>{s.actualScore}/{s.maxScore}</div>
              </div>
              <div style={{ width:80 }}><div style={{ height:6, background:'#F1F5F9', borderRadius:3 }}><div style={{ height:'100%', width:`${fp}%`, background:matColor(fp), borderRadius:3 }}/></div></div>
            </div>
          );
        })}
      </div>
      <div style={{ background:'#FFF', border:'1px solid #DDD6FE', borderRadius:14, padding:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#6D28D9', marginBottom:14 }}>🗺️ الخطوات التالية الموصى بها</div>
        {a.recommendedNextSteps?.map((s,i)=>(
          <div key={i} style={{ display:'flex', gap:10, marginBottom:10, paddingBottom:10, borderBottom:i<a.recommendedNextSteps.length-1?'1px solid #F1F5F9':'none' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:'#F5F3FF', border:'1px solid #DDD6FE', color:'#6D28D9', fontWeight:800, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</div>
            <div style={{ fontSize:13, color:'#1E293B', lineHeight:1.7 }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function ReportTab({ a }) {
  return (
    <div>
      {/* Arabic report */}
      <div style={{ background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', padding:26, marginBottom:16, direction:'rtl' }}>
        <div style={{ borderBottom:'2px solid #C9A84C', paddingBottom:12, marginBottom:18 }}>
          <div style={{ fontSize:11, color:'#94A3B8' }}>تقرير التقييم الداخلي الذكي</div>
          <div style={{ fontSize:18, fontWeight:900, color:'#C9A84C' }}>جائزة الملك عبدالعزيز للجودة 2022</div>
          <div style={{ fontSize:14, fontWeight:600, color:'#1E293B' }}>{a.organizationName}</div>
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:'#1E293B', marginBottom:8 }}>الملخص التنفيذي</div>
        <p style={{ fontSize:13, color:'#334155', lineHeight:2, marginBottom:20 }}>{a.executiveSummaryAr}</p>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:'#FFF7ED' }}>
              {['المعيار','المحقق','القصوى','النسبة','المستوى'].map(h=><th key={h} style={{ padding:'9px 12px', textAlign:'right', color:'#C9A84C', fontWeight:700, borderBottom:'1px solid #E2E8F0' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {a.criteria?.map(c=>(
                <tr key={c.id} style={{ borderBottom:'1px solid #F1F5F9' }}>
                  <td style={{ padding:'8px 12px', color:'#1E293B' }}>{c.id}. {c.nameAr}</td>
                  <td style={{ padding:'8px 12px', color:matColor(c.percentage), fontWeight:700 }}>{c.actualScore}</td>
                  <td style={{ padding:'8px 12px', color:'#94A3B8' }}>{c.maxScore}</td>
                  <td style={{ padding:'8px 12px', color:matColor(c.percentage), fontWeight:700 }}>{c.percentage?.toFixed(0)}%</td>
                  <td style={{ padding:'8px 12px', color:matColor(c.percentage) }}>{matLabel(c.percentage)}</td>
                </tr>
              ))}
              <tr style={{ background:'#FFF7ED' }}>
                <td style={{ padding:'10px 12px', fontWeight:800, color:'#C9A84C' }}>الإجمالي</td>
                <td style={{ padding:'10px 12px', fontWeight:800, color:'#C9A84C' }}>{a.totalScore}</td>
                <td style={{ padding:'10px 12px', fontWeight:800, color:'#C9A84C' }}>1000</td>
                <td style={{ padding:'10px 12px', fontWeight:800, color:'#C9A84C' }}>{a.percentage?.toFixed(1)}%</td>
                <td style={{ padding:'10px 12px', fontWeight:800, color:'#C9A84C' }}>{a.maturityLevel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* English report */}
      <div style={{ background:'#FFF', borderRadius:14, border:'1px solid #E2E8F0', padding:26, direction:'ltr' }}>
        <div style={{ borderBottom:'2px solid #C9A84C', paddingBottom:12, marginBottom:18 }}>
          <div style={{ fontSize:11, color:'#94A3B8' }}>AI Internal Assessment Report</div>
          <div style={{ fontSize:18, fontWeight:900, color:'#C9A84C' }}>King Abdulaziz Quality Award 2022</div>
          <div style={{ fontSize:14, fontWeight:600, color:'#1E293B' }}>{a.organizationName}</div>
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:'#1E293B', marginBottom:8 }}>Executive Summary</div>
        <p style={{ fontSize:13, color:'#334155', lineHeight:2, marginBottom:18 }}>{a.executiveSummaryEn}</p>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', fontSize:12 }}>
          {[['Total Score',`${a.totalScore}/1000`],['Achievement',`${a.percentage?.toFixed(1)}%`],['Maturity',a.maturityLevelEn],['Enablers',`${a.enablersScore?.actual}/600`],['Results',`${a.resultsScore?.actual}/400`]].map(([l,v])=>(
            <div key={l}><span style={{ color:'#94A3B8' }}>{l}: </span><strong style={{ color:'#C9A84C' }}>{v}</strong></div>
          ))}
        </div>
      </div>
    </div>
  );
}
