'use client';

import { useState } from 'react';
import type { Faq } from '../../lib/scholarships-api';

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="scholarship-faq-list">
      {faqs.map((faq, idx) => {
        const open = openIndex === idx;
        return (
          <div key={idx} className="scholarship-faq-item" data-open={open}>
            <button type="button" className="scholarship-faq-question" onClick={() => setOpenIndex(open ? null : idx)} aria-expanded={open}>
              {faq.question}
              <span className="scholarship-faq-caret">▾</span>
            </button>
            {open && <p className="scholarship-faq-answer">{faq.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
