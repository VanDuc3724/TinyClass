CREATE TABLE guardian_invitations (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    student_id UUID NOT NULL REFERENCES students(id),
    invited_email VARCHAR(254) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_by UUID REFERENCES users(id),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (invited_email = lower(btrim(invited_email)))
);
CREATE UNIQUE INDEX invitation_pending_pair ON guardian_invitations(student_id, invited_email) WHERE status = 'PENDING';
CREATE INDEX invitations_student_created ON guardian_invitations(student_id, created_at DESC);

CREATE TABLE student_guardians (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id),
    guardian_user_id UUID NOT NULL REFERENCES users(id),
    relationship_label VARCHAR(50),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
    linked_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (student_id, guardian_user_id)
);
CREATE INDEX guardians_user_status ON student_guardians(guardian_user_id, status);

CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD', 'SET_PASSWORD')),
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX auth_tokens_user_purpose ON auth_tokens(user_id, purpose);
