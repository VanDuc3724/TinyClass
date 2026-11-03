CREATE TABLE class_announcements (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    class_id UUID NOT NULL REFERENCES classes(id),
    title VARCHAR(200) NOT NULL CHECK (length(btrim(title)) > 0),
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    publication_revision BIGINT NOT NULL DEFAULT 0 CHECK (publication_revision >= 0),
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    client_request_id UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(teacher_id,client_request_id),
    CHECK ((published_at IS NULL AND publication_revision=0) OR (published_at IS NOT NULL AND publication_revision>0)),
    CHECK ((status='DRAFT' AND published_at IS NULL AND archived_at IS NULL) OR
           (status='PUBLISHED' AND published_at IS NOT NULL AND archived_at IS NULL) OR
           (status='ARCHIVED' AND archived_at IS NOT NULL))
);
CREATE INDEX announcements_class_status ON class_announcements(class_id,status,published_at DESC,id DESC);
CREATE TABLE announcement_reads (
    announcement_id UUID NOT NULL REFERENCES class_announcements(id),
    user_id UUID NOT NULL REFERENCES users(id),
    publication_revision BIGINT NOT NULL CHECK (publication_revision > 0),
    read_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(announcement_id,user_id)
);
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    recipient_user_id UUID NOT NULL REFERENCES users(id),
    teacher_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(40) NOT NULL CHECK (type IN ('ANNOUNCEMENT_PUBLISHED','ANNOUNCEMENT_UPDATED','ASSIGNMENT_PUBLISHED','SUBMISSION_SENT','SUBMISSION_REVIEWED','SESSION_CHANGED','SESSION_CANCELLED','INVOICE_ISSUED','PAYMENT_RECORDED','PAYMENT_VOIDED')),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('ANNOUNCEMENT','ASSIGNMENT','SUBMISSION','SESSION','INVOICE','PAYMENT')),
    source_id UUID NOT NULL,
    related_student_id UUID NOT NULL REFERENCES students(id),
    related_class_id UUID REFERENCES classes(id),
    dedupe_key VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    read_at TIMESTAMPTZ,
    UNIQUE(recipient_user_id,dedupe_key)
);
CREATE INDEX notifications_recipient_page ON notifications(recipient_user_id,created_at DESC,id DESC);
CREATE INDEX notifications_unread ON notifications(recipient_user_id) WHERE read_at IS NULL;
