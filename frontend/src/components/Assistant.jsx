import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useUI, useUIState } from '../lib/ui';

const KEY = 'assistant_chat';
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch (_) { return []; } };

export default function Assistant() {
  const i18n = useI18n();
  const { t } = i18n;
  const ui = useUI();
  const { assistant: open } = useUIState();
  const [chat, setChat] = useState(load);
  const [text, setText] = useState('');
  const end = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(chat.slice(-30))); } catch (_) {  }
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat, open]);

  const ask = useMutation({
    mutationFn: (history) => api('/assistant/', {
      method: 'POST',
      body: { messages: history.filter((m) => !m.error).slice(-20).map(({ role, content }) => ({ role, content })) },
    }),
    onSuccess: (d) => setChat((c) => [...c, { role: 'assistant', content: d.reply, providers: d.providers }]),
    onError: (e) => setChat((c) => [...c, { role: 'assistant', error: true, content: e.code === 'network' ? t('toast.network') : e.message }]),
  });

  const send = (value) => {
    const q = (value ?? text).trim();
    if (!q || ask.isPending) return;
    const history = [...chat, { role: 'user', content: q }];
    setChat(history);
    setText('');
    ask.mutate(history);
  };

  return (
    <>
      <button type="button" aria-label={t('ai.open')} aria-expanded={open} onClick={() => ui.toggleAssistant()}
        className="shine hidden xl:flex fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary-container to-primary text-on-primary shadow-[0_10px_30px_rgba(59,47,217,0.45)] items-center justify-center hover:scale-105 transition-all active:scale-95">
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>{open ? 'close' : 'smart_toy'}</span>
      </button>

      {open && (
        <div role="dialog" aria-label={t('ai.title')}
          className="fixed z-[45] inset-x-0 bottom-0 top-16 rounded-t-3xl xl:inset-auto xl:bottom-24 xl:left-6 xl:w-[400px] xl:h-[min(600px,72vh)] xl:rounded-3xl bg-surface-container-lowest shadow-2xl flex flex-col drawer-in pb-safe">
          <div className="p-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">{t('ai.kicker')}</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t('ai.title')}</h3>
            </div>
            <div className="flex items-center gap-2">
            {chat.length > 0 && (
              <button type="button" onClick={() => setChat([])} title={t('ai.clear')} aria-label={t('ai.clear')}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              </button>
            )}
              <button type="button" onClick={() => ui.toggleAssistant(false)} aria-label={t('drawer.close')}
                className="xl:hidden w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-3" aria-live="polite">
            <div className="bg-surface-container-low rounded-2xl rounded-tl-md px-4 py-3 font-body-md text-body-md text-on-surface max-w-[85%]">{t('ai.hello')}</div>
            {!chat.length && (
              <div className="flex flex-wrap gap-2">
                {t('ai.suggestions').map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}
                    className="px-3 py-1.5 rounded-full bg-surface-container font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left">{s}</button>
                ))}
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 font-body-md text-body-md max-w-[85%] whitespace-pre-line ${m.role === 'user'
                  ? 'bg-primary-container text-on-primary rounded-2xl rounded-tr-md'
                  : m.error ? 'bg-error-container text-on-error-container rounded-2xl rounded-tl-md' : 'bg-surface-container-low text-on-surface rounded-2xl rounded-tl-md'}`}>
                  {m.content}
                </div>
                {m.providers?.map((p) => (
                  <div key={p.id} className="w-full bg-surface-container-low rounded-2xl p-3 flex items-center gap-3">
                    <div className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${p.category.gradient} text-on-primary flex items-center justify-center font-label-lg text-label-lg font-bold`}>{p.initials}</div>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => ui.openProvider(p)}>
                      <p className="font-label-lg text-label-lg text-on-surface truncate">{p.name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {p.next_slots[0] ? i18n.slotFull(p.next_slots[0]) : t('providers.noSlots')} · {i18n.money(p.price_from)}
                      </p>
                    </button>
                    <button type="button" onClick={() => ui.openDrawer(p)}
                      className="px-3 py-1.5 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary shrink-0">{t('providers.quickBook')}</button>
                  </div>
                ))}
              </div>
            ))}
            {ask.isPending && (
              <div className="bg-surface-container-low rounded-2xl rounded-tl-md px-4 py-3 w-16 flex gap-1" aria-label={t('ai.thinking')}>
                {[0, 1, 2].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-outline animate-pulse" style={{ animationDelay: `${d * 0.2}s` }} />)}
              </div>
            )}
            <div ref={end} />
          </div>

          <form className="p-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ai.placeholder')} maxLength={1000} aria-label={t('ai.placeholder')}
              className="flex-1 min-w-0 bg-surface-container-low rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface outline-none focus:shadow-[0_0_0_2px_#3B2FD9]" />
            <button type="submit" disabled={!text.trim() || ask.isPending} aria-label={t('ai.send')}
              className="w-12 h-12 shrink-0 rounded-xl bg-primary-container text-on-primary flex items-center justify-center hover:bg-primary transition-all disabled:opacity-50">
              <span className="material-symbols-outlined text-[22px]">send</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
