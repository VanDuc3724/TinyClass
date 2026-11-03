-- A payment due date is independent of the service period, including upfront collection.
ALTER TABLE invoices DROP CONSTRAINT invoices_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_due_date_bounds
    CHECK (due_on IS NULL OR due_on BETWEEN DATE '1900-01-01' AND DATE '2200-12-31');
