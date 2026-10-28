/**
 * A page with no skeleton of its own. It draws nothing: the marker keeps the
 * top bar's white loading bar running until the page arrives, the same bar
 * every other skeleton shows.
 */
export default function Loading() {
  return <div data-route-skeleton aria-busy="true" aria-label="Loading" />;
}
