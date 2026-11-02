package com.tinyclass.family;

import com.tinyclass.auth.*;
import com.tinyclass.classes.*;
import com.tinyclass.classes.ClassDtos.VersionInput;
import com.tinyclass.common.api.*;
import com.tinyclass.common.audit.*;
import com.tinyclass.family.FamilyDtos.*;
import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class GuardianService {
    private final StudentRepository students;
    private final UserAccountRepository users;
    private final GuardianInvitationRepository invitations;
    private final StudentGuardianRepository guardians;
    private final EnrollmentRepository enrollments;
    private final LearningClassRepository classes;
    private final AuditEventRepository audit;
    private final AccountMailer mailer;
    private final long ttlHours;
    @PersistenceContext private EntityManager entityManager;

    public GuardianService(StudentRepository students, UserAccountRepository users,
            GuardianInvitationRepository invitations, StudentGuardianRepository guardians,
            EnrollmentRepository enrollments, LearningClassRepository classes, AuditEventRepository audit,
            AccountMailer mailer, @Value("${tinyclass.invitations.ttl-hours:48}") long ttlHours) {
        this.students = students; this.users = users; this.invitations = invitations; this.guardians = guardians;
        this.enrollments = enrollments; this.classes = classes; this.audit = audit; this.mailer = mailer;
        if (ttlHours < 1 || ttlHours > 720) throw new IllegalArgumentException("Invitation TTL must be 1..720 hours");
        this.ttlHours = ttlHours;
    }

    @Transactional
    public CreatedInvitation invite(UUID teacher, UUID studentId, InviteInput input, String trace) {
        var student = lockStudent(teacher, studentId);
        require("ACTIVE".equals(student.getStatus()), "INVALID_STATE", "Khôi phục hồ sơ bé trước khi tạo lời mời.");
        var existingUser = users.findByEmail(input.email());
        if (existingUser.isPresent()) {
            require("PARENT".equals(existingUser.get().getRole()), "INVALID_GUARDIAN", "Email này không thể nhận lời mời phụ huynh.");
            require(!guardians.existsByStudentIdAndGuardianUserIdAndStatus(studentId, existingUser.get().getId(), "ACTIVE"),
                    "ALREADY_LINKED", "Phụ huynh này đã được liên kết với bé.");
        }
        for (var old : invitations.findByStudentIdAndInvitedEmailAndStatus(studentId, input.email(), "PENDING")) old.revoke();
        invitations.flush();
        String raw = SecretTokens.generate();
        var invitation = invitations.saveAndFlush(new GuardianInvitation(teacher, studentId, input.email(), raw, ttlHours));
        record(teacher, "GUARDIAN_INVITED", "INVITATION", invitation.getId(), Map.of("studentId", studentId.toString()), null, trace);
        return new CreatedInvitation(InvitationView.from(invitation), mailer.link("/invite", "token=" + raw));
    }

    public InvitationPreview preview(String raw) {
        var invitation = invitations.findByTokenHash(SecretTokens.hash(raw));
        if (invitation.isEmpty()) return new InvitationPreview(null, null, "INVALID");
        var found = invitation.get();
        return new InvitationPreview(users.findById(found.getTeacherId()).map(UserAccount::getDisplayName).orElse("Giáo viên"),
                mask(found.getInvitedEmail()), found.displayStatus());
    }

    /** Only registration takes the student lock; read-only continuation checks never acquire user/student locks out of order. */
    @Transactional
    public void validateRegistration(String raw, String email) {
        var invitation = invitationByRaw(raw);
        var student = lockStudent(invitation.getTeacherId(), invitation.getStudentId());
        entityManager.refresh(invitation);
        validatePending(invitation, student, email);
    }

    public void validateContinuation(String raw, String email) {
        var invitation = invitationByRaw(raw);
        var student = students.findByIdAndTeacherId(invitation.getStudentId(), invitation.getTeacherId()).orElseThrow(GuardianService::missing);
        validatePending(invitation, student, email);
    }

    @Transactional
    public AcceptedView accept(UUID actor, AcceptInput input, String trace) {
        var invitation = invitationByRaw(input.token());
        var student = lockStudent(invitation.getTeacherId(), invitation.getStudentId());
        entityManager.refresh(invitation);
        var parent = verifiedParent(actor);
        validatePending(invitation, student, parent.getEmail());
        var link = guardians.findByStudentIdAndGuardianUserId(student.getId(), actor).orElse(null);
        String label = input.relationshipLabel() == null || input.relationshipLabel().isBlank() ? "Phụ huynh" : input.relationshipLabel().strip();
        if (link == null) link = new StudentGuardian(student.getId(), actor, label);
        else if (!"ACTIVE".equals(link.getStatus())) link.activate(label);
        link = guardians.saveAndFlush(link);
        invitation.accept(actor);
        record(actor, "GUARDIAN_INVITATION_ACCEPTED", "STUDENT_GUARDIAN", link.getId(),
                Map.of("studentId", student.getId().toString(), "invitationId", invitation.getId().toString(), "status", "ACTIVE"), null, trace);
        return new AcceptedView(student.getId(), link.getId());
    }

    public PageResponse<InvitationView> invitations(UUID teacher, UUID student, int page, int size) {
        ownedStudent(teacher, student);
        return PageResponse.from(invitations.findByStudentId(student, page(page, size)).map(InvitationView::from));
    }

    public PageResponse<GuardianView> guardians(UUID teacher, UUID student, int page, int size) {
        ownedStudent(teacher, student);
        return PageResponse.from(guardians.findByStudentId(student, page(page, size)).map(link -> {
            var user = users.findById(link.getGuardianUserId()).orElseThrow(GuardianService::missing);
            return new GuardianView(link.getId(), user.getId(), user.getDisplayName(), user.getEmail(),
                    link.getRelationshipLabel(), link.getStatus(), link.getLinkedAt(), link.getVersion());
        }));
    }

    @Transactional
    public InvitationView revokeInvitation(UUID teacher, UUID id, VersionInput input, String trace) {
        var invitation = invitations.findById(id).orElseThrow(GuardianService::missing);
        lockStudent(teacher, invitation.getStudentId()); entityManager.refresh(invitation);
        version(invitation.getVersion(), input.version());
        require("PENDING".equals(invitation.getStatus()), "INVALID_STATE", "Lời mời không còn chờ nhận.");
        invitation.revoke(); invitations.flush();
        record(teacher, "GUARDIAN_INVITATION_REVOKED", "INVITATION", id, Map.of("status", "REVOKED"), input.reason(), trace);
        return InvitationView.from(invitation);
    }

    @Transactional
    public boolean revokeGuardian(UUID teacher, UUID id, VersionInput input, String trace) {
        var link = guardians.findById(id).orElseThrow(GuardianService::missing);
        lockStudent(teacher, link.getStudentId()); entityManager.refresh(link);
        version(link.getVersion(), input.version());
        require("ACTIVE".equals(link.getStatus()), "INVALID_STATE", "Liên kết đã được thu hồi.");
        link.revoke();
        record(teacher, "GUARDIAN_LINK_REVOKED", "STUDENT_GUARDIAN", id, Map.of("status", "REVOKED"), input.reason(), trace);
        return true;
    }

    public PageResponse<ChildView> children(UUID parent, int page, int size) {
        verifiedParent(parent);
        return PageResponse.from(guardians.findByGuardianUserIdAndStatus(parent, "ACTIVE", page(page, size))
                .map(link -> childView(link, students.findById(link.getStudentId()).orElseThrow(GuardianService::missing))));
    }

    public ChildView child(UUID parent, UUID child) {
        var link = familyLink(parent, child);
        return childView(link, students.findById(child).orElseThrow(GuardianService::missing));
    }

    public PageResponse<ChildClassView> childClasses(UUID parent, UUID child, int page, int size) {
        familyLink(parent, child);
        var student = students.findById(child).orElseThrow(GuardianService::missing);
        // Filter before pagination, including the count, so hidden classes cannot leak through metadata.
        var visible = enrollments.findByStudentId(child).stream()
                .filter(e -> Set.of("ACTIVE", "COMPLETED").contains(e.getStatus()))
                .map(e -> classes.findByIdAndTeacherId(e.getClassId(), student.getTeacherId())
                        .filter(c -> Set.of("ACTIVE", "COMPLETED").contains(c.getStatus()))
                        .map(c -> new ChildClassView(c.getId(), c.getName(), c.getDescription(), c.getLocation(),
                                c.getStatus(), e.getStatus(), c.getStartDate(), c.getEndDate())).orElse(null))
                .filter(Objects::nonNull).sorted(Comparator.comparing(ChildClassView::name).thenComparing(ChildClassView::id)).toList();
        var request = page(page, size);
        int from = (int) Math.min(request.getOffset(), visible.size()), end = Math.min(from + size, visible.size());
        return PageResponse.from(new PageImpl<>(visible.subList(from, end), request, visible.size()));
    }

    private StudentGuardian familyLink(UUID parent, UUID child) {
        verifiedParent(parent);
        return guardians.findByStudentIdAndGuardianUserId(child, parent).filter(link -> "ACTIVE".equals(link.getStatus())).orElseThrow(GuardianService::missing);
    }
    private ChildView childView(StudentGuardian link, Student student) {
        return new ChildView(student.getId(), student.getFullName(), student.getPreferredName(), student.getBirthDate(),
                student.getStatus(), users.findById(student.getTeacherId()).map(UserAccount::getDisplayName).orElse("Giáo viên"), link.getRelationshipLabel());
    }
    private UserAccount verifiedParent(UUID id) {
        var user = users.findById(id).orElseThrow(GuardianService::missing);
        if (!"PARENT".equals(user.getRole()) || !"ACTIVE".equals(user.getStatus())) throw new ApiException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Không thể sử dụng tài khoản này để truy cập gia đình.");
        if (user.getEmailVerifiedAt() == null) throw new ApiException(HttpStatus.FORBIDDEN, "EMAIL_VERIFICATION_REQUIRED", "Xác minh email trước khi truy cập hồ sơ của bé.");
        return user;
    }
    private void validatePending(GuardianInvitation invitation, Student student, String email) {
        if (!invitation.pending()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVITATION_UNAVAILABLE", "Lời mời đã hết hạn, bị thu hồi hoặc đã được nhận. Hãy liên hệ giáo viên.");
        if (!invitation.getInvitedEmail().equals(email)) throw new ApiException(HttpStatus.FORBIDDEN, "INVITATION_EMAIL_MISMATCH", "Email tài khoản không khớp với email nhận lời mời.");
        require("ACTIVE".equals(student.getStatus()), "INVALID_STATE", "Hồ sơ chưa sẵn sàng để nhận lời mời.");
        var teacher = users.findById(invitation.getTeacherId()).orElseThrow(GuardianService::missing);
        require("TEACHER".equals(teacher.getRole()) && "ACTIVE".equals(teacher.getStatus()), "INVALID_STATE", "Giáo viên chưa thể cấp quyền lúc này.");
    }
    private GuardianInvitation invitationByRaw(String raw) {
        return invitations.findByTokenHash(SecretTokens.hash(raw)).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVITATION_UNAVAILABLE", "Lời mời không hợp lệ hoặc không còn hiệu lực."));
    }
    private Student lockStudent(UUID teacher, UUID id) { return students.lockOwned(id, teacher).orElseThrow(GuardianService::missing); }
    private void ownedStudent(UUID teacher, UUID id) { students.findByIdAndTeacherId(id, teacher).orElseThrow(GuardianService::missing); }
    private Pageable page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", "Phân trang chưa hợp lệ.");
        return PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    }
    private void version(Long actual, Long expected) {
        if (!Objects.equals(actual, expected)) throw new ApiException(HttpStatus.CONFLICT, "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
    private void record(UUID actor, String action, String type, UUID id, Map<String, Object> fields, String reason, String trace) {
        audit.save(new AuditEvent(actor, action, type, id, fields, reason, trace));
    }
    private String mask(String email) { int at = email.indexOf('@'); return email.substring(0, 1) + "***" + email.substring(at); }
    private void require(boolean value, String code, String message) { if (!value) throw new ApiException(HttpStatus.CONFLICT, code, message); }
    private static ApiException missing() { return new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Không tìm thấy dữ liệu."); }
}
