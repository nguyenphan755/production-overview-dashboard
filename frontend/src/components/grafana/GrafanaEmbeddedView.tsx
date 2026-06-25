import { useEffect, useRef } from 'react';

type GrafanaEmbeddedViewProps = {
  src: string;
  title: string;
  className?: string;
};

/** Full-width Grafana dashboard iframe (kiosk, dark theme). */
export function GrafanaEmbeddedView({ src, title, className = '' }: GrafanaEmbeddedViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = src;
    }
  }, [src]);

  return (
    <div
      className={`grafana-embed flex-1 min-h-0 rounded-xl overflow-hidden border border-cyan-500/20 bg-[#0b1220] shadow-[0_0_24px_rgba(34,211,238,0.08)] ${className}`}
    >
      <iframe
        ref={iframeRef}
        title={title}
        src={src}
        className="w-full h-full min-h-[calc(100vh-14rem)] border-0"
        allow="fullscreen"
        loading="lazy"
      />
    </div>
  );
}
