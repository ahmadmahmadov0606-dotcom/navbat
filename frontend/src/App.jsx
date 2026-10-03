import { Suspense, lazy } from 'react';

import Activity from './components/Activity';
import Assistant from './components/Assistant';
import MobileNav from './components/MobileNav';
import AuthPanel from './components/AuthPanel';
import BookingDrawer from './components/BookingDrawer';
import BookingsPanel from './components/BookingsPanel';
import Categories from './components/Categories';
import Footer from './components/Footer';
import Header from './components/Header';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import InfoPanel from './components/InfoPanel';
import { NotificationsPanel } from './components/Notifications';
import ProviderPanel from './components/ProviderPanel';
import Providers from './components/Providers';
import { RowSkeleton } from './components/States';
import { useUIState } from './lib/ui';

const Dashboard = lazy(() => import('./dashboard/Dashboard'));

function Home() {
  return (
    <div className="relative w-full overflow-hidden">
      <Hero />
      <Categories />
      <Activity />
      <Providers />
      <HowItWorks />
    </div>
  );
}

function Modals() {
  const { modal } = useUIState();
  if (!modal) return null;
  const { type, ...props } = modal;
  if (type === 'drawer') return <BookingDrawer key={`${props.provider.id}-${props.reschedule?.id || ''}`} {...props} />;
  if (type === 'auth') return <AuthPanel {...props} />;
  if (type === 'bookings') return <BookingsPanel {...props} />;
  if (type === 'notifications') return <NotificationsPanel />;
  if (type === 'info') return <InfoPanel key={props.page} {...props} />;
  if (type === 'provider') return <ProviderPanel key={props.provider.id} {...props} />;
  return null;
}

export default function App() {
  const { route } = useUIState();
  return (
    <>
      <Header />
      <main className="w-full pt-16 sm:pt-20 bg-surface min-h-[calc(100vh-20rem)]">
        <div className="flex flex-col w-full">
          {route === 'partner' ? (
            <Suspense fallback={<div className="max-w-7xl mx-auto px-gutter pt-10 w-full flex flex-col gap-3"><RowSkeleton /><RowSkeleton /></div>}>
              <Dashboard />
            </Suspense>
          ) : <Home />}
        </div>
        <Modals />
        <Assistant />
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
