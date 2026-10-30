'use client';
import { useEffect, useState } from 'react';
import { scholarshipsApi, type Scholarship } from '../../../lib/scholarships-api';
import { ScholarshipCard } from '../../../components/scholarships/ScholarshipCard';

/**
 * Live-hydrated chat card for scholarships — same pattern as
 * CollegeResultCard, reusing the existing public scholarshipsApi.getDetail()
 * and the same ScholarshipCard component the /scholarships directory uses
 * (its bookmark toggle is optional and simply omitted here, since saving a
 * scholarship belongs to that directory page, not an inline chat card).
 */
export function ScholarshipResultCard({ scholarshipId }: { scholarshipId: string }) {
  const [scholarship, setScholarship] = useState<Scholarship | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    scholarshipsApi.getDetail(scholarshipId)
      .then(s => { if (!cancelled) setScholarship(s); })
      .catch(() => { if (!cancelled) setScholarship(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scholarshipId]);

  if (loading) return <div className="chat-result-card-skeleton" aria-hidden="true" />;
  if (!scholarship) return null;

  return (
    <div style={{ maxWidth: '360px', marginTop: '12px' }}>
      <ScholarshipCard scholarship={scholarship} />
    </div>
  );
}
