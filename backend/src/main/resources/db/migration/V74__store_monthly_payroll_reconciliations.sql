CREATE TABLE payroll_reconciliations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
  payroll_year INTEGER NOT NULL,
  payroll_month INTEGER NOT NULL,
  filename VARCHAR(255),
  status VARCHAR(30) NOT NULL,
  app_worked_hours NUMERIC(12,2),
  app_absence_hours NUMERIC(12,2),
  app_extra_hours NUMERIC(12,2),
  app_gross NUMERIC(14,2),
  payroll_worked_hours NUMERIC(12,2),
  payroll_absence_hours NUMERIC(12,2),
  payroll_extra_hours NUMERIC(12,2),
  payroll_gross NUMERIC(14,2),
  payroll_lines_json TEXT NOT NULL,
  notes VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_payroll_reconciliation_employment_period
    UNIQUE (employment_id, payroll_year, payroll_month)
);
