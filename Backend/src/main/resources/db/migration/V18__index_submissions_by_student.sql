-- Family dashboard, progress and submission history filter by one child first.
CREATE INDEX submissions_student_status ON submissions(student_id,status,reviewed_at DESC,id DESC);
