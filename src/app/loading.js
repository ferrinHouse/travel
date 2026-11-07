import Skeleton from '@/components/ui/Skeleton';
import styles from './status.module.css';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={styles.loadingHeader} />
      <main className="container">
        <div className="grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`card ${styles.skeletonStack}`}>
              <Skeleton width="60%" height={24} />
              <Skeleton width="40%" />
              <Skeleton height={48} />
              <Skeleton height={40} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
