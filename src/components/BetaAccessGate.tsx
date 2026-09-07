import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  betaEmailToUsername,
  betaLoginErrorMessage,
  betaUsernameToEmail,
  isValidBetaLogin,
} from '@/domain/betaAccess';
import { supabase } from '@/services/supabaseClient';

type GateState = 'checking' | 'signed_out' | 'signed_in';

type Props = { children: ReactNode };

export function BetaAccessGate({ children }: Props) {
  const [gateState, setGateState] = useState<GateState>('checking');
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const validateSession = useCallback(async (showChecking = false) => {
    if (showChecking) setGateState('checking');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setUser(null);
      setGateState('signed_out');
      return false;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
      setGateState('signed_out');
      return false;
    }
    setUser(data.user);
    setGateState('signed_in');
    return true;
  }, []);

  useEffect(() => {
    void validateSession(true);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setGateState('signed_out');
      } else {
        setUser(session.user);
        setGateState('signed_in');
      }
    });

    const interval = window.setInterval(() => {
      void validateSession(false);
    }, 15 * 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void validateSession(false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      listener.subscription.unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [validateSession]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const normalized = username.trim().toLowerCase();
    if (!isValidBetaLogin(normalized)) {
      setMessage('Inserisci uno username o una email validi.');
      return;
    }
    if (!password) {
      setMessage('Inserisci la password.');
      return;
    }
    setBusy(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: betaUsernameToEmail(normalized),
      password,
    });
    if (error || !data.user) {
      if (data.user) await supabase.auth.signOut();
      setMessage(betaLoginErrorMessage());
      setBusy(false);
      return;
    }
    setUser(data.user);
    setPassword('');
    setGateState('signed_in');
    setBusy(false);
  };

  const logout = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    setUser(null);
    setGateState('signed_out');
    setBusy(false);
  };

  if (gateState === 'checking') {
    return <div className="beta-screen"><div className="beta-card beta-loading"><div className="beta-logo">A</div><h1>App Nutrition</h1><p>Verifica accesso in corso…</p><div className="beta-spinner" /></div></div>;
  }

  if (gateState === 'signed_out') {
    return <div className="beta-screen"><form className="beta-card" onSubmit={login}>
      <div className="beta-logo">A</div>
      <p className="eyebrow red">ACCESSO BETA</p>
      <h1>App Nutrition</h1>
      <p className="beta-subtitle">Inserisci le credenziali ricevute per accedere alla versione di prova.</p>
      <label className="beta-field"><span>Username o email</span><input autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="tester01 o nome@email.it" /></label>
      <label className="beta-field"><span>Password</span><div className="beta-password"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Nascondi' : 'Mostra'}</button></div></label>
      {!!message && <div className="beta-error">{message}</div>}
      <button className="primary beta-login-button" type="submit" disabled={busy}>{busy ? 'Accesso…' : 'Accedi'}</button>
      <small className="beta-version">App Nutrition 1.1.6 Beta</small>
    </form></div>;
  }

  const displayUsername = betaEmailToUsername(user?.email);
  return <div className="beta-authenticated">
    <div className="beta-user-chip"><span>{displayUsername}</span><button type="button" onClick={() => void logout()} disabled={busy}>Esci</button></div>
    {children}
  </div>;
}
