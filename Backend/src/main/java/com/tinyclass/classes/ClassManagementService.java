package com.tinyclass.classes;

import com.tinyclass.classes.ClassDtos.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.audit.*;
import com.tinyclass.common.persistence.BaseEntity;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ClassManagementService {
    private final LearningClassRepository classes;
    private final StudentRepository students;
    private final EnrollmentRepository enrollments;
    private final AuditEventRepository audit;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public ClassManagementService(LearningClassRepository classes, StudentRepository students,
            EnrollmentRepository enrollments, AuditEventRepository audit, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.classes = classes; this.students = students; this.enrollments = enrollments; this.audit = audit; this.jdbc=jdbc;
    }

    public PageResponse<ClassView> classes(UUID actor, String q, String status, int page, int size) {
        validateStatus(status, Set.of("DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"));
        Specification<LearningClass> filter = (root, query, cb) -> {
            var where = cb.equal(root.get("teacherId"), actor);
            if (status != null && !status.isBlank()) where = cb.and(where, cb.equal(root.get("status"), status));
            if (q != null && !q.isBlank()) where = cb.and(where, cb.like(cb.lower(root.get("name")), search(q), '\\'));
            return where;
        };
        return PageResponse.from(classes.findAll(filter, pageable(page, size)).map(this::view));
    }

    public ClassView classDetail(UUID actor, UUID id) { return view(ownedClass(actor, id)); }

    @Transactional
    public ClassView createClass(UUID actor, ClassInput input, String trace) {
        validateClass(input);
        var entity = classes.saveAndFlush(new LearningClass(actor, input));
        record(actor, "CLASS_CREATED", "CLASS", entity.getId(), Map.of("status", "DRAFT"), null, trace);
        return view(entity);
    }

    @Transactional
    public ClassView updateClass(UUID actor, UUID id, ClassInput input, String trace) {
        var entity = lockClass(actor, id);
        checkVersion(entity, input.version());
        require(!"ARCHIVED".equals(entity.getStatus()), "INVALID_STATE", "Khôi phục lớp trước khi chỉnh sửa.");
        validateClass(input);
        require(input.capacity() == null || input.capacity() >= enrollments.countByClassIdAndStatus(id, "ACTIVE"),
                "CLASS_CAPACITY_EXCEEDED", "Sĩ số tối đa không thể nhỏ hơn số bé đang tham gia.");
        entity.edit(input);
        classes.flush();
        record(actor, "CLASS_UPDATED", "CLASS", id, Map.of("version", entity.getVersion()), null, trace);
        return view(entity);
    }

    @Transactional
    public ClassView classAction(UUID actor, UUID id, String action, VersionInput input, String trace) {
        var entity = lockClass(actor, id);
        checkVersion(entity, input.version());
        String previous = entity.getStatus();
        switch (action) {
            case "activate" -> { require("DRAFT".equals(previous), "INVALID_STATE", "Chỉ mở lớp đang chuẩn bị."); entity.activate(); }
            case "complete" -> {
                require("ACTIVE".equals(previous), "INVALID_STATE", "Chỉ kết thúc lớp đang hoạt động.");
                entity.complete();
                for (var enrollment : enrollments.findByClassIdAndStatus(id, "ACTIVE")) {
                    enrollment.changeStatus("COMPLETED", "Lớp đã kết thúc.");
                    record(actor, "ENROLLMENT_COMPLETED", "ENROLLMENT", enrollment.getId(),
                            Map.of("from", "ACTIVE", "to", "COMPLETED"), "Lớp đã kết thúc.", trace);
                }
            }
            case "archive" -> { require(!"ARCHIVED".equals(previous), "INVALID_STATE", "Lớp đã được lưu trữ."); entity.archive(); }
            case "restore" -> { require("ARCHIVED".equals(previous), "INVALID_STATE", "Lớp chưa được lưu trữ."); entity.restore(); }
            default -> throw missing();
        }
        classes.flush();
        record(actor, "CLASS_" + action.toUpperCase(Locale.ROOT), "CLASS", id,
                Map.of("from", previous, "to", entity.getStatus()), input.reason(), trace);
        return view(entity);
    }

    public PageResponse<StudentView> students(UUID actor, String q, String status, int page, int size) {
        validateStatus(status, Set.of("ACTIVE", "ARCHIVED"));
        Specification<Student> filter = (root, query, cb) -> {
            var where = cb.equal(root.get("teacherId"), actor);
            if (status != null && !status.isBlank()) where = cb.and(where, cb.equal(root.get("status"), status));
            if (q != null && !q.isBlank()) where = cb.and(where, cb.or(
                    cb.like(cb.lower(root.get("fullName")), search(q), '\\'),
                    cb.like(cb.lower(root.get("preferredName")), search(q), '\\')));
            return where;
        };
        return PageResponse.from(students.findAll(filter, pageable(page, size)).map(StudentView::from));
    }

    public StudentView studentDetail(UUID actor, UUID id) { return StudentView.from(ownedStudent(actor, id)); }

    @Transactional
    public StudentView createStudent(UUID actor, StudentInput input, String trace) {
        validateBirthDate(input);
        var entity = students.saveAndFlush(new Student(actor, input));
        record(actor, "STUDENT_CREATED", "STUDENT", entity.getId(), Map.of("status", "ACTIVE"), null, trace);
        return StudentView.from(entity);
    }

    @Transactional
    public StudentView updateStudent(UUID actor, UUID id, StudentInput input, String trace) {
        validateBirthDate(input);
        var entity = students.lockOwned(id, actor).orElseThrow(ClassManagementService::missing);
        checkVersion(entity, input.version());
        require("ACTIVE".equals(entity.getStatus()), "INVALID_STATE", "Khôi phục hồ sơ trước khi chỉnh sửa.");
        entity.edit(input); students.flush();
        record(actor, "STUDENT_UPDATED", "STUDENT", id, Map.of("version", entity.getVersion()), null, trace);
        return StudentView.from(entity);
    }

    @Transactional
    public StudentView studentAction(UUID actor, UUID id, String action, VersionInput input, String trace) {
        var entity = students.lockOwned(id, actor).orElseThrow(ClassManagementService::missing);
        checkVersion(entity, input.version());
        String previous = entity.getStatus();
        if ("archive".equals(action)) {
            require("ACTIVE".equals(previous), "INVALID_STATE", "Hồ sơ đã được lưu trữ.");
            require(enrollments.countByStudentIdAndStatus(id, "ACTIVE") == 0,
                    "STUDENT_HAS_ACTIVE_CLASSES", "Cho bé rời các lớp đang tham gia trước khi lưu trữ hồ sơ.");
            entity.archive();
            jdbc.update("update assignment_recipients set revoked_at=now(),revoke_reason='Hồ sơ bé đã được lưu trữ' where student_id=? and revoked_at is null",id);
        } else if ("restore".equals(action)) {
            require("ARCHIVED".equals(previous), "INVALID_STATE", "Hồ sơ chưa được lưu trữ."); entity.restore();
        } else throw missing();
        students.flush();
        record(actor, "STUDENT_" + action.toUpperCase(Locale.ROOT), "STUDENT", id,
                Map.of("from", previous, "to", entity.getStatus()), input.reason(), trace);
        return StudentView.from(entity);
    }

    public PageResponse<EnrollmentView> enrollments(UUID actor, UUID classId, int page, int size) {
        ownedClass(actor, classId);
        return PageResponse.from(enrollments.findByClassId(classId, pageable(page, size))
                .map(e -> EnrollmentView.from(e, ownedStudent(actor, e.getStudentId()))));
    }

    @Transactional
    public EnrollmentView enroll(UUID actor, UUID classId, EnrollInput input, String trace) {
        var classroom = lockClass(actor, classId);
        var student = students.lockOwned(input.studentId(), actor).orElseThrow(ClassManagementService::missing);
        canJoin(classroom, student);
        require(!enrollments.existsByClassIdAndStudentId(classId, input.studentId()), "ALREADY_ENROLLED",
                "Bé đã có hồ sơ tham gia lớp. Hãy dùng thao tác quay lại nếu bé đã rời lớp.");
        checkCapacity(classroom);
        var entity = enrollments.saveAndFlush(new Enrollment(classId, input.studentId()));
        record(actor, "ENROLLMENT_CREATED", "ENROLLMENT", entity.getId(),
                Map.of("classId", classId.toString(), "studentId", student.getId().toString(), "to", "ACTIVE"), null, trace);
        return EnrollmentView.from(entity, student);
    }

    @Transactional
    public EnrollmentView updateEnrollment(UUID actor, UUID id, EnrollmentInput input, String trace) {
        // Read IDs first, then serialize changes using the class lock (including capacity edits).
        var reference = enrollments.findById(id).orElseThrow(ClassManagementService::missing);
        var classroom = lockClass(actor, reference.getClassId());
        var student = students.lockOwned(reference.getStudentId(), actor).orElseThrow(ClassManagementService::missing);
        // refresh avoids a stale managed instance after waiting on another transaction's class lock.
        entityManager.refresh(reference);
        checkVersion(reference, input.version());
        String previous = reference.getStatus();
        require(!previous.equals(input.status()), "INVALID_STATE", "Bé đã ở trạng thái này.");
        require(!"ARCHIVED".equals(classroom.getStatus()) && !"COMPLETED".equals(classroom.getStatus()),
                "INVALID_STATE", "Khôi phục lớp đang chuẩn bị hoặc hoạt động trước khi đổi thành viên.");
        if ("ACTIVE".equals(input.status())) { canJoin(classroom, student); checkCapacity(classroom); }
        else require("ACTIVE".equals(previous), "INVALID_STATE", "Chỉ thay đổi trạng thái của bé đang tham gia.");
        reference.changeStatus(input.status(), input.reason().strip()); enrollments.flush();
        if("WITHDRAWN".equals(input.status())) jdbc.update("update assignment_recipients set revoked_at=now(),revoke_reason=? where source_enrollment_id=? and revoked_at is null",input.reason().strip(),id);
        record(actor, "ENROLLMENT_STATUS_CHANGED", "ENROLLMENT", id,
                Map.of("from", previous, "to", input.status()), input.reason().strip(), trace);
        return EnrollmentView.from(reference, student);
    }

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    public List<StudentClassView> studentClasses(UUID actor, UUID id) {
        ownedStudent(actor, id);
        return enrollments.findByStudentId(id).stream().map(e -> {
            var c = ownedClass(actor, e.getClassId());
            return new StudentClassView(e.getId(), c.getId(), c.getName(), c.getStatus(), e.getStatus(), e.getJoinedAt(), e.getEndedAt());
        }).toList();
    }

    public PageResponse<HistoryView> enrollmentHistory(UUID actor, UUID id, int page, int size) {
        var enrollment = enrollments.findById(id).orElseThrow(ClassManagementService::missing);
        ownedClass(actor, enrollment.getClassId());
        return PageResponse.from(audit.findByEntityTypeAndEntityIdOrderByCreatedAtDesc("ENROLLMENT", id, pageable(page, size))
                .map(e -> new HistoryView(e.getId(), e.getAction(), e.getChangedFields(), e.getReason(), e.getCreatedAt())));
    }

    private ClassView view(LearningClass c) { return ClassView.from(c, enrollments.countByClassIdAndStatus(c.getId(), "ACTIVE")); }
    private LearningClass ownedClass(UUID actor, UUID id) { return classes.findByIdAndTeacherId(id, actor).orElseThrow(ClassManagementService::missing); }
    private Student ownedStudent(UUID actor, UUID id) { return students.findByIdAndTeacherId(id, actor).orElseThrow(ClassManagementService::missing); }
    private LearningClass lockClass(UUID actor, UUID id) { return classes.lockOwned(id, actor).orElseThrow(ClassManagementService::missing); }
    private void canJoin(LearningClass c, Student s) {
        require(Set.of("DRAFT", "ACTIVE").contains(c.getStatus()) && "ACTIVE".equals(s.getStatus()),
                "INVALID_STATE", "Chỉ thêm bé có hồ sơ hoạt động vào lớp đang chuẩn bị hoặc đang hoạt động.");
    }
    private void checkCapacity(LearningClass c) {
        require(c.getCapacity() == null || enrollments.countByClassIdAndStatus(c.getId(), "ACTIVE") < c.getCapacity(),
                "CLASS_FULL", "Lớp đã đủ sĩ số. Hãy điều chỉnh sĩ số hoặc chọn lớp khác.");
    }
    private void checkVersion(BaseEntity entity, Long version) {
        if (version == null || !version.equals(entity.getVersion())) throw new ApiException(HttpStatus.CONFLICT,
                "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
    private void validateClass(ClassInput input) {
        if (input.minAgeMonths() != null && input.maxAgeMonths() != null && input.maxAgeMonths() < input.minAgeMonths())
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AGE_RANGE", "Độ tuổi tối đa phải lớn hơn hoặc bằng độ tuổi tối thiểu.");
        if (input.startDate() != null && input.endDate() != null && input.endDate().isBefore(input.startDate()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "Ngày kết thúc không được trước ngày bắt đầu.");
    }
    private void validateBirthDate(StudentInput input) {
        if (input.birthDate() != null && input.birthDate().isAfter(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BIRTH_DATE", "Ngày sinh không được ở tương lai.");
    }
    private void validateStatus(String status, Set<String> values) {
        if (status != null && !status.isBlank() && !values.contains(status))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "Bộ lọc trạng thái không hợp lệ.");
    }
    private Pageable pageable(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", "Phân trang chưa hợp lệ.");
        return PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    }
    private String search(String value) {
        if (value.length() > 150) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SEARCH", "Từ khóa tối đa 150 ký tự.");
        return "%" + value.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
    private void record(UUID actor, String action, String type, UUID id, Map<String, Object> fields, String reason, String trace) {
        audit.save(new AuditEvent(actor, action, type, id, fields, reason, trace));
    }
    private void require(boolean condition, String code, String message) {
        if (!condition) throw new ApiException(HttpStatus.CONFLICT, code, message);
    }
    private static ApiException missing() { return new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Không tìm thấy dữ liệu."); }
}
