import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

type CollapsibleLabSectionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
};

export function CollapsibleLabSection({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
}: CollapsibleLabSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="speed-lab-collapsible">
      <button
        type="button"
        className="speed-lab-collapsible-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="speed-lab-collapsible-title-wrap">
          <ChevronDown
            size={16}
            className={`speed-lab-collapsible-chevron${open ? ' open' : ''}`}
          />
          <span>
            <span className="speed-lab-collapsible-title">{title}</span>
            {subtitle ? <span className="speed-lab-collapsible-sub">{subtitle}</span> : null}
          </span>
        </span>
        {badge}
      </button>
      {open ? <div className="speed-lab-collapsible-body">{children}</div> : null}
    </section>
  );
}
