import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Icon name="help-circle" size={28} />
        </div>
        <h1 className={styles.title}>Page Not Found</h1>
        <p className={styles.description}>
          The page or tactical view you requested does not exist or may have moved.
        </p>
        <div className={styles.actions}>
          <Button href="/dashboard" variant="primary">
            Return to Dashboard
          </Button>
          <Button href="/guide" variant="secondary">
            User Guide
          </Button>
        </div>
      </div>
    </main>
  );
}
