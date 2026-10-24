/** The employee validation API other modules use; the rules themselves live in the files re-exported here. */
export type { EmployeeFields } from './employeeFields.ts';
export { validateEmployeeFields, type EmployeeValidation } from './newEmployeeRules.ts';
export { validateEmployeeUpdate, type EmployeeUpdateValidation } from './employeeUpdateRules.ts';
export type { ValidSalaryChange } from './salaryChangeRules.ts';
export {
  validateExitDate,
  validateHireDateAgainstHistory,
  validateRehireHireDate,
} from './fieldRules.ts';
