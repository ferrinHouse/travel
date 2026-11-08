'use client';

import { useId, useState } from 'react';
import { GROCERY_BASE, groceryCategoriesInUse, groceryCategoryOptions } from '@/lib/categories';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { useTrip } from '../TripContext';
import styles from '../trip.module.css';

export default function GroceryList() {
  const { trip, dispatch, canEdit } = useTrip();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', category: GROCERY_BASE[0] });
  const [adding, setAdding] = useState(false);
  const id = useId();

  const categories = groceryCategoriesInUse(trip.groceries);

  const toggle = async (item) => {
    const next = !item.isBought;
    dispatch({ type: 'grocery/patch', id: item.id, patch: { isBought: next } });
    try {
      await apiFetch('/api/grocery', { method: 'POST', body: { id: item.id, isBought: next } });
    } catch (err) {
      dispatch({ type: 'grocery/patch', id: item.id, patch: { isBought: !next } });
      toast.error(`Couldn't update “${item.name}”: ${err.message}`);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    setAdding(true);
    try {
      const data = await apiFetch('/api/grocery', {
        method: 'PUT',
        body: { tripId: trip.id, name, category: form.category },
      });
      dispatch({ type: 'grocery/add', item: data.item });
      setForm((prev) => ({ ...prev, name: '' }));
    } catch (err) {
      toast.error(`Couldn't add grocery item: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card">
      <h2 className={styles.sectionHeading}>🛒 Master Grocery Shopping List</h2>

      {categories.length === 0 ? (
        <p className={styles.emptyNote}>No groceries yet.{canEdit && ' Add an item below!'}</p>
      ) : (
        categories.map((category) => (
          <div key={category} className="grocery-category">
            <h3 className={styles.groceryCategory}>{category}</h3>
            {trip.groceries
              .filter((g) => g.category === category)
              .map((item) => (
                <div key={item.id} className="checklist-item">
                  <input
                    id={`${id}-${item.id}`}
                    type="checkbox"
                    className="checkbox-custom"
                    checked={item.isBought}
                    onChange={() => toggle(item)}
                  />
                  <label
                    htmlFor={`${id}-${item.id}`}
                    className={`${styles.checkLabel} ${item.isBought ? 'completed-text' : ''}`}
                  >
                    {item.name}
                  </label>
                </div>
              ))}
          </div>
        ))
      )}

      {canEdit && (
        <form onSubmit={add} className={styles.groceryForm}>
          <h4>Add Custom Grocery Item</h4>
          <div className={styles.groceryInputs}>
            <input
              type="text"
              aria-label="Grocery item name"
              placeholder="Item name (e.g. 2 lbs Ground Beef)"
              className={`edit-input ${styles.groceryName}`}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
              aria-label="Grocery category"
              className={`edit-input ${styles.grocerySelect}`}
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {groceryCategoryOptions(trip.groceries).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="btn" disabled={adding || !form.name.trim()}>
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
