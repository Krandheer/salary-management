import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './App';
import { AddEmployeePage } from './features/employees/AddEmployeePage';
import { EditEmployeePage } from './features/employees/EditEmployeePage';
import { EmployeeDetailPage } from './features/employees/EmployeeDetailPage';
import { EmployeeListPage } from './features/employees/EmployeeListPage';

function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">This page is coming soon.</p>
    </div>
  );
}

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/employees" replace /> },
      { path: '/employees', element: <EmployeeListPage /> },
      { path: '/employees/new', element: <AddEmployeePage /> },
      { path: '/employees/:id', element: <EmployeeDetailPage /> },
      { path: '/employees/:id/edit', element: <EditEmployeePage /> },
      { path: '/insights', element: <ComingSoonPage title="Insights" /> },
      { path: '/import-export', element: <ComingSoonPage title="Import / Export" /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}
