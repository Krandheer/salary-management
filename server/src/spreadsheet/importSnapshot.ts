import type { StoredEmployee } from '../employees/employeeReadModels.ts';
import type { ExistingEmployee, ImportMatch, ImportSnapshot } from './importClassifier.ts';

/** Most recent exit first; on the same exit date, the later record (higher id) first. */
function byMostRecentExit(a: StoredEmployee, b: StoredEmployee): number {
  const exitOrder = (b.exitDate ?? '').localeCompare(a.exitDate ?? '');
  return exitOrder !== 0 ? exitOrder : b.id - a.id;
}

function toExisting(stored: StoredEmployee): ExistingEmployee {
  return {
    id: stored.id,
    fields: stored.fields,
    currentCurrency: stored.currentCurrency,
    earliestSalaryDate: stored.earliestSalaryDate,
    exitDate: stored.exitDate,
  };
}

/** Groups the stored employees by email: the active record, and every inactive one, latest exit first. */
export function buildImportSnapshot(stored: readonly StoredEmployee[]): ImportSnapshot {
  const snapshot: ImportSnapshot = new Map();
  for (const employee of [...stored].sort(byMostRecentExit)) {
    const email = employee.fields.email;
    const match: ImportMatch = snapshot.get(email) ?? { active: null, inactive: [] };
    if (employee.status === 'active') match.active = toExisting(employee);
    else match.inactive.push(toExisting(employee));
    snapshot.set(email, match);
  }
  return snapshot;
}
