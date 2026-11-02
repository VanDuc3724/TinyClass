CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(20) NOT NULL CHECK (role IN ('TEACHER', 'PARENT')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
    email_verified_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (email = lower(btrim(email)))
);
CREATE UNIQUE INDEX users_single_teacher ON users (role) WHERE role = 'TEACHER';
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id);

CREATE TABLE classes (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    min_age_months INTEGER CHECK (min_age_months >= 0),
    max_age_months INTEGER CHECK (max_age_months >= 0),
    capacity INTEGER CHECK (capacity > 0),
    location VARCHAR(300),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
    archived_from_status VARCHAR(20) CHECK (archived_from_status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (max_age_months IS NULL OR min_age_months IS NULL OR max_age_months >= min_age_months),
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX classes_teacher_status_idx ON classes (teacher_id, status);

CREATE TABLE students (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES users(id),
    full_name VARCHAR(150) NOT NULL,
    preferred_name VARCHAR(100),
    birth_date DATE,
    internal_note TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX students_teacher_name_idx ON students (teacher_id, full_name);

CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES classes(id),
    student_id UUID NOT NULL REFERENCES students(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'WITHDRAWN', 'COMPLETED')),
    joined_at TIMESTAMPTZ NOT NULL,
    status_changed_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (class_id, student_id)
);
CREATE INDEX enrollments_student_status_idx ON class_enrollments (student_id, status);
