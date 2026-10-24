CREATE VIEW `current_salaries` AS
SELECT `employee_id`, `amount`, `currency`
FROM (
	SELECT
		`employee_id`,
		`amount`,
		`currency`,
		ROW_NUMBER() OVER (
			PARTITION BY `employee_id`
			ORDER BY `effective_date` DESC, `id` DESC
		) AS `recency_rank`
	FROM `salary_history`
)
WHERE `recency_rank` = 1;
