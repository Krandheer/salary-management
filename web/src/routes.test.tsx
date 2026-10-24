import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestJson } from '@/api/http';
import { appRoutes } from './routes';

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  requestJson: vi.fn(),
}));

function renderApp(route: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.mocked(requestJson).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
});

describe('app routes', () => {
  it('redirects the root path to the employees page', async () => {
    const router = renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Employees' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/employees');
  });

  it('offers the three primary navigation links and marks the current page', async () => {
    renderApp('/employees');

    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(nav).toHaveTextContent('Employees');
    expect(nav).toHaveTextContent('Insights');
    expect(nav).toHaveTextContent('Import / Export');
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Insights' })).not.toHaveAttribute('aria-current');
  });

  it('puts a skip-to-content link first in the tab order', async () => {
    renderApp('/employees');

    const skipLink = await screen.findByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(document.getElementById('main-content')).toBeInTheDocument();
  });
});
