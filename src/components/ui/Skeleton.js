import styles from './ui.module.css';

export default function Skeleton({ width = '100%', height = 16, className = '' }) {
  return <div aria-hidden="true" className={`${styles.skeleton} ${className}`} style={{ width, height }} />;
}
