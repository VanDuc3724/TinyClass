CREATE TABLE class_schedule_rules (
    id UUID PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES classes(id),
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK (timezone='Asia/Ho_Chi_Minh'),
    effective_from DATE NOT NULL,
    effective_to DATE,
    location VARCHAR(300),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(id,class_id),
    CHECK (end_time>start_time AND end_time-start_time<=interval '12 hours'),
    CHECK (effective_to IS NULL OR effective_to>=effective_from)
);
CREATE INDEX schedule_rules_class ON class_schedule_rules(class_id,weekday,start_time);

CREATE TABLE class_sessions (
    id UUID PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES classes(id),
    schedule_rule_id UUID,
    occurrence_week DATE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    title VARCHAR(200) NOT NULL,
    location VARCHAR(300),
    lesson_plan TEXT CHECK (length(lesson_plan)<=5000),
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED')),
    is_manual_override BOOLEAN NOT NULL DEFAULT false,
    roster_created_at TIMESTAMPTZ,
    cancellation_reason VARCHAR(1000),
    cancelled_at TIMESTAMPTZ,
    client_request_id UUID,
    request_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (ends_at>starts_at AND ends_at-starts_at<=interval '12 hours'),
    CHECK ((schedule_rule_id IS NULL AND occurrence_week IS NULL) OR
           (schedule_rule_id IS NOT NULL AND occurrence_week IS NOT NULL AND extract(isodow from occurrence_week)=1)),
    CHECK ((status IN ('SCHEDULED','COMPLETED') AND cancelled_at IS NULL AND cancellation_reason IS NULL) OR
           (status='CANCELLED' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND length(btrim(cancellation_reason))>0)),
    UNIQUE(class_id,client_request_id),
    FOREIGN KEY(schedule_rule_id,class_id) REFERENCES class_schedule_rules(id,class_id)
);
CREATE UNIQUE INDEX sessions_rule_week ON class_sessions(schedule_rule_id,occurrence_week) WHERE schedule_rule_id IS NOT NULL;
CREATE INDEX sessions_class_start ON class_sessions(class_id,starts_at,id);
CREATE INDEX sessions_calendar ON class_sessions(starts_at,ends_at) WHERE status='SCHEDULED';
