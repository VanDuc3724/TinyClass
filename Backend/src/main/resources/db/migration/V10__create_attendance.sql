ALTER TABLE class_sessions ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE class_sessions ADD COLUMN completed_by UUID REFERENCES users(id);

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES class_sessions(id),
    student_id UUID NOT NULL REFERENCES students(id),
    enrollment_id UUID NOT NULL REFERENCES class_enrollments(id),
    student_name_snapshot VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(30) NOT NULL DEFAULT 'UNMARKED' CHECK(status IN ('UNMARKED','PRESENT','LATE','ABSENT_EXCUSED','ABSENT_UNEXCUSED')),
    note VARCHAR(1000),
    family_note VARCHAR(1000),
    marked_by UUID REFERENCES users(id),
    marked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(session_id,student_id),
    CHECK((status='UNMARKED' AND marked_at IS NULL AND marked_by IS NULL) OR
          (status<>'UNMARKED' AND marked_at IS NOT NULL AND marked_by IS NOT NULL))
);
CREATE INDEX attendance_student_session ON attendance_records(student_id,session_id);
CREATE TABLE attendance_events (
    id UUID PRIMARY KEY,
    attendance_id UUID NOT NULL REFERENCES attendance_records(id),
    actor_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    status_before VARCHAR(30),
    status_after VARCHAR(30) NOT NULL,
    family_note VARCHAR(1000),
    reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX attendance_events_history ON attendance_events(attendance_id,created_at DESC,id);
