import { DiagramView } from '@/components/walkthrough/TimingDiagrams';
import { FIRST_LOOK } from '@/lib/walkthroughs/chapters';
import styles from './FirstLook.module.css';

/** The front page's cards: each part of the game as a picture and a sentence or two. */
export default function FirstLook() {
  return (
    <div className={styles.grid}>
      {FIRST_LOOK.map((card) => (
        <article className={styles.card} key={card.title}>
          <h3 className={styles.title}>{card.title}</h3>
          <div className={styles.picture}>{card.diagram && <DiagramView diagram={card.diagram} />}</div>
          <p className={styles.body}>{card.body}</p>
        </article>
      ))}
    </div>
  );
}
