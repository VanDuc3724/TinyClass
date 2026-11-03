-- Remove the former due-date/period coupling and explicitly retain period ordering.
ALTER TABLE invoices DROP CONSTRAINT invoices_check1;
ALTER TABLE invoices ADD CONSTRAINT invoices_period_order CHECK (period_end >= period_start);
