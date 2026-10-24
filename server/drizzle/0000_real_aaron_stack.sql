CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`name_key` text NOT NULL,
	`email` text NOT NULL,
	`job_title` text NOT NULL,
	`job_title_key` text NOT NULL,
	`department` text NOT NULL,
	`country_code` text NOT NULL,
	`employment_type` text NOT NULL,
	`hire_date` text NOT NULL,
	`status` text NOT NULL,
	`exit_date` text,
	`created_at` text NOT NULL,
	CONSTRAINT "employees_status_check" CHECK("employees"."status" IN ('active', 'inactive')),
	CONSTRAINT "employees_exit_date_matches_status" CHECK(("employees"."status" = 'inactive') = ("employees"."exit_date" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_employees_active_email` ON `employees` (`email`) WHERE "employees"."status" = 'active';--> statement-breakpoint
CREATE INDEX `ix_employees_status_name` ON `employees` (`status`,`name_key`,`id`);--> statement-breakpoint
CREATE INDEX `ix_employees_email` ON `employees` (`email`);--> statement-breakpoint
CREATE INDEX `ix_employees_status_country` ON `employees` (`status`,`country_code`,`job_title_key`);--> statement-breakpoint
CREATE TABLE `salary_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`effective_date` text NOT NULL,
	`reason` text,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "salary_history_amount_positive" CHECK("salary_history"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `ix_salary_history_employee` ON `salary_history` (`employee_id`,"effective_date" DESC,"id" DESC);