import Markdown from '@/components/ui/Markdown';
import { getMealIcon } from '@/lib/helpers';
import styles from '../trip.module.css';

export default function ActivityItem({ activity: act, canEdit, onEdit, onDelete }) {
  return (
    <div className={`activity-item ${act.isAlert ? 'alert-box' : ''} ${styles.activityRow}`}>
      <span className="activity-time">{act.time || 'Flexible'}</span>
      <div className="activity-content">
        <strong className={styles.activityTitle}>
          {act.isMeal && <span aria-hidden="true">{getMealIcon(act.mealType)} </span>}
          <Markdown text={act.description} />
        </strong>
        {act.details && <Markdown as="p" text={act.details} className={styles.activityDetails} />}
        {act.isMeal && <span className={styles.mealNote}>Meal Plan Item (Edit in Meals tab)</span>}
      </div>
      {canEdit && !act.isMeal && (
        <div className="activity-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
