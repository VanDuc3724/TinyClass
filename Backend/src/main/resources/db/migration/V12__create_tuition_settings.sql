CREATE TABLE class_tuition_policies (
    id UUID PRIMARY KEY,
    class_id UUID NOT NULL UNIQUE REFERENCES classes(id),
    pricing_mode VARCHAR(20) NOT NULL CHECK(pricing_mode IN ('PER_SESSION','MONTHLY_FIXED','FULL_PROGRAM')),
    collection_timing VARCHAR(20) NOT NULL CHECK(collection_timing IN ('AT_PERIOD_START','AT_PERIOD_END','UPFRONT')),
    session_unit_price_vnd BIGINT CHECK(session_unit_price_vnd BETWEEN 0 AND 1000000000000),
    monthly_amount_vnd BIGINT CHECK(monthly_amount_vnd BETWEEN 0 AND 1000000000000),
    program_total_vnd BIGINT CHECK(program_total_vnd BETWEEN 0 AND 1000000000000),
    program_label VARCHAR(200),
    expected_sessions INT CHECK(expected_sessions BETWEEN 1 AND 10000),
    charge_excused_absence BOOLEAN,
    charge_unexcused_absence BOOLEAN,
    fixed_fee_absence_rule VARCHAR(30) CHECK(fixed_fee_absence_rule IN ('KEEP_AGREED_AMOUNT','MANUAL_ADJUSTMENT')),
    public_terms VARCHAR(5000),
    internal_note VARCHAR(5000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK((pricing_mode='PER_SESSION' AND session_unit_price_vnd IS NOT NULL AND monthly_amount_vnd IS NULL AND program_total_vnd IS NULL AND charge_excused_absence IS NOT NULL AND charge_unexcused_absence IS NOT NULL AND fixed_fee_absence_rule IS NULL AND program_label IS NULL AND expected_sessions IS NULL)
       OR (pricing_mode='MONTHLY_FIXED' AND monthly_amount_vnd IS NOT NULL AND session_unit_price_vnd IS NULL AND program_total_vnd IS NULL AND charge_excused_absence IS NULL AND charge_unexcused_absence IS NULL AND fixed_fee_absence_rule IS NOT NULL AND program_label IS NULL AND expected_sessions IS NULL)
       OR (pricing_mode='FULL_PROGRAM' AND program_total_vnd IS NOT NULL AND session_unit_price_vnd IS NULL AND monthly_amount_vnd IS NULL AND charge_excused_absence IS NULL AND charge_unexcused_absence IS NULL AND fixed_fee_absence_rule IS NOT NULL AND program_label IS NOT NULL AND length(btrim(program_label))>0))
);

CREATE TABLE enrollment_tuition_agreements (
    id UUID PRIMARY KEY,
    enrollment_id UUID NOT NULL REFERENCES class_enrollments(id),
    source_type VARCHAR(10) NOT NULL CHECK(source_type IN ('POLICY','CUSTOM')),
    source_policy_id UUID REFERENCES class_tuition_policies(id),
    source_policy_version BIGINT CHECK(source_policy_version>=0),
    pricing_mode VARCHAR(20) NOT NULL CHECK(pricing_mode IN ('PER_SESSION','MONTHLY_FIXED','FULL_PROGRAM')),
    collection_timing VARCHAR(20) NOT NULL CHECK(collection_timing IN ('AT_PERIOD_START','AT_PERIOD_END','UPFRONT')),
    session_unit_price_vnd BIGINT CHECK(session_unit_price_vnd BETWEEN 0 AND 1000000000000),
    monthly_amount_vnd BIGINT CHECK(monthly_amount_vnd BETWEEN 0 AND 1000000000000),
    program_total_vnd BIGINT CHECK(program_total_vnd BETWEEN 0 AND 1000000000000),
    program_label VARCHAR(200),
    expected_sessions INT CHECK(expected_sessions BETWEEN 1 AND 10000),
    charge_excused_absence BOOLEAN,
    charge_unexcused_absence BOOLEAN,
    fixed_fee_absence_rule VARCHAR(30) CHECK(fixed_fee_absence_rule IN ('KEEP_AGREED_AMOUNT','MANUAL_ADJUSTMENT')),
    public_terms VARCHAR(5000),
    effective_from DATE NOT NULL,
    effective_to DATE,
    status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ENDED','CANCELLED')),
    cancelled_at TIMESTAMPTZ,
    replacement_id UUID REFERENCES enrollment_tuition_agreements(id),
    internal_note VARCHAR(5000),
    change_reason VARCHAR(1000),
    client_request_id UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(enrollment_id,client_request_id),
    CHECK(effective_to IS NULL OR effective_to>=effective_from),
    CHECK(status<>'ENDED' OR effective_to IS NOT NULL),
    CHECK((status='CANCELLED')=(cancelled_at IS NOT NULL)),
    CHECK((source_type='POLICY' AND source_policy_id IS NOT NULL AND source_policy_version IS NOT NULL) OR (source_type='CUSTOM' AND source_policy_id IS NULL AND source_policy_version IS NULL)),
    CHECK((pricing_mode='PER_SESSION' AND session_unit_price_vnd IS NOT NULL AND monthly_amount_vnd IS NULL AND program_total_vnd IS NULL AND charge_excused_absence IS NOT NULL AND charge_unexcused_absence IS NOT NULL AND fixed_fee_absence_rule IS NULL AND program_label IS NULL AND expected_sessions IS NULL)
       OR (pricing_mode='MONTHLY_FIXED' AND monthly_amount_vnd IS NOT NULL AND session_unit_price_vnd IS NULL AND program_total_vnd IS NULL AND charge_excused_absence IS NULL AND charge_unexcused_absence IS NULL AND fixed_fee_absence_rule IS NOT NULL AND program_label IS NULL AND expected_sessions IS NULL)
       OR (pricing_mode='FULL_PROGRAM' AND program_total_vnd IS NOT NULL AND session_unit_price_vnd IS NULL AND monthly_amount_vnd IS NULL AND charge_excused_absence IS NULL AND charge_unexcused_absence IS NULL AND fixed_fee_absence_rule IS NOT NULL AND program_label IS NOT NULL AND length(btrim(program_label))>0))
);
CREATE INDEX tuition_agreements_enrollment_dates ON enrollment_tuition_agreements(enrollment_id,effective_from,effective_to);

