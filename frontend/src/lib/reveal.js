const seen = new WeakSet();

export function startReveal() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  const scan = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
    if (!seen.has(el)) { seen.add(el); io.observe(el); }
  });
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
}

export function startEffects() {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.spotlight');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
