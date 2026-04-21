import { useState, useEffect, createContext, useContext } from 'react';
import { createBrowserClient } from '../lib/supabase';
import { useRouter } from 'next/router';
import '../styles/globals.css';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App({ Component, pageProps }) {
  const [supabase] = useState(() => createBrowserClient());
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session) loadProfile(session);
        else { setProfile(null); setLoading(false); }

        if (event === 'SIGNED_OUT') router.push('/login');
        if (event === 'SIGNED_IN' && router.pathname === '/login') router.push('/');
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (session) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    setProfile(data);
    setLoading(false);
  };

  const signOut = () => supabase.auth.signOut();

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Segoe UI,Arial,sans-serif', direction:'rtl' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:40, height:40, border:'3px solid #6D28D9', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 16px' }}/>
          <div style={{ color:'#64748B', fontSize:14 }}>جاري التحميل...</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, profile, supabase, signOut }}>
      <Component {...pageProps} />
    </AuthContext.Provider>
  );
}
