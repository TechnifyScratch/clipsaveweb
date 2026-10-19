'use client';
import { useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, LoaderCircle, LockKeyhole } from 'lucide-react';
import ThemeToggle from '../theme-toggle';
export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      setPassword('');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
      window.location.replace('/');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.'); setBusy(false); }
  }
  return <div className="shell login-shell"><header className="topbar"><a className="brand" href="/login"><span className="brand-icon"><ArrowDownToLine size={18}/></span>ClipSave<span className="local-tag">PRIVATE</span></a><ThemeToggle/></header><main className="login-main"><div className="intro"><div className="eyebrow"><LockKeyhole size={12}/> YOUR PRIVATE VIDEO UTILITY</div><h1>Just for you<span>.</span></h1><p>Enter your password to open ClipSave.</p></div><section className="workspace login-card"><form onSubmit={submit}><label htmlFor="password">Your password</label><div className="input-row"><LockKeyhole size={17}/><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} autoFocus placeholder="Enter your password"/></div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary download-button" disabled={busy||!password}>{busy?<LoaderCircle size={16} className="spin"/>:<>Unlock ClipSave<ArrowRight size={16}/></>}</button></form><div className="card-footer"><LockKeyhole size={12}/> Protected by your private password.</div></section></main><footer><span className="footer-brand">ClipSave</span><p>Your videos. Your space.</p></footer></div>;
}
