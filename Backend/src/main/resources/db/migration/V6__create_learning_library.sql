CREATE TABLE topics (
    id UUID PRIMARY KEY, teacher_id UUID NOT NULL REFERENCES users(id), name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) NOT NULL, description TEXT, archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(teacher_id,normalized_name)
);
CREATE TABLE lessons (
    id UUID PRIMARY KEY, teacher_id UUID NOT NULL REFERENCES users(id), title VARCHAR(200) NOT NULL,
    summary VARCHAR(1000), parent_guidance TEXT, activity_instructions TEXT, estimated_minutes INT CHECK(estimated_minutes>0),
    default_completion_mode VARCHAR(30) NOT NULL CHECK(default_completion_mode IN('REFERENCE','PARENT_CONFIRM','TEACHER_REVIEW')),
    default_response_types JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL CHECK(status IN('DRAFT','PUBLISHED','ARCHIVED')), published_at TIMESTAMPTZ, archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX lessons_owner_status ON lessons(teacher_id,status,created_at DESC);
CREATE TABLE lesson_topics (lesson_id UUID NOT NULL REFERENCES lessons(id), topic_id UUID NOT NULL REFERENCES topics(id), PRIMARY KEY(lesson_id,topic_id));
CREATE TABLE lesson_blocks (
    id UUID PRIMARY KEY, lesson_id UUID NOT NULL REFERENCES lessons(id), position INT NOT NULL CHECK(position>=0),
    type VARCHAR(10) NOT NULL CHECK(type IN('TEXT','IMAGE','AUDIO','VIDEO','PDF')), text_content TEXT,
    file_id UUID REFERENCES files(id), caption VARCHAR(500), alt_text VARCHAR(500), UNIQUE(lesson_id,position)
);
CREATE TABLE courses (
    id UUID PRIMARY KEY, teacher_id UUID NOT NULL REFERENCES users(id), title VARCHAR(200) NOT NULL, description TEXT,
    min_age_months INT CHECK(min_age_months>=0), max_age_months INT CHECK(max_age_months>=min_age_months),
    cover_file_id UUID REFERENCES files(id), status VARCHAR(20) NOT NULL CHECK(status IN('DRAFT','PUBLISHED','ARCHIVED')),
    published_at TIMESTAMPTZ, archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX courses_owner_status ON courses(teacher_id,status,created_at DESC);
CREATE TABLE course_lessons (
    course_id UUID NOT NULL REFERENCES courses(id), lesson_id UUID NOT NULL REFERENCES lessons(id),
    position INT NOT NULL CHECK(position>=0), is_required BOOLEAN NOT NULL,
    PRIMARY KEY(course_id,lesson_id), UNIQUE(course_id,position)
);
