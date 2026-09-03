'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { financialApi, type AmortizationResult, type LoanOfferComparison } from '../../../lib/financial-api';
import { LineChart } from '../../../components/financial/LineChart';
import { PrintableReport } from '../../../components/financial/PrintableReport';
import { downloadCsv } from '../../../lib/csv-export';

function formatLakh(n: number): string {
  return `₹${(n / 100000).toFixed(2)} Lakh`;
}
function formatRupee(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function LoanPlannerView() {
  const [loanAmount, setLoanAmount] = useState(1000000);
  const [interestRate, setInterestRate] = useState(9);
  const [tenureYears, setTenureYears] = useState(10);
  const [moratoriumMonths, setMoratoriumMonths] = useState(0);

  // Memoized so the object reference only changes when an input value
  // actually changes — not on every render (e.g. from isLoading/result
  // state updates elsewhere in this component), which would otherwise
  // retrigger useDebouncedValue's effect and loop indefinitely.
  const loanInputs = useMemo(
    () => ({ loanAmount, interestRate, tenureYears, moratoriumMonths }),
    [loanAmount, interestRate, tenureYears, moratoriumMonths],
  );
  const debounced = useDebouncedValue(loanInputs, 300);

  const [result, setResult] = useState<AmortizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    financialApi.calculateLoan(debounced)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  // Loan-offer comparison — two editable offers, defaulted from the main calculator.
  const [offerA, setOfferA] = useState({ label: 'Public Sector Bank', interestRate: 8.5, tenureYears: 10 });
  const [offerB, setOfferB] = useState({ label: 'Private Bank / NBFC', interestRate: 11, tenureYears: 10 });
  const offerInputs = useMemo(() => ({ loanAmount, offerA, offerB }), [loanAmount, offerA, offerB]);
  const debouncedOffers = useDebouncedValue(offerInputs, 300);
  const [comparison, setComparison] = useState<LoanOfferComparison | null>(null);

  useEffect(() => {
    let cancelled = false;
    financialApi.compareLoanOffers([
      { label: debouncedOffers.offerA.label, loanAmount: debouncedOffers.loanAmount, interestRate: debouncedOffers.offerA.interestRate, tenureYears: debouncedOffers.offerA.tenureYears },
      { label: debouncedOffers.offerB.label, loanAmount: debouncedOffers.loanAmount, interestRate: debouncedOffers.offerB.interestRate, tenureYears: debouncedOffers.offerB.tenureYears },
    ])
      .then(r => { if (!cancelled) setComparison(r); })
      .catch(() => { if (!cancelled) setComparison(null); });
    return () => { cancelled = true; };
  }, [debouncedOffers]);

  const exportCsv = () => {
    if (!result) return;
    downloadCsv('loan-repayment-schedule.csv', result.yearlySchedule.map(y => ({
      year: y.year, openingBalance: y.openingBalance, principalPaid: y.totalPrincipalPaid,
      interestPaid: y.totalInterestPaid, closingBalance: y.closingBalance,
    })));
  };

  return (
    <PrintableReport title="Education Loan Repayment Schedule" onExportCsv={result ? exportCsv : undefined}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start' }}>
        <div className="card-editorial" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 className="font-serif" style={{ fontSize: '24px', margin: 0 }}>Loan Parameters</h3>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              <span>Required Loan Amount</span>
              <span style={{ color: 'var(--accent-blue)' }}>{formatLakh(loanAmount)}</span>
            </div>
            <input type="range" min="100000" max="3000000" step="50000" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-blue)' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              <span>Annual Interest Rate</span>
              <span>{interestRate}%</span>
            </div>
            <input type="range" min="6.5" max="14" step="0.25" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--text-primary)' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              <span>Repayment Tenure</span>
              <span>{tenureYears} Years</span>
            </div>
            <input type="range" min="3" max="15" step="1" value={tenureYears} onChange={e => setTenureYears(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--text-primary)' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              <span>Moratorium Period (during study)</span>
              <span>{moratoriumMonths} Months</span>
            </div>
            <input type="range" min="0" max="60" step="6" value={moratoriumMonths} onChange={e => setMoratoriumMonths(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--text-primary)' }} />
          </div>
        </div>

        <div className="card-editorial" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <span className="badge-editorial" style={{ alignSelf: 'flex-start' }}>Estimated Monthly Repayment</span>

          <div className="font-serif" style={{ fontSize: '48px', color: 'var(--text-primary)' }}>
            {isLoading || !result ? '…' : formatRupee(result.monthlyEmi)} <span style={{ fontSize: '18px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>/ month</span>
          </div>

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '15px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Principal Loan Amount:</span>
                <span style={{ fontWeight: 500 }}>{formatRupee(result.principal)}</span>
              </div>
              {result.moratoriumInterestAccrued > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Moratorium Interest Accrued:</span>
                  <span style={{ fontWeight: 500 }}>{formatRupee(result.moratoriumInterestAccrued)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Interest Payable:</span>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{formatRupee(result.totalInterest)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Processing Fee (est.):</span>
                <span style={{ fontWeight: 500 }}>{formatRupee(result.processingFeeAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '18px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <span>Total Cost of Loan:</span>
                <span className="font-serif">{formatRupee(result.totalCostOfLoan)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="card-editorial" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="font-serif" style={{ fontSize: '22px', margin: 0 }}>Yearly Repayment Schedule</h3>
            <button type="button" className="btn-editorial-secondary" onClick={() => setShowFullSchedule(s => !s)}>
              {showFullSchedule ? 'Hide' : 'Show'} Full Schedule
            </button>
          </div>
          <LineChart data={result.yearlySchedule.map(y => ({ label: `Yr ${y.year}`, value: y.closingBalance }))} height={160} />
          {showFullSchedule && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Year</th>
                    <th style={{ padding: '8px' }}>Opening Balance</th>
                    <th style={{ padding: '8px' }}>Principal Paid</th>
                    <th style={{ padding: '8px' }}>Interest Paid</th>
                    <th style={{ padding: '8px' }}>Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.yearlySchedule.map(y => (
                    <tr key={y.year} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>{y.year}</td>
                      <td style={{ padding: '8px' }}>{formatRupee(y.openingBalance)}</td>
                      <td style={{ padding: '8px' }}>{formatRupee(y.totalPrincipalPaid)}</td>
                      <td style={{ padding: '8px', color: 'var(--accent-blue)' }}>{formatRupee(y.totalInterestPaid)}</td>
                      <td style={{ padding: '8px' }}>{formatRupee(y.closingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card-editorial" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 className="font-serif" style={{ fontSize: '22px', margin: 0 }}>Compare Loan Offers</h3>
        <p className="text-body" style={{ margin: 0, fontSize: '14px' }}>Comparing at the same loan amount ({formatLakh(loanAmount)}) with different rates/tenures.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {[{ offer: offerA, setOffer: setOfferA }, { offer: offerB, setOffer: setOfferB }].map(({ offer, setOffer }, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="input-editorial" value={offer.label}
                onChange={e => setOffer(o => ({ ...o, label: e.target.value }))}
              />
              <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Interest Rate: {offer.interestRate}%
                <input type="range" min="6.5" max="16" step="0.25" value={offer.interestRate} onChange={e => setOffer(o => ({ ...o, interestRate: Number(e.target.value) }))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Tenure: {offer.tenureYears} Years
                <input type="range" min="3" max="15" step="1" value={offer.tenureYears} onChange={e => setOffer(o => ({ ...o, tenureYears: Number(e.target.value) }))} style={{ width: '100%' }} />
              </label>
            </div>
          ))}
        </div>

        {comparison && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Offer</th>
                  <th style={{ padding: '8px' }}>Monthly EMI</th>
                  <th style={{ padding: '8px' }}>Total Interest</th>
                  <th style={{ padding: '8px' }}>Total Cost of Loan</th>
                </tr>
              </thead>
              <tbody>
                {comparison.offers.map(o => (
                  <tr key={o.label} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px', fontWeight: o.label === comparison.cheapestLabel ? 700 : 400 }}>
                      {o.label} {o.label === comparison.cheapestLabel && <span className="badge-editorial" style={{ marginLeft: '8px' }}>Cheapest</span>}
                    </td>
                    <td style={{ padding: '8px' }}>{formatRupee(o.monthlyEmi)}</td>
                    <td style={{ padding: '8px', color: 'var(--accent-blue)' }}>{formatRupee(o.totalInterest)}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{formatRupee(o.totalCostOfLoan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </PrintableReport>
  );
}
