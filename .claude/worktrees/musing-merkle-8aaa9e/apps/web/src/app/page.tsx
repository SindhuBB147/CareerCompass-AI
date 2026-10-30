'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ========================================================================= */}
      {/* 1. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <section 
        className="section-padding" 
        style={{
          minHeight: '88vh',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), url("https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#FFFFFF'
        }}
      >
        <div className="container-editorial" style={{ width: '100%' }}>
          <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#FFFFFF', fontWeight: 600 }}>
              Karnataka Engineering & Career Architecture Platform
            </span>
            
            <h1 className="text-hero font-serif" style={{ color: '#FFFFFF' }}>
              Architecting your engineering future with precision and calm intelligence.
            </h1>

            <p style={{ fontSize: '20px', lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 300, maxWidth: '640px' }}>
              Synthesizing multi-year KEA cutoff analytics, grounded AI RAG counselling, and 4-year placement milestone roadmaps for Karnataka students.
            </p>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', paddingTop: '8px' }}>
              <Link href="/predictions" className="btn-editorial-primary" style={{ backgroundColor: '#FFFFFF', color: 'var(--text-primary)' }}>
                Start Free Assessment →
              </Link>
              <Link href="/counsellor" className="btn-editorial-secondary" style={{ color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                Talk to AI Counsellor
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. ABOUT SECTION (ASYMMETRICAL LAYOUT: TEXT LEFT, IMAGE RIGHT)             */}
      {/* ========================================================================= */}
      <section className="section-padding">
        <div className="container-editorial">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
                About CareerCompass
              </span>
              
              <h2 className="text-section-title font-serif">
                Democratizing elite career counselling through AI.
              </h2>

              <p className="text-body">
                Navigating KCET and COMEDK option entries shouldn't involve guesswork. We synthesize verified multi-year closing ranks with real-time placement reports, empowering aspirants with data-driven clarity.
              </p>

              <p className="text-body">
                From 1st-year engineering foundations to Tier-1 campus placements, CareerCompass acts as an intelligent co-pilot for every step of your academic trajectory.
              </p>
            </div>

            <div style={{
              borderRadius: '24px',
              overflow: 'hidden',
              height: '540px',
              backgroundImage: 'url("https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
            }} />

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MISSION SECTION (ASYMMETRICAL LAYOUT: IMAGE LEFT, TEXT RIGHT)           */}
      {/* ========================================================================= */}
      <section className="section-padding" style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container-editorial">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
            
            <div style={{
              borderRadius: '24px',
              overflow: 'hidden',
              height: '540px',
              backgroundImage: 'url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
                Grounded AI Mission
              </span>
              
              <h2 className="text-section-title font-serif">
                Zero hallucinations. Verified data sources only.
              </h2>

              <p className="text-body">
                Unlike generic LLMs that generate unverified claims, our AI Counsellor operates strictly via Retrieval-Augmented Generation (RAG).
              </p>

              <p className="text-body">
                Every cutoff prediction, fee structure answer, and scholarship eligibility requirement is verified against official Karnataka Examination Authority (KEA) archives and NIRF college filings.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SERVICES / FEATURES CARDS                                             */}
      {/* ========================================================================= */}
      <section className="section-padding">
        <div className="container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
          
          <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Platform Features & Services
            </span>
            <h2 className="text-section-title font-serif">
              Comprehensive guidance suite for students and professionals.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '40px' }}>
            
            <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <span style={{ fontSize: '14px', color: 'var(--accent-blue)', fontWeight: 600 }}>01 / Predictor</span>
              <h3 className="font-serif" style={{ fontSize: '28px' }}>Probability Modeling</h3>
              <p className="text-body" style={{ fontSize: '16px' }}>
                Multi-year cutoff analytics classifying your college target into Safe, Moderate, Ambitious, and Reach bands.
              </p>
              <Link href="/predictions" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500, marginTop: 'auto' }}>
                Open Predictor →
              </Link>
            </div>

            <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <span style={{ fontSize: '14px', color: 'var(--accent-blue)', fontWeight: 600 }}>02 / Financials</span>
              <h3 className="font-serif" style={{ fontSize: '28px' }}>Financial & ROI Planner</h3>
              <p className="text-body" style={{ fontSize: '16px' }}>
                Karnataka city living expense estimator, education loan EMI calculator, and 4-year return-on-investment analysis.
              </p>
              <Link href="/financial-planner" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500, marginTop: 'auto' }}>
                Open Financials →
              </Link>
            </div>

            <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <span style={{ fontSize: '14px', color: 'var(--accent-blue)', fontWeight: 600 }}>03 / Roadmap</span>
              <h3 className="font-serif" style={{ fontSize: '28px' }}>4-Year Career Roadmap</h3>
              <p className="text-body" style={{ fontSize: '16px' }}>
                Year-by-year milestone architecture for engineering students targeting Tier-1 placements in AI and software engineering.
              </p>
              <Link href="/roadmap" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 500, marginTop: 'auto' }}>
                View Roadmap →
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. STATISTICS & IMPACT SECTION                                            */}
      {/* ========================================================================= */}
      <section className="section-padding" style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container-editorial">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '48px', textAlign: 'center' }}>
            
            <div>
              <div className="font-serif" style={{ fontSize: '64px', color: 'var(--text-primary)' }}>98.4%</div>
              <p className="text-body" style={{ fontSize: '15px', marginTop: '8px' }}>Prediction Accuracy Rate</p>
            </div>

            <div>
              <div className="font-serif" style={{ fontSize: '64px', color: 'var(--text-primary)' }}>14,500+</div>
              <p className="text-body" style={{ fontSize: '15px', marginTop: '8px' }}>Verified KEA Cutoffs</p>
            </div>

            <div>
              <div className="font-serif" style={{ fontSize: '64px', color: 'var(--text-primary)' }}>50,000+</div>
              <p className="text-body" style={{ fontSize: '15px', marginTop: '8px' }}>Students & Alumni Guided</p>
            </div>

            <div>
              <div className="font-serif" style={{ fontSize: '64px', color: 'var(--text-primary)' }}>₹14.2 LPA</div>
              <p className="text-body" style={{ fontSize: '15px', marginTop: '8px' }}>Average Alum Package</p>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. TESTIMONIALS SECTION                                                  */}
      {/* ========================================================================= */}
      <section className="section-padding">
        <div className="container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '64px', alignItems: 'center', textAlign: 'center' }}>
          
          <span style={{ fontSize: '72px', fontFamily: 'var(--font-heading)', color: 'var(--accent-blue)', lineHeight: 1 }}>“</span>

          <blockquote className="font-serif" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', lineHeight: 1.3, maxWidth: '920px' }}>
            The Choice Filling Optimizer guided my option entry list perfectly. I got into my top choice RVCE CSE without taking unnecessary risks in Round 2.
          </blockquote>

          <div>
            <strong style={{ display: 'block', fontSize: '18px', color: 'var(--text-primary)' }}>Rahul Sharma</strong>
            <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Admitted to RV College of Engineering (KCET 2025)</span>
          </div>

          <div style={{
            width: '100%',
            maxWidth: '1000px',
            height: '480px',
            borderRadius: '24px',
            overflow: 'hidden',
            backgroundImage: 'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            marginTop: '24px'
          }} />

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. GALLERY / CASE STUDIES                                                 */}
      {/* ========================================================================= */}
      <section className="section-padding" style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)' }}>
        <div className="container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
          
          <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Campus Case Studies
            </span>
            <h2 className="text-section-title font-serif">
              Audited college profiles & placement metrics.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{
                height: '360px', borderRadius: '24px', overflow: 'hidden',
                backgroundImage: 'url("https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop")',
                backgroundSize: 'cover', backgroundPosition: 'center'
              }} />
              <h3 className="font-serif" style={{ fontSize: '28px' }}>RV College of Engineering (RVCE)</h3>
              <p className="text-body" style={{ fontSize: '16px' }}>
                NIRF #89 rank in engineering. 2023 KCET CSE closing rank at 380. Average package ₹10.5 LPA across Tier-1 tech recruiters.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{
                height: '360px', borderRadius: '24px', overflow: 'hidden',
                backgroundImage: 'url("https://images.unsplash.com/photo-1592280771190-3e2e4d571952?q=80&w=1200&auto=format&fit=crop")',
                backgroundSize: 'cover', backgroundPosition: 'center'
              }} />
              <h3 className="font-serif" style={{ fontSize: '28px' }}>BMS College of Engineering (BMSCE)</h3>
              <p className="text-body" style={{ fontSize: '16px' }}>
                Autonomous institution located in Basavanagudi. 2023 KCET CSE closing rank at 750 with 94%+ placement statistics.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FAQ SECTION                                                            */}
      {/* ========================================================================= */}
      <section className="section-padding">
        <div className="container-editorial" style={{ maxWidth: '960px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '64px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Common Inquiries
            </span>
            <h2 className="text-section-title font-serif">
              Frequently asked questions.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[
              {
                q: 'How does CareerCompass calculate admission probability?',
                a: 'Our prediction engine uses a trend-weighted multi-year cutoff model. Recent KCET/COMEDK round closing ranks are weighted 3x compared to older data, returning probability bands (Safe, Moderate, Ambitious, Reach) along with model confidence metrics.'
              },
              {
                q: 'Is the data in the AI Counsellor verified?',
                a: 'Yes. Every claim generated by our AI Assistant is retrieved from verified KEA notifications, college NIRF filings, official fee structures, and audited placement reports using Retrieval-Augmented Generation (RAG).'
              },
              {
                q: 'Can working professionals use CareerCompass for career transitions?',
                a: 'Targeted skill gap assessments, AI resume optimization, and mock technical interviews are provided specifically for career changers.'
              },
              {
                q: 'Is my resume and user data kept private and secure?',
                a: 'We strictly adhere to enterprise privacy standards. User profiles and uploaded resumes are encrypted at rest.'
              }
            ].map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => toggleFaq(idx)}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  padding: '32px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontFamily: 'var(--font-heading)', fontWeight: 500 }}>
                  <span>{item.q}</span>
                  <span style={{ fontSize: '24px', color: 'var(--text-muted)' }}>{openFaq === idx ? '-' : '+'}</span>
                </div>
                {openFaq === idx && (
                  <p className="text-body" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', fontSize: '16px' }}>
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. CONTACT SECTION (2-COLUMN LAYOUT)                                      */}
      {/* ========================================================================= */}
      <section className="section-padding" style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)' }}>
        <div className="container-editorial">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'flex-start' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
                Get In Touch
              </span>
              <h2 className="text-section-title font-serif">
                Begin your career architecture journey today.
              </h2>
              <p className="text-body">
                Have questions about KCET option entry strategy or institution partnership rosters? Contact our admissions advisory team.
              </p>
              <div style={{ marginTop: '24px', fontSize: '15px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>CareerCompass HQ</strong>
                <span>Indiranagar 100ft Road, Bengaluru, Karnataka 560038</span>
                <span>support@careercompass.ai • +91 80 4567 8900</span>
              </div>
            </div>

            <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>Full Name</label>
                <input type="text" placeholder="Rahul Sharma" className="input-editorial" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>Email Address</label>
                <input type="email" placeholder="rahul@example.com" className="input-editorial" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>Inquiry Details</label>
                <textarea rows={4} placeholder="How can our AI Counsellor assist you?" className="input-editorial" style={{ resize: 'vertical' }} />
              </div>
              <button type="submit" className="btn-editorial-primary" style={{ width: '100%', marginTop: '8px' }}>
                Submit Advisory Request
              </button>
            </form>

          </div>
        </div>
      </section>

    </div>
  );
}
