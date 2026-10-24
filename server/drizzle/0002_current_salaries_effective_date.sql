-- The view also exposes the current entry's effective date, so an edit can tell
-- whether a dated change would become current. The current-salary rule is unchanged.
DROP VIEW `current_salaries`;
--> statement-breakpoint
CREATE VIEW `current_salaries` AS
SELECT `employee_id`, `amount`, `currency`, `effective_date`
FROM (
	SELECT
		`employee_id`,
		`amount`,
		`currency`,
		`effective_date`,
		ROW_NUMBER() OVER (
			PARTITION BY `employee_id`
			ORDER BY `effective_date` DESC, `id` DESC
		) AS `recency_rank`
	FROM `salary_history`
)
WHERE `recency_rank` = 1;
