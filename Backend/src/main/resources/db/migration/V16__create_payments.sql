CREATE TABLE payments (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    amount_vnd BIGINT NOT NULL CONSTRAINT payments_amount_range CHECK (amount_vnd BETWEEN 1 AND 1000000000000),
    method VARCHAR(30) NOT NULL CONSTRAINT payments_method_values CHECK (method IN ('CASH','BANK_TRANSFER','OTHER')),
    paid_at TIMESTAMPTZ NOT NULL,
    recorded_by UUID NOT NULL REFERENCES users(id),
    public_note VARCHAR(1000),
    internal_note VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'RECORDED' CONSTRAINT payments_status_values CHECK (status IN ('RECORDED','VOIDED')),
    idempotency_key VARCHAR(100) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id),
    void_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT payments_request_once UNIQUE(recorded_by,idempotency_key),
    CONSTRAINT payments_paid_date_range CHECK ((paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'),
    CONSTRAINT payments_void_state CHECK (
        (status='RECORDED' AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR
        (status='VOIDED' AND voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND length(btrim(void_reason))>0)
    )
);
CREATE INDEX payments_invoice_history ON payments(invoice_id,paid_at DESC,created_at DESC,id DESC);
CREATE INDEX payments_recorded_total ON payments(invoice_id) INCLUDE(amount_vnd) WHERE status='RECORDED';
