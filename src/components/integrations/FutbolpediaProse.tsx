import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './FutbolpediaProse.module.css';

/**
 * Futbolpedia's replies are Markdown (lists, bold, italics, the odd table). Rendered with the
 * same react-markdown and remark-gfm the guide uses; raw HTML is skipped, and links open in a new
 * tab since they lead out of Gaffa.
 */
export default function FutbolpediaProse({ text }: { text: string }) {
  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
