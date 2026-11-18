import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Button, Field, Logo } from '../components/common/Primitives'

export function StaffLoginPage({
  email,
  password,
  showPassword,
  error,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
  onNavigateHome,
}: {
  email: string
  password: string
  showPassword: boolean
  error: string
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
  onTogglePassword: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onNavigateHome: () => void
}) {
  return <main className="login-page"><div className="login-decoration decoration-one" /><div className="login-decoration decoration-two" /><div className="login-shell"><div className="login-brand"><button onClick={onNavigateHome}><Logo /></button></div><section className="login-card"><span className="login-icon"><Icon name="lock" size={21} /></span><span className="eyebrow">Team access</span><h1>Welcome <span>back.</span></h1><p>Sign in to manage orders and keep things moving.</p><form onSubmit={onSubmit}><Field label="Work email" required><input className="input" type="email" autoComplete="username" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@shop.com" /></Field><Field label="Password" required><span className="password-wrap"><input className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={onTogglePassword} aria-label={showPassword ? 'Hide password' : 'Show password'}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} /></button></span></Field>{error && <p className="form-error-banner" role="alert"><Icon name="info" size={16} />{error}</p>}<Button type="submit" className="login-submit">Sign in <Icon name="arrow" size={17} /></Button></form><div className="demo-credentials"><Icon name="info" size={15} /><span><b>Server authentication</b><br />Use the staff credentials configured in your local <code>.env</code> file.</span></div><button className="back-to-site" onClick={onNavigateHome}><Icon name="arrow" size={15} /> Back to PrintHub</button></section><p className="login-footnote"><Icon name="shield" size={15} /> GCash checkout and payment verification are restricted to PayMongo test mode.</p></div></main>
}
