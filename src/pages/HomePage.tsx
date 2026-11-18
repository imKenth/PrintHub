import type { MouseEvent } from 'react'
import { Icon } from '../components/Icon'
import { Button, Logo, PrinterIllustration } from '../components/common/Primitives'
import type { Page } from '../types/app'

export function HomePage({
  onNavigate,
  onStartOrder,
  onGoHome,
  onScrollToSection,
}: {
  onNavigate: (page: Page) => void
  onStartOrder: () => void
  onGoHome: () => void
  onScrollToSection: (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => void
}) {
  return (
    <>
      <header className="public-header">
        <a href="#home" className="brand-anchor" onClick={(event) => { event.preventDefault(); onGoHome() }}><Logo /></a>
        <nav className="public-nav" aria-label="Main navigation">
          <a href="#features" onClick={(event) => onScrollToSection(event, 'features')}>Why PrintHub</a><a href="#how-it-works" onClick={(event) => onScrollToSection(event, 'how-it-works')}>How it works</a><a href="#contact" onClick={(event) => onScrollToSection(event, 'contact')}>Contact</a>
        </nav>
        <div className="header-actions"><button className="header-login" onClick={() => onNavigate('login')}>Staff sign in</button><Button onClick={onStartOrder}>Order now <Icon name="arrow" size={17} /></Button></div>
      </header>
      <main>
        <section className="hero-section page-width">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> Your neighborhood print shop, made simple</span>
            <h1>Print smarter,<br /><span>not harder.</span></h1>
            <p>From your first upload to pickup, getting beautiful prints should be the easiest part of your day.</p>
            <div className="hero-actions"><Button onClick={onStartOrder}>Start an order <Icon name="arrow" size={18} /></Button><button className="text-action" onClick={() => onNavigate('track')}>Track an order <Icon name="arrow" size={16} /></button></div>
            <div className="hero-proof"><span className="proof-avatar"><Icon name="shield" size={16} /></span><span>Clear prices. Quality prints. Ready when you are.</span></div>
          </div>
          <div className="hero-visual"><div className="visual-caption"><span className="caption-dot" /><span>Made for your next big idea</span></div><PrinterIllustration /><div className="floating-note"><span className="note-icon"><Icon name="sparkles" size={17} /></span><span><b>Prints that feel</b><br />a little more personal</span></div><div className="floating-sticker"><Icon name="heart" size={19} /></div></div>
        </section>
        <section className="feature-section page-width" id="features">
          <div className="section-heading scroll-reveal"><span className="eyebrow">A better way to print</span><h2>Small details. <span>Big difference.</span></h2><p>Everything you need to get your prints done without the back-and-forth.</p></div>
          <div className="feature-grid">
            <article className="feature-card scroll-reveal"><span className="feature-icon icon-pink"><Icon name="sparkles" size={22} /></span><h3>Fast & easy ordering</h3><p>Choose your print options, upload your file, and see the exact price before you submit.</p><button className="card-link" onClick={onStartOrder}>Create an order <Icon name="arrow" size={15} /></button></article>
            <article className="feature-card scroll-reveal"><span className="feature-icon icon-lilac"><Icon name="package" size={22} /></span><h3>Track your order</h3><p>Follow every step from payment verification to pickup—no account needed.</p><button className="card-link" onClick={() => onNavigate('track')}>Find your order <Icon name="arrow" size={15} /></button></article>
            <article className="feature-card scroll-reveal"><span className="feature-icon icon-peach"><Icon name="star" size={22} /></span><h3>Quality prints, always</h3><p>Every order gets the care and attention you'd expect from your local print shop.</p><button className="card-link" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>See how it works <Icon name="arrow" size={15} /></button></article>
          </div>
        </section>
        <section className="how-section" id="how-it-works"><div className="page-width how-inner"><div className="section-heading scroll-reveal"><span className="eyebrow">Just four easy steps</span><h2>From file to <span>finished.</span></h2><p>Your time is precious. We made ordering straightforward.</p></div><div className="how-grid"><div className="how-step scroll-reveal"><span>01</span><h3>Tell us what you need</h3><p>Pick your service, paper, color, and quantity.</p></div><div className="how-step scroll-reveal"><span>02</span><h3>Upload your file</h3><p>Share your PDF or image securely with your order.</p></div><div className="how-step scroll-reveal"><span>03</span><h3>Know your final price</h3><p>Review and agree to the exact price before submitting.</p></div><div className="how-step scroll-reveal"><span>04</span><h3>Pick up & enjoy</h3><p>Track progress and collect your prints when they're ready.</p></div></div><div className="how-cta scroll-reveal"><div><h3>Ready when you are.</h3><p>Great prints start with one simple order.</p></div><Button onClick={onStartOrder}>Place an order <Icon name="arrow" size={17} /></Button></div></div></section>
      </main>
      <footer className="public-footer" id="contact"><div className="page-width footer-content"><div className="footer-brand"><Logo /><p>A little more joy in every print.</p></div><div className="footer-contact"><h2>Contact the shop</h2><div className="footer-contact-grid"><div className="footer-contact-item"><span className="footer-contact-icon"><Icon name="printer" size={18} /></span><div><span className="footer-label">Shop</span><b>Micah's Printing Shop</b></div></div><div className="footer-contact-item"><span className="footer-contact-icon"><Icon name="home" size={18} /></span><div><span className="footer-label">Location</span><span>Maa, Davao City</span></div></div><div className="footer-contact-item"><span className="footer-contact-icon"><Icon name="mail" size={18} /></span><div><span className="footer-label">Email</span><a href="mailto:printhub@gmail.com">printhub@gmail.com</a></div></div><div className="footer-contact-item"><span className="footer-contact-icon"><Icon name="phone" size={18} /></span><div><span className="footer-label">Phone</span><a href="tel:+639513771721">0951 377 1721</a></div></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} PrintHub. Made with care.</span><button onClick={() => onNavigate('login')}>Staff portal <Icon name="arrow" size={14} /></button></div></div></footer>
    </>
  )
}
