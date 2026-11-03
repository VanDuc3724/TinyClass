ALTER TABLE student_progress DROP CONSTRAINT student_progress_status_check;
ALTER TABLE student_progress ADD CONSTRAINT student_progress_status_check CHECK(status IN('OPENED','SUBMITTED','NEEDS_REVISION','COMPLETED'));
ALTER TABLE student_progress ADD COLUMN review_cycle INT NOT NULL DEFAULT 0 CHECK(review_cycle>=0);
ALTER TABLE student_progress ADD COLUMN teacher_accepted_at TIMESTAMPTZ;
ALTER TABLE student_progress ADD COLUMN reopened_at TIMESTAMPTZ;

CREATE TABLE submissions (
    id UUID PRIMARY KEY,
    assignment_item_id UUID NOT NULL REFERENCES assignment_items(id),
    student_id UUID NOT NULL REFERENCES students(id),
    attempt_number INT NOT NULL CHECK(attempt_number>0),
    review_cycle INT NOT NULL CHECK(review_cycle>=0),
    submitted_by UUID NOT NULL REFERENCES users(id),
    text_response TEXT CHECK(length(text_response)<=5000),
    status VARCHAR(30) NOT NULL CHECK(status IN('DRAFT','SUBMITTED','ACCEPTED','CHANGES_REQUESTED')),
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    feedback_text TEXT CHECK(length(feedback_text)<=5000),
    feedback_audio_file_id UUID REFERENCES files(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(assignment_item_id,student_id,attempt_number),
    CHECK((status='DRAFT' AND submitted_at IS NULL) OR (status<>'DRAFT' AND submitted_at IS NOT NULL)),
    CHECK(status NOT IN('ACCEPTED','CHANGES_REQUESTED') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX submissions_one_pending ON submissions(assignment_item_id,student_id) WHERE status='SUBMITTED';
CREATE UNIQUE INDEX submissions_one_author_draft ON submissions(assignment_item_id,student_id,submitted_by,review_cycle) WHERE status='DRAFT';
CREATE INDEX submissions_review_queue ON submissions(status,submitted_at DESC,id);
CREATE TABLE submission_attachments (
    submission_id UUID NOT NULL REFERENCES submissions(id),
    file_id UUID NOT NULL REFERENCES files(id),
    position INT NOT NULL CHECK(position BETWEEN 0 AND 4),
    PRIMARY KEY(submission_id,file_id), UNIQUE(submission_id,position)
);
CREATE TABLE submission_events (
    id UUID PRIMARY KEY,
    assignment_item_id UUID NOT NULL REFERENCES assignment_items(id),
    student_id UUID NOT NULL REFERENCES students(id),
    submission_id UUID REFERENCES submissions(id),
    actor_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL CHECK(event_type IN('SUBMITTED','ACCEPTED','CHANGES_REQUESTED','REOPENED')),
    review_cycle INT NOT NULL CHECK(review_cycle>=0),
    reason TEXT,
    before_state JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX submission_events_history ON submission_events(assignment_item_id,student_id,created_at DESC);
ALTER TABLE files ADD CONSTRAINT submission_file_context_required CHECK(purpose<>'SUBMISSION_ASSET' OR (context_student_id IS NOT NULL AND context_assignment_item_id IS NOT NULL));
