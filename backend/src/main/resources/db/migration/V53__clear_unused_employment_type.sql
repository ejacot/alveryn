UPDATE employments
SET employment_type = NULL
WHERE employment_type IS NOT NULL;
