package com.tinyclass.family;

import jakarta.validation.constraints.*;
import java.time.*;
import java.util.UUID;

public final class FamilyDtos {
    private FamilyDtos() {}
    public record InviteInput(@NotBlank @Email @Size(max = 254) String email) {
        public InviteInput { if (email != null) email = email.strip().toLowerCase(java.util.Locale.ROOT); }
    }
    public record TokenInput(@NotBlank @Size(min = 32, max = 256) String token) {}
    public record AcceptInput(@NotBlank @Size(min = 32, max = 256) String token, @Size(max = 50) String relationshipLabel) {}
    public record InvitationView(UUID id, String invitedEmail, String status, Instant expiresAt, Long version) {
        static InvitationView from(GuardianInvitation invitation) {
            return new InvitationView(invitation.getId(), invitation.getInvitedEmail(), invitation.displayStatus(),
                    invitation.getExpiresAt(), invitation.getVersion());
        }
    }
    public record CreatedInvitation(InvitationView invitation, String inviteUrl) {}
    public record InvitationPreview(String teacherName, String maskedEmail, String status) {}
    public record GuardianView(UUID id, UUID userId, String displayName, String email, String relationshipLabel,
            String status, Instant linkedAt, Long version) {}
    public record AcceptedView(UUID studentId, UUID linkId) {}
    public record ChildView(UUID id, String fullName, String preferredName, LocalDate birthDate,
            String status, String teacherName, String relationshipLabel) {}
    public record ChildClassView(UUID id, String name, String description, String location,
            String status, String enrollmentStatus, LocalDate startDate, LocalDate endDate) {}
}
