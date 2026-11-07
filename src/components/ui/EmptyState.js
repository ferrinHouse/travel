import styles from './ui.module.css';

export default function EmptyState({ icon, title, children }) {
  return (
    <div className={styles.empty}>
      {icon && (
        <span className={styles.emptyIcon} aria-hidden="true">
          {icon}
        </span>
      )}
      {title && <p className={styles.emptyTitle}>{title}</p>}
      {children}
    </div>
  );
}
