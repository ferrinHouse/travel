'use client';

import { useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api-client';
import { useTrip } from '../TripContext';
import LogisticsCard from './LogisticsCard';
import LogisticsForm from './LogisticsForm';
import styles from '../trip.module.css';

export default function LogisticsTab() {
  const { trip, dispatch, canEdit } = useTrip();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const add = async (values) => {
    try {
      const data = await apiFetch('/api/logistics', { method: 'POST', body: { tripId: trip.id, ...values } });
      dispatch({ type: 'logistics/add', card: data.card });
      setAdding(false);
    } catch (err) {
      toast.error(`Couldn't add card: ${err.message}`);
    }
  };

  return (
    <div>
      {trip.logistics.length === 0 ? (
        <div className="card">
          <EmptyState icon="✈️" title="No logistics yet.">
            Flights, hotels and confirmation numbers will show up here.
          </EmptyState>
        </div>
      ) : (
        <div className="grid">
          {trip.logistics.map((card) => (
            <LogisticsCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {canEdit && (
        <div className={`card ${styles.logisticsAdd}`}>
          {adding ? (
            <div>
              <h3 className={styles.cardTitle}>➕ Add Logistics Card</h3>
              <LogisticsForm
                idPrefix="new-logistics"
                submitLabel="Save Card"
                rows={6}
                onSubmit={add}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <div className={styles.centered}>
              <button type="button" className="btn btn-outline" onClick={() => setAdding(true)}>
                ➕ Add Logistics Card
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
