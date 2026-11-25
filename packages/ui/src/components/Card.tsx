import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons or links shown in the card header. */
  actions?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  padding?: 'md' | 'lg';
}

/** Surface for grouping content. With a title it becomes a labelled region. */
export function Card({ title, description, actions, headingLevel = 2, padding = 'md', className, children, ...rest }: CardProps) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      className={cx('tally-card', `tally-card--pad-${padding}`, className)}
      aria-labelledby={title ? headingId : undefined}
      {...rest}
    >
      {(title || actions) && (
        <header className="tally-card__header">
          <div>
            {title && (
              <Heading id={headingId} className="tally-card__title">
                {title}
              </Heading>
            )}
            {description && <p className="tally-card__description">{description}</p>}
          </div>
          {actions && <div className="tally-card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
