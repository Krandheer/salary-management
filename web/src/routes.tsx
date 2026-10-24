import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './App';
import { AddEmployeePage } from './features/employees/AddEmployeePage';
import { EditEmployeePage } from './features/employees/EditEmployeePage';
import { EmployeeDetailPage } from './features/employees/EmployeeDetailPage';
import { EmployeeListPage } from './features/employees/EmployeeListPage';
import { InsightsPage } from './features/insights/InsightsPage';
import { ImportExportPage } from './features/spreadsheet/ImportExportPage';

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/employees" replace /> },
      { path: '/employees', element: <EmployeeListPage /> },
      { path: '/employees/new', element: <AddEmployeePage /> },
      { path: '/employees/:id', element: <EmployeeDetailPage /> },
      { path: '/employees/:id/edit', element: <EditEmployeePage /> },
      { path: '/insights', element: <InsightsPage /> },
      { path: '/import-export', element: <ImportExportPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}
