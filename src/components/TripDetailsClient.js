'use client';

import { useState, useEffect } from 'react';
import { parseTimeToMinutes, getMealIcon, renderMarkdown } from '@/lib/helpers';

export default function TripDetailsClient({ initialTrip }) {
  const [trip, setTrip] = useState(initialTrip);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [isEditingEnabled, setIsEditingEnabled] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Edit states
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [editActivityForm, setEditActivityForm] = useState({ time: '', description: '', details: '', isAlert: false });
  const [newActivityDayId, setNewActivityDayId] = useState(null);
  const [newActivityForm, setNewActivityForm] = useState({ time: '', description: '', details: '', isAlert: false });
  
  const [editingLogisticsId, setEditingLogisticsId] = useState(null);
  const [editLogisticsForm, setEditLogisticsForm] = useState({ title: '', content: '' });
  const [showAddLogistics, setShowAddLogistics] = useState(false);
  const [newLogisticsForm, setNewLogisticsForm] = useState({ title: '', content: '' });

  const [newChecklistForm, setNewChecklistForm] = useState({ text: '', category: 'packing' });
  const [newGroceryForm, setNewGroceryForm] = useState({ name: '', category: 'General' });
  
  // Checklist edit states
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editChecklistText, setEditChecklistText] = useState('');
  const [checklistInputs, setChecklistInputs] = useState({ 'pre-trip': '', 'packing': '', 'app': '' });

  // Load session auth status on mount
  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setIsEditingEnabled(true);
        }
      });
  }, []);

  // Handle Authentication
  const handleUnlock = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json();
      if (data.success) {
        setIsEditingEnabled(true);
        setShowLockModal(false);
        setPasscode('');
      } else {
        setAuthError('Incorrect passcode. Try again.');
      }
    } catch (err) {
      setAuthError('Authentication error.');
    }
  };

  const handleLock = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsEditingEnabled(false);
  };

  // Toggle Checkboxes (No Auth Required for checking off)
  const toggleChecklist = async (itemId, currentStatus) => {
    const newStatus = !currentStatus;
    
    // Optimistic UI Update
    setTrip(prev => ({
      ...prev,
      checklist: prev.checklist.map(item => 
        item.id === itemId ? { ...item, isCompleted: newStatus } : item
      )
    }));

    try {
      await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, isCompleted: newStatus })
      });
    } catch (err) {
      console.error('Failed to sync checklist toggle');
    }
  };

  // Add Checklist Item (Auth Required)
  const addChecklistItem = async (category, text) => {
    if (!text.trim()) return;

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, text, category })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          checklist: [...prev.checklist, data.item]
        }));
      } else {
        alert(data.message || 'Failed to add item');
      }
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    }
  };

  // Edit Checklist Item (Auth Required)
  const editChecklistItem = async (itemId, text) => {
    if (!text.trim()) return;

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, text })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          checklist: prev.checklist.map(item =>
            item.id === itemId ? { ...item, text: data.item.text } : item
          )
        }));
      } else {
        alert(data.message || 'Failed to edit item');
      }
    } catch (err) {
      console.error('Failed to edit checklist item:', err);
    }
  };

  // Delete Checklist Item (Auth Required)
  const deleteChecklistItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const res = await fetch('/api/checklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          checklist: prev.checklist.filter(item => item.id !== itemId)
        }));
      } else {
        alert(data.message || 'Failed to delete item');
      }
    } catch (err) {
      console.error('Failed to delete checklist item:', err);
    }
  };

  const toggleGrocery = async (itemId, currentStatus) => {
    const newStatus = !currentStatus;
    
    // Optimistic UI Update
    setTrip(prev => ({
      ...prev,
      groceries: prev.groceries.map(item => 
        item.id === itemId ? { ...item, isBought: newStatus } : item
      )
    }));

    try {
      await fetch('/api/grocery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, isBought: newStatus })
      });
    } catch (err) {
      console.error('Failed to sync grocery toggle');
    }
  };

  // Add Custom Grocery Item
  const handleAddGrocery = async (e) => {
    e.preventDefault();
    if (!newGroceryForm.name) return;

    try {
      const res = await fetch('/api/grocery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          name: newGroceryForm.name,
          category: newGroceryForm.category
        })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          groceries: [...prev.groceries, data.item]
        }));
        setNewGroceryForm(prev => ({ ...prev, name: '' }));
      }
    } catch (err) {
      console.error('Failed to add grocery');
    }
  };

  // Update Itinerary Activity (Auth Required)
  const saveActivityEdit = async (activityId) => {
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activityId, ...editActivityForm })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          days: prev.days.map(day => ({
            ...day,
            activities: day.activities.map(act => 
              act.id === activityId ? data.activity : act
            )
          }))
        }));
        setEditingActivityId(null);
      }
    } catch (err) {
      console.error('Failed to save activity');
    }
  };

  const handleAddActivity = async (dayId) => {
    if (!newActivityForm.description) return;
    try {
      const res = await fetch('/api/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayId, ...newActivityForm })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          days: prev.days.map(day => 
            day.id === dayId 
              ? { ...day, activities: [...day.activities, data.activity] }
              : day
          )
        }));
        setNewActivityDayId(null);
        setNewActivityForm({ time: '', description: '', details: '', isAlert: false });
      }
    } catch (err) {
      console.error('Failed to add activity');
    }
  };

  const handleDeleteActivity = async (dayId, activityId) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;
    try {
      const res = await fetch('/api/activities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activityId })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          days: prev.days.map(day => 
            day.id === dayId 
              ? { ...day, activities: day.activities.filter(act => act.id !== activityId) }
              : day
          )
        }));
      }
    } catch (err) {
      console.error('Failed to delete activity');
    }
  };

  // Update Logistics Card (Auth Required)
  const saveLogisticsEdit = async (cardId) => {
    try {
      const res = await fetch('/api/logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId, ...editLogisticsForm })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          logistics: prev.logistics.map(card => 
            card.id === cardId ? data.card : card
          )
        }));
        setEditingLogisticsId(null);
      }
    } catch (err) {
      console.error('Failed to save logistics card');
    }
  };

  // Add Logistics Card (Auth Required)
  const addLogisticsCard = async () => {
    if (!newLogisticsForm.title.trim() || !newLogisticsForm.content.trim()) return;

    try {
      const res = await fetch('/api/logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, ...newLogisticsForm })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          logistics: [...prev.logistics, data.card]
        }));
        setNewLogisticsForm({ title: '', content: '' });
        setShowAddLogistics(false);
      } else {
        alert(data.message || 'Failed to add card');
      }
    } catch (err) {
      console.error('Failed to add logistics card:', err);
    }
  };

  // Delete Logistics Card (Auth Required)
  const deleteLogisticsCard = async (cardId) => {
    if (!confirm('Are you sure you want to delete this logistics card?')) return;

    try {
      const res = await fetch('/api/logistics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId })
      });
      const data = await res.json();
      if (data.success) {
        setTrip(prev => ({
          ...prev,
          logistics: prev.logistics.filter(card => card.id !== cardId)
        }));
      } else {
        alert(data.message || 'Failed to delete card');
      }
    } catch (err) {
      console.error('Failed to delete logistics card:', err);
    }
  };

  // Update Meal Plan (Auth Required)
  const handleMealChange = async (dayNumber, mealType, field, val) => {
    // Optimistic Update
    setTrip(prev => {
      const exists = prev.meals.some(m => m.dayNumber === dayNumber && m.mealType === mealType);
      let updatedMeals;
      if (exists) {
        updatedMeals = prev.meals.map(m => 
          m.dayNumber === dayNumber && m.mealType === mealType 
            ? { ...m, [field]: val } 
            : m
        );
      } else {
        updatedMeals = [...prev.meals, { 
          dayNumber, 
          mealType, 
          mealName: field === 'mealName' ? val : '', 
          time: field === 'time' ? val : '' 
        }];
      }
      return { ...prev, meals: updatedMeals };
    });

    try {
      const existing = trip.meals.find(m => m.dayNumber === dayNumber && m.mealType === mealType) || {};
      const payload = {
        tripId: trip.id,
        dayNumber,
        mealType,
        mealName: field === 'mealName' ? val : (existing.mealName || ''),
        time: field === 'time' ? val : (existing.time || '')
      };
      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to update meal plan');
    }
  };

  // Group Checklist items by category
  const checklistCategories = ['pre-trip', 'packing', 'app'];
  
  // Group Grocery items by category
  const groceryCategories = Array.from(new Set(trip.groceries.map(g => g.category)));

  return (
    <div>
      {/* Edit Mode Lock Status Banner */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: isEditingEnabled ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 'bold' }}>
          {isEditingEnabled ? '🔓 ADMIN EDIT MODE ENABLED' : '🔒 VIEW ONLY MODE'}
        </span>
        {isEditingEnabled ? (
          <button className="btn btn-secondary" onClick={handleLock} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            Lock Editing
          </button>
        ) : (
          <button className="btn" onClick={() => setShowLockModal(true)} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            Unlock Editing
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'itinerary' ? 'active' : ''}`} onClick={() => setActiveTab('itinerary')}>
          🗓️ Daily Itinerary
        </button>
        <button className={`tab-btn ${activeTab === 'logistics' ? 'active' : ''}`} onClick={() => setActiveTab('logistics')}>
          ✈️ Logistics
        </button>
        <button className={`tab-btn ${activeTab === 'checklist' ? 'active' : ''}`} onClick={() => setActiveTab('checklist')}>
          ✅ Packing & Tasks
        </button>
        <button className={`tab-btn ${activeTab === 'meals' ? 'active' : ''}`} onClick={() => setActiveTab('meals')}>
          🥣 Meals & Groceries
        </button>
      </div>

      {/* 1. ITINERARY TAB */}
      {activeTab === 'itinerary' && (
        <div>
          {(() => {
            return trip.days.map((day) => {
              const dayMeals = trip.meals
                .filter(m => m.dayNumber === day.dayNumber && m.time && m.mealName)
                .map(m => ({
                  id: `meal-${m.id}`,
                  time: m.time,
                  description: `${m.mealType}: ${m.mealName}`,
                  details: m.details || '',
                  isMeal: true,
                  mealType: m.mealType
                }));

              const allActivities = [...day.activities, ...dayMeals];
              allActivities.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));

              return (
                <div key={day.id} className="itinerary-day card" style={{ marginBottom: '24px' }}>
                  <div className="itinerary-day-header">
                    <span>{day.dateLabel} {day.title ? `— ${day.title}` : ''}</span>
                  </div>
                  
                  <div style={{ paddingLeft: '10px' }}>
                    {allActivities.map((act) => (
                      <div key={act.id} className={`activity-item ${act.isAlert ? 'alert-box' : ''}`} style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 0' }}>
                        {editingActivityId === act.id && !act.isMeal ? (
                          <div style={{ width: '100%' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Time</label>
                            <input 
                              type="text" 
                              className="edit-input" 
                              value={editActivityForm.time} 
                              onChange={(e) => setEditActivityForm(prev => ({ ...prev, time: e.target.value }))}
                            />
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Description</label>
                            <input 
                              type="text" 
                              className="edit-input" 
                              value={editActivityForm.description} 
                              onChange={(e) => setEditActivityForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Details / Note</label>
                            <textarea 
                              className="edit-input" 
                              rows={3}
                              value={editActivityForm.details || ''} 
                              onChange={(e) => setEditActivityForm(prev => ({ ...prev, details: e.target.value }))}
                            />
                            <div style={{ marginBottom: '12px' }}>
                              <input 
                                type="checkbox" 
                                id={`alert-${act.id}`}
                                checked={editActivityForm.isAlert}
                                onChange={(e) => setEditActivityForm(prev => ({ ...prev, isAlert: e.target.checked }))}
                                style={{ marginRight: '8px' }}
                              />
                              <label htmlFor={`alert-${act.id}`} style={{ fontWeight: 'bold' }}>Highlight this Event (Red Alert Box)</label>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button className="btn" onClick={() => saveActivityEdit(act.id)}>Save</button>
                              <button className="btn btn-secondary" onClick={() => setEditingActivityId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="activity-time">{act.time || 'Flexible'}</span>
                            <div className="activity-content">
                              <strong 
                                style={{ fontSize: '1.05rem' }}
                                dangerouslySetInnerHTML={{ 
                                  __html: act.isMeal 
                                    ? `${getMealIcon(act.mealType)} ${renderMarkdown(act.description)}` 
                                    : renderMarkdown(act.description) 
                                }}
                              />
                              {act.details && (
                                <p 
                                  style={{ margin: '8px 0 0 0', color: '#555', whiteSpace: 'pre-wrap', fontStyle: 'italic', fontSize: '0.92rem', borderLeft: '3px solid #ccc', paddingLeft: '10px' }}
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(act.details) }}
                                />
                              )}
                              {act.isMeal && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                  Meal Plan Item (Edit in Meals tab)
                                </span>
                              )}
                            </div>
                            {isEditingEnabled && !act.isMeal && (
                              <div className="activity-actions">
                                <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => {
                                  setEditingActivityId(act.id);
                                  setEditActivityForm({ time: act.time || '', description: act.description, details: act.details || '', isAlert: !!act.isAlert });
                                }}>
                                  Edit
                                </button>
                                <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleDeleteActivity(day.id, act.id)}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}

                {/* Add Activity Button / Form */}
                {isEditingEnabled && (
                  <div style={{ marginTop: '20px' }}>
                    {newActivityDayId === day.id ? (
                      <div style={{ padding: '16px', border: '1px dashed var(--accent-color)', borderRadius: '8px' }}>
                        <h4>Add New Activity</h4>
                        <input 
                          type="text" 
                          placeholder="Time (e.g. 10:00 AM)" 
                          className="edit-input"
                          value={newActivityForm.time}
                          onChange={(e) => setNewActivityForm(prev => ({ ...prev, time: e.target.value }))}
                        />
                        <input 
                          type="text" 
                          placeholder="Description" 
                          className="edit-input"
                          value={newActivityForm.description}
                          onChange={(e) => setNewActivityForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                        <textarea 
                          placeholder="Notes / Links / Details" 
                          className="edit-input"
                          rows={2}
                          value={newActivityForm.details}
                          onChange={(e) => setNewActivityForm(prev => ({ ...prev, details: e.target.value }))}
                        />
                        <div style={{ marginBottom: '12px' }}>
                          <input 
                            type="checkbox" 
                            id={`new-alert-${day.id}`}
                            checked={newActivityForm.isAlert}
                            onChange={(e) => setNewActivityForm(prev => ({ ...prev, isAlert: e.target.checked }))}
                            style={{ marginRight: '8px' }}
                          />
                          <label htmlFor={`new-alert-${day.id}`}>Highlight this Event</label>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button className="btn" onClick={() => handleAddActivity(day.id)}>Add</button>
                          <button className="btn btn-secondary" onClick={() => setNewActivityDayId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed' }} onClick={() => setNewActivityDayId(day.id)}>
                        + Add Activity
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        });
      })()}
        </div>
      )}

      {/* 2. LOGISTICS TAB */}
      {activeTab === 'logistics' && (
        <div>
          <div className="grid">
            {trip.logistics.map((card) => (
              <div key={card.id} className="card">
                {editingLogisticsId === card.id ? (
                  <div>
                    <label style={{ fontWeight: 'bold' }}>Title</label>
                    <input 
                      type="text" 
                      className="edit-input" 
                      value={editLogisticsForm.title}
                      onChange={(e) => setEditLogisticsForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                    <label style={{ fontWeight: 'bold' }}>Content (Markdown supported)</label>
                    <textarea 
                      className="edit-input" 
                      rows={10}
                      value={editLogisticsForm.content}
                      onChange={(e) => setEditLogisticsForm(prev => ({ ...prev, content: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn" onClick={() => saveLogisticsEdit(card.id)}>Save</button>
                        <button className="btn btn-secondary" onClick={() => setEditingLogisticsId(null)}>Cancel</button>
                      </div>
                      <button className="btn" style={{ background: '#e02424', borderColor: '#e02424', color: '#fff' }} onClick={() => deleteLogisticsCard(card.id)}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>{card.title}</h3>
                      {isEditingEnabled && (
                        <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => {
                          setEditingLogisticsId(card.id);
                          setEditLogisticsForm({ title: card.title, content: card.content });
                        }}>
                          Edit
                        </button>
                      )}
                    </div>
                    <div 
                      style={{ whiteSpace: 'pre-wrap', color: '#444', lineHeight: '1.5' }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(card.content) }}
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {isEditingEnabled && (
            <div className="card" style={{ maxWidth: '600px', margin: '30px auto 0 auto' }}>
              {showAddLogistics ? (
                <div>
                  <h3 style={{ color: 'var(--primary-color)', marginBottom: '15px' }}>➕ Add Logistics Card</h3>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Flight Details, Hotel Booking" 
                    className="edit-input" 
                    value={newLogisticsForm.title}
                    onChange={(e) => setNewLogisticsForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px', marginTop: '12px' }}>Content (Markdown supported)</label>
                  <textarea 
                    placeholder="Enter booking confirmations, links, phone numbers, etc." 
                    className="edit-input" 
                    rows={6}
                    value={newLogisticsForm.content}
                    onChange={(e) => setNewLogisticsForm(prev => ({ ...prev, content: e.target.value }))}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button className="btn" onClick={addLogisticsCard}>Save Card</button>
                    <button className="btn btn-secondary" onClick={() => setShowAddLogistics(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <button className="btn btn-outline" onClick={() => setShowAddLogistics(true)}>
                    ➕ Add Logistics Card
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. CHECKLIST TAB */}
      {activeTab === 'checklist' && (
        <div className="grid">
          {checklistCategories.map((category) => {
            const items = trip.checklist.filter(item => item.category === category);
            return (
              <div key={category} className="card">
                <h3 style={{ textTransform: 'uppercase', fontSize: '1.1rem', borderBottom: '2px solid var(--accent-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                  {category === 'pre-trip' ? '✅ Pre-Trip To-Do' : category === 'packing' ? '🎒 Packing List' : '📱 Travel Apps'}
                </h3>
                
                <div>
                  {items.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No items in this list.</p>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="checklist-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                          <input 
                            type="checkbox" 
                            className="checkbox-custom" 
                            checked={item.isCompleted} 
                            onChange={() => toggleChecklist(item.id, item.isCompleted)}
                          />
                          {editingChecklistId === item.id ? (
                            <input 
                              type="text"
                              className="edit-input"
                              style={{ margin: 0, padding: '4px 8px', fontSize: '0.9rem', flexGrow: 1 }}
                              value={editChecklistText}
                              onChange={(e) => setEditChecklistText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  editChecklistItem(item.id, editChecklistText);
                                  setEditingChecklistId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingChecklistId(null);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <span className={item.isCompleted ? 'completed-text' : ''}>
                              {item.text}
                            </span>
                          )}
                        </div>
                        {isEditingEnabled && (
                          <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
                            {editingChecklistId === item.id ? (
                              <>
                                <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.8rem' }} onClick={() => {
                                  editChecklistItem(item.id, editChecklistText);
                                  setEditingChecklistId(null);
                                }}>Save</button>
                                <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.8rem' }} onClick={() => setEditingChecklistId(null)}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => {
                                  setEditingChecklistId(item.id);
                                  setEditChecklistText(item.text);
                                }}>✏️</button>
                                <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => deleteChecklistItem(item.id)}>❌</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {isEditingEnabled && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="Add new item..." 
                      className="edit-input"
                      style={{ margin: 0, flexGrow: 1, padding: '6px 10px', fontSize: '0.9rem' }}
                      value={checklistInputs[category] || ''}
                      onChange={(e) => setChecklistInputs(prev => ({ ...prev, [category]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addChecklistItem(category, checklistInputs[category]);
                          setChecklistInputs(prev => ({ ...prev, [category]: '' }));
                        }
                      }}
                    />
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.9rem' }} onClick={() => {
                      addChecklistItem(category, checklistInputs[category]);
                      setChecklistInputs(prev => ({ ...prev, [category]: '' }));
                    }}>Add</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MEALS & GROCERIES TAB */}
      {activeTab === 'meals' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '30px' }}>
          
          {/* Meal Planner */}
          <div className="card">
            <h2 style={{ color: 'var(--primary-color)', borderBottom: '2px solid var(--accent-color)', paddingBottom: '8px', marginBottom: '20px' }}>
              🥣 Day-by-Day Meal Planner
            </h2>
            
            {trip.days.map((day) => {
              const bPlan = trip.meals.find(m => m.dayNumber === day.dayNumber && m.mealType === 'Breakfast') || {};
              const lPlan = trip.meals.find(m => m.dayNumber === day.dayNumber && m.mealType === 'Lunch') || {};
              const dPlan = trip.meals.find(m => m.dayNumber === day.dayNumber && m.mealType === 'Dinner') || {};

              return (
                <div key={day.id} style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                  <h4 style={{ color: 'var(--accent-color)', marginBottom: '8px' }}>{day.dateLabel}</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Breakfast:</span>
                    {isEditingEnabled ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input 
                          type="text" 
                          className="edit-input" 
                          style={{ flexGrow: 2, margin: 0 }}
                          value={bPlan.mealName || ''}
                          onChange={(e) => handleMealChange(day.dayNumber, 'Breakfast', 'mealName', e.target.value)}
                          placeholder="Cereal / Restaurant / etc."
                        />
                        <input 
                          type="text" 
                          className="edit-input" 
                          style={{ width: '110px', margin: 0 }}
                          value={bPlan.time || ''}
                          onChange={(e) => handleMealChange(day.dayNumber, 'Breakfast', 'time', e.target.value)}
                          placeholder="Time (e.g. 8:00 AM)"
                        />
                      </div>
                    ) : (
                      <span>
                        {bPlan.mealName ? (
                          <>
                            {bPlan.mealName} {bPlan.time && <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.85rem' }}>({bPlan.time})</span>}
                          </>
                        ) : (
                          <span style={{ color: '#ccc', fontStyle: 'italic' }}>Not planned</span>
                        )}
                      </span>
                    )}

                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Lunch:</span>
                    {isEditingEnabled ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input 
                          type="text" 
                          className="edit-input" 
                          style={{ flexGrow: 2, margin: 0 }}
                          value={lPlan.mealName || ''}
                          onChange={(e) => handleMealChange(day.dayNumber, 'Lunch', 'mealName', e.target.value)}
                          placeholder="Sandwiches / Out / etc."
                        />
                        <input 
                          type="text" 
                          className="edit-input" 
                          style={{ width: '110px', margin: 0 }}
                          value={lPlan.time || ''}
                          onChange={(e) => handleMealChange(day.dayNumber, 'Lunch', 'time', e.target.value)}
                          placeholder="Time (e.g. 12:30 PM)"
                        />
                      </div>
                    ) : (
                      <span>
                        {lPlan.mealName ? (
                          <>
                            {lPlan.mealName} {lPlan.time && <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.85rem' }}>({lPlan.time})</span>}
                          </>
                        ) : (
                          <span style={{ color: '#ccc', fontStyle: 'italic' }}>Not planned</span>
                        )}
                      </span>
                    )}

                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Dinner:</span>
                    {isEditingEnabled ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input 
                          type="text" 
                          className="edit-input" 
                          style={{ flexGrow: 2, margin: 0 }}
                          value={dPlan.mealName || ''}
                          onChange={(e) => handleMealChange(day.dayNumber, 'Dinner', 'mealName', e.target.value)}
                          placeholder="Tacos / Grill / Out / etc."
                        />
                        <input 
                          type="text" 
                          className="edit-input" 
                          style={{ width: '110px', margin: 0 }}
                          value={dPlan.time || ''}
                          onChange={(e) => handleMealChange(day.dayNumber, 'Dinner', 'time', e.target.value)}
                          placeholder="Time (e.g. 5:30 PM)"
                        />
                      </div>
                    ) : (
                      <span>
                        {dPlan.mealName ? (
                          <>
                            {dPlan.mealName} {dPlan.time && <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.85rem' }}>({dPlan.time})</span>}
                          </>
                        ) : (
                          <span style={{ color: '#ccc', fontStyle: 'italic' }}>Not planned</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grocery List */}
          <div className="card">
            <h2 style={{ color: 'var(--primary-color)', borderBottom: '2px solid var(--accent-color)', paddingBottom: '8px', marginBottom: '20px' }}>
              🛒 Master Grocery Shopping List
            </h2>
            
            {groceryCategories.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No groceries seeded. Add a custom item below!</p>
            ) : (
              groceryCategories.map((category) => {
                const items = trip.groceries.filter(g => g.category === category);
                return (
                  <div key={category} className="grocery-category">
                    <h3 style={{ textTransform: 'capitalize' }}>{category}</h3>
                    {items.map((item) => (
                      <div key={item.id} className="checklist-item">
                        <input 
                          type="checkbox" 
                          className="checkbox-custom" 
                          checked={item.isBought} 
                          onChange={() => toggleGrocery(item.id, item.isBought)}
                        />
                        <span className={item.isBought ? 'completed-text' : ''}>
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })
            )}

            {/* Add Custom Grocery Item */}
            <form onSubmit={handleAddGrocery} style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h4>Add Custom Grocery Item</h4>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Item name (e.g. 2 lbs Ground Beef)" 
                  className="edit-input"
                  style={{ flexGrow: 1, margin: 0 }}
                  value={newGroceryForm.name}
                  onChange={(e) => setNewGroceryForm(prev => ({ ...prev, name: e.target.value }))}
                />
                <select 
                  className="edit-input" 
                  style={{ width: '150px', margin: 0 }}
                  value={newGroceryForm.category}
                  onChange={(e) => setNewGroceryForm(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="General">General</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Packed Lunches">Packed Lunches</option>
                  <option value="Dinners">Dinners</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Essentials">Essentials</option>
                </select>
                <button type="submit" className="btn">Add</button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* LOCK MODAL */}
      {showLockModal && (
        <div className="lock-overlay">
          <div className="lock-modal">
            <h3 style={{ marginBottom: '16px' }}>🔑 Enter Admin Passcode</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Enter the shared passcode to unlock editing and meal planning configurations.
            </p>
            
            <form onSubmit={handleUnlock}>
              <input 
                type="password" 
                className="edit-input" 
                placeholder="Passcode" 
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
              />
              {authError && (
                <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem', margin: '-8px 0 16px 0', fontWeight: 'bold' }}>
                  {authError}
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button type="submit" className="btn">Unlock</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowLockModal(false); setPasscode(''); setAuthError(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
