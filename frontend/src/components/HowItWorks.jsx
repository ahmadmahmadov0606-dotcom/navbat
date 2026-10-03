import { useI18n } from '../lib/i18n';

const STEPS = [
  ['01', 'bg-primary/10 text-primary', 's1', 't1'],
  ['02', 'bg-secondary/10 text-secondary', 's2', 't2'],
  ['03', 'bg-tertiary-container/15 text-primary', 's3', 't3'],
];

export default function HowItWorks() {
  const { t } = useI18n();
  return (
    <section className="max-w-7xl mx-auto px-gutter mb-20 w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STEPS.map(([n, cls, title, text]) => (
          <div key={n} style={{ '--d': `${Number(n) * 90}ms` }} className="reveal ring-gradient spotlight group bg-surface-container-lowest p-8 rounded-3xl shadow-sm hover:shadow-[0_24px_50px_-24px_rgba(59,47,217,0.4)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
            <div className={`w-12 h-12 rounded-2xl ${cls} flex items-center justify-center font-headline-sm text-headline-sm font-bold mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300`}>{n}</div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 font-bold">{t('how.' + title)}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{t('how.' + text)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
