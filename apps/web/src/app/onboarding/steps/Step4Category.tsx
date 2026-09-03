'use client';

import { Fragment } from 'react';
import { HORIZONTAL_RESERVATIONS, RESERVATION_CATEGORIES, type Step4Data } from '../types';

export function Step4Category({ data, onChange }: { data: Step4Data; onChange: (patch: Partial<Step4Data>) => void }) {
  const toggleReservation = (r: string) => {
    const has = data.horizontalReservations.includes(r);
    onChange({
      horizontalReservations: has
        ? data.horizontalReservations.filter(x => x !== r)
        : [...data.horizontalReservations, r],
    });
  };

  return (
    <Fragment>
      <div className="wizard-step-heading">
        <h2 className="font-serif">Category &amp; Reservation</h2>
        <p>These details determine which reservation-based cutoffs apply to your predictions.</p>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Category</label>
        <div className="wizard-chip-group">
          {RESERVATION_CATEGORIES.map(cat => (
            <button
              key={cat} type="button" className="wizard-chip" data-selected={data.reservationCategory === cat}
              onClick={() => onChange({ reservationCategory: cat })}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Horizontal Reservations</label>
        <span className="wizard-hint">Select all that apply — you can pick more than one.</span>
        <div className="wizard-chip-group">
          {HORIZONTAL_RESERVATIONS.map(r => (
            <button
              key={r} type="button" className="wizard-chip" data-selected={data.horizontalReservations.includes(r)}
              onClick={() => toggleReservation(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </Fragment>
  );
}
