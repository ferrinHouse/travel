'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { useBrowserFlag } from '@/components/auth/useBrowserFlag';
import TripCard from './TripCard';
import { tripTheme } from '@/lib/color';
import { tripPhase } from '@/lib/trip-status';
import { formatDateRange, parseDay, tripLength } from '@/lib/trips/dates';
import { LIMITS, validateTrip } from '@/lib/trips/validation';
import { slugProblem, slugify } from '@/lib/trips/slug';
import { STARTER_CHECKLIST } from '@/lib/trips/checklist-templates';
import styles from './trips.module.css';

const isBrowser = () => true;

const DEFAULT_TAGS =['City', 'Beach', 'Island', 'National Parks', 'Road Trip', 'Cabin', 'Theme Park'];

/**
 * The one form for planning a new trip (`mode="create"`) and changing an
 * existing one (`mode="edit"`). Validation is the same pure function the API
 * uses, so most mistakes are caught before anything is sent.
 *
 * - `initial`: form values (see src/lib/trips/form.js)
 * - `tripId`: the trip being edited (edit mode)
 * - `tags`: trip types already in use, offered as suggestions
 * - `copySources`: [{ id, name, count }] trips whose checklist can be copied (create mode)
 */
export default function TripForm({ mode, initial, tripId, tags = [], copySources = [] }) {
  const creating = mode === 'create';
  const router = useRouter();
  const toast = useToast();
  const hydrated = useBrowserFlag(isBrowser);
  const ids = useId();
  const id = (name) => `${ids}-${name}`;

  const [values, setValues] = useState(initial);
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [checklist, setChecklist] = useState('starter');
  const [copyFrom, setCopyFrom] = useState(copySources[0]?.id ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const next = e.target.value;
    setValues((v) => ({ ...v, [field]: next }));
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => rest);
  };
  const shownSlug = slugEdited ? slug : slugify(values.name);

  const start = parseDay(values.startDate);
  const end = parseDay(values.endDate);
  const length = start && end && end >= start ? tripLength(start, end) : null;

  const draft = {
    id: shownSlug || 'new-trip',
    name: values.name.trim() || 'Your next adventure',
    tag: values.tag.trim() || 'Trip',
    description: values.description.trim(),
    dates: length ? formatDateRange(start, end) : 'Pick your dates',
    startDate: length ? start : null,
    endDate: length ? end : null,
    status: 'upcoming',
    primaryColor: values.primaryColor,
    accentColor: values.accentColor,
  };

  const theme = tripTheme(values);
  const adjusted = theme['--trip-hero'] !== values.primaryColor.toLowerCase();

  const tagOptions = [...new Set([...tags, ...DEFAULT_TAGS])];

  async function submit(e) {
    e.preventDefault();
    const { errors: found } = validateTrip(values);
    if (creating && slugEdited) {
      const problem = slugProblem(slug);
      if (problem) found.slug = problem;
    }
    if (creating && checklist === 'copy' && !copyFrom) found.checklistFrom = 'Pick a trip to copy from.';
    if (Object.keys(found).length) {
      setErrors(found);
      document.getElementById(id(Object.keys(found)[0]))?.focus();
      return;
    }

    setSaving(true);
    try {
      if (creating) {
        const body = {
          ...values,
          slug: slugEdited ? slug : undefined,
          checklistFrom: checklist === 'copy' ? copyFrom : checklist,
        };
        const data = await apiFetch('/api/trips', { method: 'POST', body });
        toast.success(`${values.name.trim()} is ready to plan`);
        router.push(`/trips/${data.trip.id}`);
      } else {
        const data = await apiFetch('/api/trips', { method: 'PATCH', body: { id: tripId, ...values } });
        const { added = 0, removed = 0 } = data.days ?? {};
        const dayNote = added ? ` Added ${plural(added, 'day')}.` : removed ? ` Removed ${plural(removed, 'empty day')}.` : '';
        toast.success(`Saved.${dayNote}`);
        router.push(`/trips/${tripId}`);
        router.refresh();
      }
    } catch (err) {
      setSaving(false);
      const fieldErrors = err.data?.errors ?? (err.data?.blocked ? { endDate: err.message } : null);
      if (fieldErrors) {
        setErrors(fieldErrors);
        document.getElementById(id(Object.keys(fieldErrors)[0]))?.focus();
      }
      toast.error(`Couldn't save the trip: ${err.message}`);
    }
  }

  const fieldProps = (name) => ({
    id: id(name),
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': [errors[name] && id(`${name}-error`), id(`${name}-hint`)].filter(Boolean).join(' ') || undefined,
  });
  const error = (name) =>
    errors[name] ? (
      <p id={id(`${name}-error`)} className="form-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <div className={styles.layout}>
      {hydrated && <div data-hydrated hidden />}
      <aside className={styles.preview} aria-label="Preview">
        <p className={styles.previewLabel}>Preview</p>
        <TripCard trip={draft} status={tripPhase(draft)} preview />
      </aside>

      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={`card ${styles.fieldset}`}>
          <legend className={styles.legend}>The basics</legend>

          <label className="form-label" htmlFor={id('name')}>Trip name</label>
          <input className="edit-input" {...fieldProps('name')} value={values.name} onChange={set('name')} maxLength={LIMITS.name} required autoComplete="off" />
          {error('name')}

          {creating && (
            <>
              <label className="form-label" htmlFor={id('slug')}>Web address</label>
              <div className={styles.slugRow}>
                <span className={styles.slugPrefix} aria-hidden="true">/trips/</span>
                <input
                  className="edit-input"
                  {...fieldProps('slug')}
                  value={shownSlug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(e.target.value.toLowerCase());
                    if (errors.slug) setErrors(({ slug: _gone, ...rest }) => rest);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="lake-week"
                />
              </div>
              {error('slug')}
              <p id={id('slug-hint')} className="field-hint">
                Made from the name. It can&apos;t be changed later, so links keep working.
              </p>
            </>
          )}

          <label className="form-label" htmlFor={id('tag')}>Trip type</label>
          <input className="edit-input" {...fieldProps('tag')} value={values.tag} onChange={set('tag')} list={id('tags')} maxLength={LIMITS.tag} required autoComplete="off" />
          <datalist id={id('tags')}>
            {tagOptions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          {error('tag')}
          <p id={id('tag-hint')} className="field-hint">Shown as a badge, e.g. “Beach” or “National Parks”.</p>

          <label className="form-label" htmlFor={id('travelers')}>Who&apos;s going</label>
          <input className="edit-input" {...fieldProps('travelers')} value={values.travelers} onChange={set('travelers')} maxLength={LIMITS.travelers} required placeholder="Family of 6" />
          {error('travelers')}

          <label className="form-label" htmlFor={id('description')}>
            Description <span className={styles.optional}>(optional)</span>
          </label>
          <textarea className="edit-input" {...fieldProps('description')} value={values.description} onChange={set('description')} maxLength={LIMITS.description} rows={3} />
          {error('description')}
        </fieldset>

        <fieldset className={`card ${styles.fieldset}`}>
          <legend className={styles.legend}>Dates</legend>
          <div className={styles.dateRow}>
            <div>
              <label className="form-label" htmlFor={id('startDate')}>First day</label>
              <input type="date" className="edit-input" {...fieldProps('startDate')} value={values.startDate} onChange={set('startDate')} required />
              {error('startDate')}
            </div>
            <div>
              <label className="form-label" htmlFor={id('endDate')}>Last day</label>
              <input type="date" className="edit-input" {...fieldProps('endDate')} value={values.endDate} onChange={set('endDate')} min={values.startDate || undefined} required />
              {error('endDate')}
            </div>
          </div>
          <p id={id('endDate-hint')} className="field-hint" aria-live="polite">
            {length ? `${plural(length, 'day')}: ${formatDateRange(start, end)}.` : 'One itinerary day is made for each date.'}
            {!creating && ' Changing the dates adds or removes days at the end; days with plans are never removed.'}
          </p>
        </fieldset>

        <fieldset className={`card ${styles.fieldset}`}>
          <legend className={styles.legend}>Colours</legend>
          <div className={styles.colorRow}>
            <div className={styles.color}>
              <input type="color" {...fieldProps('primaryColor')} value={values.primaryColor} onChange={set('primaryColor')} />
              <label htmlFor={id('primaryColor')}>Main colour</label>
            </div>
            <div className={styles.color}>
              <input type="color" {...fieldProps('accentColor')} value={values.accentColor} onChange={set('accentColor')} />
              <label htmlFor={id('accentColor')}>Accent colour</label>
            </div>
          </div>
          {error('primaryColor')}
          {error('accentColor')}
          <p id={id('primaryColor-hint')} className="field-hint" aria-live="polite">
            {adjusted
              ? 'This main colour is a little light for white text, so it’s darkened slightly on the page.'
              : 'Used for the trip’s header and highlights. Text always stays readable.'}
          </p>
        </fieldset>

        {creating && (
          <fieldset className={`card ${styles.fieldset}`}>
            <legend className={styles.legend}>Checklist</legend>
            <div className={styles.choices} role="radiogroup" aria-describedby={errors.checklistFrom ? id('checklistFrom-error') : undefined}>
              <label className={styles.choice}>
                <input type="radio" name={id('checklist')} value="starter" checked={checklist === 'starter'} onChange={() => setChecklist('starter')} />
                <span>
                  <strong>Starter checklist</strong>
                  <span className={styles.choiceHint}>{STARTER_CHECKLIST.length} common to-dos and packing items</span>
                </span>
              </label>
              {copySources.length > 0 && (
                <label className={styles.choice}>
                  <input type="radio" name={id('checklist')} value="copy" checked={checklist === 'copy'} onChange={() => setChecklist('copy')} />
                  <span>
                    <strong>Copy from another trip</strong>
                    <span className={styles.choiceHint}>Items come over unticked</span>
                  </span>
                </label>
              )}
              <label className={styles.choice}>
                <input type="radio" name={id('checklist')} value="none" checked={checklist === 'none'} onChange={() => setChecklist('none')} />
                <span>
                  <strong>Start empty</strong>
                </span>
              </label>
            </div>
            {checklist === 'copy' && (
              <>
                <label className="form-label" htmlFor={id('checklistFrom')}>Copy from</label>
                <select className="edit-input" {...fieldProps('checklistFrom')} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  {copySources.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({plural(t.count, 'item')})
                    </option>
                  ))}
                </select>
              </>
            )}
            {error('checklistFrom')}
          </fieldset>
        )}

        <div className={`form-actions ${styles.actions}`}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : creating ? 'Create trip' : 'Save changes'}
          </button>
          <Link href={creating ? '/' : `/trips/${tripId}`} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
