CREATE SEQUENCE invoice_code_sequence START WITH 1;

CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    class_id UUID NOT NULL REFERENCES classes(id),
    enrollment_id UUID NOT NULL REFERENCES class_enrollments(id),
    agreement_id UUID NOT NULL REFERENCES enrollment_tuition_agreements(id),
    invoice_code VARCHAR(50) NOT NULL UNIQUE,
    student_name_snapshot VARCHAR(150) NOT NULL,
    class_name_snapshot VARCHAR(150) NOT NULL,
    pricing_mode VARCHAR(30) NOT NULL CHECK (pricing_mode IN ('PER_SESSION','MONTHLY_FIXED','FULL_PROGRAM')),
    terms_snapshot JSONB NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL CHECK (period_end >= period_start),
    due_on DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ISSUED','CANCELLED')),
    total_amount_vnd BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_vnd BETWEEN 0 AND 1000000000000),
    public_note VARCHAR(5000),
    internal_note VARCHAR(5000),
    adjustment_reason VARCHAR(1000),
    review_key VARCHAR(64) NOT NULL,
    client_request_id UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (teacher_id, client_request_id),
    CHECK (due_on IS NULL OR due_on >= period_end),
    CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
    CHECK (status <> 'ISSUED' OR issued_at IS NOT NULL)
);
CREATE INDEX invoices_teacher_recent ON invoices(teacher_id,created_at DESC,id DESC);
CREATE INDEX invoices_enrollment_period ON invoices(enrollment_id,period_start,period_end) WHERE status <> 'CANCELLED';
CREATE INDEX invoices_family ON invoices(student_id,issued_at DESC,id DESC) WHERE issued_at IS NOT NULL;

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
    is_active BOOLEAN NOT NULL DEFAULT true,
    description VARCHAR(300) NOT NULL,
    pricing_basis VARCHAR(30) NOT NULL CHECK (pricing_basis IN ('PER_SESSION','MONTHLY_FIXED','FULL_PROGRAM','OTHER')),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
    unit_price_vnd BIGINT NOT NULL CHECK (unit_price_vnd BETWEEN 0 AND 1000000000000),
    discount_vnd BIGINT NOT NULL CHECK (discount_vnd BETWEEN 0 AND 1000000000000),
    amount_vnd BIGINT NOT NULL CHECK (amount_vnd BETWEEN 0 AND 1000000000000),
    attendance_id UUID REFERENCES attendance_records(id),
    source_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (amount_vnd = quantity::BIGINT * unit_price_vnd - discount_vnd),
    CHECK ((pricing_basis = 'PER_SESSION') = (attendance_id IS NOT NULL))
);
CREATE UNIQUE INDEX invoice_lines_position ON invoice_lines(invoice_id,position) WHERE is_active;

CREATE TABLE session_charge_entries (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
    agreement_id UUID NOT NULL REFERENCES enrollment_tuition_agreements(id),
    root_attendance_id UUID NOT NULL REFERENCES attendance_records(id),
    counted_attendance_id UUID NOT NULL REFERENCES attendance_records(id),
    unit_price_vnd_snapshot BIGINT NOT NULL CHECK (unit_price_vnd_snapshot BETWEEN 0 AND 1000000000000),
    status VARCHAR(20) NOT NULL CHECK (status IN ('RESERVED','CHARGED','VOIDED')),
    void_reason VARCHAR(1000),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (root_attendance_id = counted_attendance_id),
    CHECK ((status = 'VOIDED') = (voided_at IS NOT NULL))
);
CREATE UNIQUE INDEX session_charge_once ON session_charge_entries(root_attendance_id) WHERE status IN ('RESERVED','CHARGED');
CREATE INDEX session_charge_invoice ON session_charge_entries(invoice_id);
