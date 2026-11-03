CREATE TABLE student_notes (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    class_id UUID REFERENCES classes(id),
    session_id UUID REFERENCES class_sessions(id),
    title VARCHAR(200) NOT NULL DEFAULT 'Nhận xét của cô' CHECK(length(btrim(title))>0),
    body TEXT NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 10000),
    observed_on DATE NOT NULL,
    visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN ('PRIVATE','SHARED')),
    shared_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    client_request_id UUID NOT NULL,
    create_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(teacher_id,client_request_id),
    CHECK(session_id IS NULL OR class_id IS NOT NULL),
    CHECK((visibility='PRIVATE' AND shared_at IS NULL) OR (visibility='SHARED' AND shared_at IS NOT NULL))
);
CREATE INDEX student_notes_timeline ON student_notes(student_id,observed_on DESC,created_at DESC,id);
CREATE INDEX student_notes_family ON student_notes(student_id,observed_on DESC,id) WHERE visibility='SHARED' AND archived_at IS NULL;

ALTER TABLE files ADD COLUMN context_student_note_id UUID REFERENCES student_notes(id);
ALTER TABLE files ADD CONSTRAINT note_asset_context_purpose CHECK(context_student_note_id IS NULL OR purpose='NOTE_ASSET');
CREATE TABLE student_note_attachments (
    student_note_id UUID NOT NULL REFERENCES student_notes(id),
    file_id UUID NOT NULL REFERENCES files(id),
    position INT NOT NULL CHECK(position BETWEEN 0 AND 4),
    PRIMARY KEY(student_note_id,file_id),
    UNIQUE(student_note_id,position),
    UNIQUE(file_id)
);
