-- V20 stored temporary suspensions in the same columns as permanent revocations.
-- Reversible transitions are identified by audit action and reason. A withdrawal
-- or student archival at any point makes the history ambiguous. Audit and
-- revocation timestamps use separate clocks, so their order cannot prove origin.
UPDATE game_recipients r
SET revoked_at = NULL, revoke_reason = NULL
FROM game_assignments ga
JOIN classes c ON c.id = ga.class_id
JOIN class_enrollments e ON e.class_id = c.id
JOIN students s ON s.id = e.student_id
WHERE r.game_assignment_id = ga.id
  AND r.source_enrollment_id = e.id
  AND r.student_id = s.id
  AND r.revoked_at IS NOT NULL
  AND ga.status = 'ACTIVE'
  AND (c.status = 'ACTIVE' OR (c.status = 'ARCHIVED' AND c.archived_from_status = 'ACTIVE'))
  AND e.status IN ('ACTIVE', 'COMPLETED')
  AND s.status = 'ACTIVE'
  AND (
      (r.revoke_reason = 'Lớp đã kết thúc hoặc lưu trữ' AND EXISTS (
          SELECT 1 FROM audit_events a
          WHERE a.entity_type = 'CLASS' AND a.entity_id = c.id
            AND a.action = 'CLASS_ARCHIVE' AND a.changed_fields->>'from' = 'ACTIVE'
      )) OR EXISTS (
          SELECT 1 FROM audit_events a
          WHERE a.entity_type = 'ENROLLMENT' AND a.entity_id = e.id
            AND a.action = 'ENROLLMENT_STATUS_CHANGED' AND a.changed_fields->>'to' = 'COMPLETED'
            AND a.reason = r.revoke_reason
      )
  )
  AND NOT EXISTS (
      SELECT 1 FROM audit_events a
      WHERE a.entity_type = 'ENROLLMENT' AND a.entity_id = e.id
        AND a.action = 'ENROLLMENT_STATUS_CHANGED' AND a.changed_fields->>'to' = 'WITHDRAWN'
  )
  AND NOT EXISTS (
      SELECT 1 FROM audit_events a
      WHERE a.entity_type = 'STUDENT' AND a.entity_id = s.id AND a.action = 'STUDENT_ARCHIVE'
  );
