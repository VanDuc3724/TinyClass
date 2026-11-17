CREATE TABLE learning_games (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('CHOICE','MATCH','MEMORY')),
    instructions VARCHAR(2000),
    min_age_months INTEGER NOT NULL DEFAULT 36 CHECK (min_age_months BETWEEN 0 AND 216),
    max_age_months INTEGER NOT NULL DEFAULT 72 CHECK (max_age_months BETWEEN 0 AND 216),
    content JSONB NOT NULL CHECK (jsonb_typeof(content)='object'),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    archived_from VARCHAR(20) CHECK (archived_from IN ('DRAFT','PUBLISHED')),
    content_revision INTEGER NOT NULL DEFAULT 1 CHECK (content_revision > 0),
    client_request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (teacher_id,client_request_id),
    CHECK (min_age_months <= max_age_months),
    CHECK ((status='ARCHIVED')=(archived_from IS NOT NULL))
);
CREATE INDEX learning_games_owner_status ON learning_games(teacher_id,status,updated_at DESC,id);

CREATE TABLE game_assignments (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    game_id UUID NOT NULL REFERENCES learning_games(id),
    title VARCHAR(200) NOT NULL,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('CLASS','STUDENT')),
    class_id UUID REFERENCES classes(id),
    student_id UUID REFERENCES students(id),
    linked_lesson_id UUID REFERENCES lessons(id),
    linked_course_id UUID REFERENCES courses(id),
    snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
    available_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
    revoke_reason VARCHAR(1000),
    client_request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (teacher_id,client_request_id),
    CHECK ((target_type='CLASS' AND class_id IS NOT NULL AND student_id IS NULL) OR
           (target_type='STUDENT' AND student_id IS NOT NULL AND class_id IS NULL)),
    CHECK (linked_lesson_id IS NULL OR linked_course_id IS NULL),
    CHECK (due_at IS NULL OR due_at>=available_at)
);
CREATE INDEX game_assignments_owner ON game_assignments(teacher_id,created_at DESC,id);
CREATE INDEX game_assignments_class ON game_assignments(class_id,status);

CREATE TABLE game_recipients (
    game_assignment_id UUID NOT NULL REFERENCES game_assignments(id),
    student_id UUID NOT NULL REFERENCES students(id),
    source_enrollment_id UUID REFERENCES class_enrollments(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(1000),
    PRIMARY KEY (game_assignment_id,student_id)
);
CREATE INDEX game_recipients_child ON game_recipients(student_id,game_assignment_id) WHERE revoked_at IS NULL;
CREATE INDEX game_recipients_enrollment ON game_recipients(source_enrollment_id) WHERE revoked_at IS NULL;

CREATE TABLE game_attempts (
    id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES learning_games(id),
    game_assignment_id UUID REFERENCES game_assignments(id),
    student_id UUID REFERENCES students(id),
    created_by UUID NOT NULL REFERENCES users(id),
    is_preview BOOLEAN NOT NULL,
    snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
    state JSONB NOT NULL CHECK (jsonb_typeof(state)='object'),
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','COMPLETED','ABANDONED')),
    total_steps INTEGER NOT NULL CHECK (total_steps BETWEEN 1 AND 12),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count>=0 AND correct_count<=total_steps),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count>=0),
    move_count INTEGER NOT NULL DEFAULT 0 CHECK (move_count BETWEEN 0 AND 1000),
    hint_count INTEGER NOT NULL DEFAULT 0 CHECK (hint_count>=0),
    stars INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    client_request_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (created_by,client_request_id),
    CHECK ((is_preview AND game_assignment_id IS NULL AND student_id IS NULL) OR
           (NOT is_preview AND game_assignment_id IS NOT NULL AND student_id IS NOT NULL)),
    CHECK ((status='COMPLETED')=(completed_at IS NOT NULL)),
    CHECK ((status='COMPLETED' AND stars>0 AND correct_count=total_steps) OR (status<>'COMPLETED' AND stars=0))
);
CREATE UNIQUE INDEX game_attempts_one_active ON game_attempts(created_by,game_assignment_id,student_id)
    WHERE NOT is_preview AND status='IN_PROGRESS';
CREATE INDEX game_attempts_results ON game_attempts(game_assignment_id,student_id,started_at DESC,id) WHERE NOT is_preview;
CREATE INDEX game_attempts_collection ON game_attempts(student_id,game_assignment_id,stars) WHERE status='COMPLETED' AND NOT is_preview;

CREATE TABLE game_moves (
    attempt_id UUID NOT NULL REFERENCES game_attempts(id),
    client_request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL,
    result_version BIGINT NOT NULL,
    result JSONB NOT NULL,
    PRIMARY KEY (attempt_id,client_request_id)
);

CREATE TABLE game_attempt_starts (
    created_by UUID NOT NULL REFERENCES users(id),
    client_request_id UUID NOT NULL,
    attempt_id UUID NOT NULL REFERENCES game_attempts(id),
    request_hash CHAR(64) NOT NULL,
    PRIMARY KEY (created_by,client_request_id)
);
