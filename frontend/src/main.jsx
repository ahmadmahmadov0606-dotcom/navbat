import './index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { AuthProvider } from './lib/auth';
import { FavoritesProvider } from './lib/favorites';
import { FiltersProvider } from './lib/filters';
import { I18nProvider } from './lib/i18n';
import { ToastProvider } from './lib/toast';
import { registerServiceWorker } from './lib/pwa';
import { startEffects, startReveal } from './lib/reveal';
import { UIProvider } from './lib/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {

      retry: (count, err) => count < 1 && !(err?.status >= 400 && err?.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <FavoritesProvider>
              <UIProvider>
                <FiltersProvider>
                  <App />
                </FiltersProvider>
              </UIProvider>
            </FavoritesProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);

registerServiceWorker();
startReveal();
startEffects();
