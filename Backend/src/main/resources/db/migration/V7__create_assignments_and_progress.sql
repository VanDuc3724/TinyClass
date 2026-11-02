CREATE TABLE assignments (
    id UUID PRIMARY KEY, teacher_id UUID NOT NULL REFERENCES users(id), title VARCHAR(200) NOT NULL,
    source_type VARCHAR(10) NOT NULL CHECK(source_type IN('LESSON','COURSE')), lesson_id UUID REFERENCES lessons(id), course_id UUID REFERENCES courses(id),
    target_type VARCHAR(10) NOT NULL CHECK(target_type IN('CLASS','STUDENT')), class_id UUID REFERENCES classes(id), student_id UUID REFERENCES students(id),
    available_at TIMESTAMPTZ, due_at TIMESTAMPTZ, status VARCHAR(20) NOT NULL CHECK(status IN('DRAFT','PUBLISHED','REVOKED')),
    published_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, revoke_reason TEXT, client_request_id UUID NOT NULL, request_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(teacher_id,client_request_id),
    CHECK((source_type='LESSON' AND lesson_id IS NOT NULL AND course_id IS NULL) OR (source_type='COURSE' AND course_id IS NOT NULL AND lesson_id IS NULL)),
    CHECK((target_type='CLASS' AND class_id IS NOT NULL AND student_id IS NULL) OR (target_type='STUDENT' AND student_id IS NOT NULL AND class_id IS NULL)),
    CHECK(due_at IS NULL OR available_at IS NULL OR due_at>=available_at)
);
CREATE INDEX assignments_owner_status ON assignments(teacher_id,status,created_at DESC);
CREATE TABLE assignment_items (
    id UUID PRIMARY KEY, assignment_id UUID NOT NULL REFERENCES assignments(id), lesson_id UUID NOT NULL REFERENCES lessons(id),
    position INT NOT NULL CHECK(position>=0), is_required BOOLEAN NOT NULL,
    completion_mode VARCHAR(30) NOT NULL CHECK(completion_mode IN('REFERENCE','PARENT_CONFIRM','TEACHER_REVIEW')),
    allowed_response_types JSONB NOT NULL DEFAULT '[]',
    UNIQUE(assignment_id,lesson_id), UNIQUE(assignment_id,position) DEFERRABLE INITIALLY DEFERRED,
    CHECK(completion_mode<>'REFERENCE' OR NOT is_required)
);
ALTER TABLE files ADD CONSTRAINT files_assignment_item_fk FOREIGN KEY(context_assignment_item_id) REFERENCES assignment_items(id);
CREATE TABLE assignment_recipients (
    id UUID PRIMARY KEY, assignment_id UUID NOT NULL REFERENCES assignments(id), student_id UUID NOT NULL REFERENCES students(id),
    source_enrollment_id UUID REFERENCES class_enrollments(id), granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ, revoke_reason TEXT, UNIQUE(assignment_id,student_id)
);
CREATE INDEX assignment_recipients_child ON assignment_recipients(student_id,revoked_at);
CREATE TABLE student_progress (
    id UUID PRIMARY KEY, assignment_item_id UUID NOT NULL REFERENCES assignment_items(id), student_id UUID NOT NULL REFERENCES students(id),
    status VARCHAR(20) NOT NULL CHECK(status IN('OPENED','COMPLETED')), first_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    parent_confirmed_at TIMESTAMPTZ, confirmed_by UUID REFERENCES users(id), completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(assignment_item_id,student_id)
);
