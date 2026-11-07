import Skeleton from '@/components/ui/Skeleton';
import styles from '../../status.module.css';

export default function TripLoading() {
  return (
    <div aria-busy="true" aria-label="Loading trip">
      <div className={styles.loadingHeader} />
      <main className="container">
        <div className="tabs">
          <Skeleton height={44} />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className={`card ${styles.skeletonStack} ${styles.skeletonCard}`}>
            <Skeleton width="50%" height={26} />
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Skeleton width="80%" height={20} />
          </div>
        ))}
      </main>
    </div>
  );
}
