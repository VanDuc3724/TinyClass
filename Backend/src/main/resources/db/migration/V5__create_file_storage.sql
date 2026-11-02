CREATE TABLE storage_connections (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('LOCAL','GOOGLE_DRIVE')),
    display_name VARCHAR(100) NOT NULL,
    root_reference VARCHAR(500) NOT NULL,
    google_account_email VARCHAR(254),
    refresh_token_ciphertext TEXT,
    token_key_version VARCHAR(100),
    granted_scopes JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL CHECK (status IN ('CONNECTED','DISCONNECTED','ERROR')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX storage_default_teacher ON storage_connections(teacher_id) WHERE is_default;
CREATE UNIQUE INDEX local_storage_teacher ON storage_connections(teacher_id) WHERE provider = 'LOCAL';
CREATE TABLE files (
    id UUID PRIMARY KEY,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    storage_connection_id UUID NOT NULL REFERENCES storage_connections(id),
    purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('LESSON_ASSET','SUBMISSION_ASSET','PROFILE_ASSET','NOTE_ASSET','REVIEW_ASSET')),
    learner_download_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    context_student_id UUID REFERENCES students(id),
    context_assignment_item_id UUID,
    storage_key VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('UPLOADING','READY','FAILED','DELETED')),
    checksum_sha256 VARCHAR(64),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (storage_connection_id, storage_key)
);
CREATE INDEX files_owner_status ON files(uploaded_by,status,created_at DESC);
ALTER TABLE classes ADD COLUMN cover_file_id UUID REFERENCES files(id);
ALTER TABLE students ADD COLUMN avatar_file_id UUID REFERENCES files(id);
