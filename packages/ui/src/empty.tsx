import React from 'react';
import { cardBase, mutedText } from './styles.js';

function EmptyMessage({ message }: { message: string }) {
  return <p style={mutedText}>{message}</p>;
}

const EmptyCard = React.forwardRef<
  HTMLDivElement,
  { message: string } & React.HTMLAttributes<HTMLDivElement>
>(({ message, className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    style={{ ...cardBase, ...style }}
    {...props}
  >
    <EmptyMessage message={message} />
  </div>
));
EmptyCard.displayName = 'EmptyCard';

export { EmptyCard, EmptyMessage };
