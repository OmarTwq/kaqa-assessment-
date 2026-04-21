import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';

export default function Login() {
  const { session, supabase } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) router.replace('/');
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif", direction:'rtl' }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        input:focus{outline:none;border-color:#6D28D9!important;box-shadow:0 0 0 3px rgba(109,40,217,0.1)}
        button:hover{filter:brightness(0.93)}
        button:active{transform:scale(0.98)}
      `}</style>

      <div style={{ background:'#FFF', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 8px 32px rgba(0,0,0,0.08)', animation:'fadeIn .4s ease' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:80, height:80, background:'#F5F3FF', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:36 }}>🏆</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#1E293B', marginBottom:4 }}>وكيل المقيم الذكي</div>
          <div style={{ fontSize:12, color:'#64748B' }}>جائزة الملك عبدالعزيز للجودة 2022</div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ width:'100%', padding:'11px 14px', border:'1px solid #E2E8F0', borderRadius:10, fontSize:14, fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .2s', background:'#FAFAFA' }}
            />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width:'100%', padding:'11px 14px', border:'1px solid #E2E8F0', borderRadius:10, fontSize:14, fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .2s', background:'#FAFAFA' }}
            />
          </div>

          {error && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', color:'#DC2626', fontSize:13, marginBottom:16, textAlign:'center' }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width:'100%', padding:'13px', background: loading ? '#CBD5E1' : '#6D28D9', border:'none', borderRadius:10, color:'#FFF', fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'all .2s' }}
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#94A3B8' }}>
          للحصول على حساب تواصل مع مدير النظام
        </div>
      </div>
    </div>
  );
}
