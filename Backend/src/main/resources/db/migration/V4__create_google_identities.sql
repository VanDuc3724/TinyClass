ALTER TABLE users ADD COLUMN credential_version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE auth_identities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(20) NOT NULL CHECK (provider = 'GOOGLE'),
    issuer VARCHAR(255) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email VARCHAR(254),
    provider_email_verified BOOLEAN NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL,
    last_login_at TIMESTAMPTZ,
    unlinked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX google_subject_active ON auth_identities(provider, issuer, provider_subject) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX google_user_active ON auth_identities(user_id, provider) WHERE unlinked_at IS NULL;
