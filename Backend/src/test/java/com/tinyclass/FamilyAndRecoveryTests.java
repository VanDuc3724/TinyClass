package com.tinyclass;

import com.tinyclass.auth.*;
import com.tinyclass.support.ApiBrowser;
import com.tinyclass.support.ApiBrowser.Result;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "tinyclass.auth.attempt-limit=1000", "tinyclass.mail.cooldown-seconds=0"
})
@ActiveProfiles("test")
class FamilyAndRecoveryTests {
    private static final String TEACHER = "family-teacher@example.test", PARENT = "mother@example.test";
    private static final String PASSWORD = "Synthetic-family-password-2026";
    @Autowired Environment environment;
    @Autowired UserAccountRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired JavaMailSender mailSender;

    @BeforeEach
    void resetDedicatedDatabaseAndTestMailbox() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE class_enrollments, classes, students, audit_events, users CASCADE");
        try (var http = HttpClient.newHttpClient()) {
            var result = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18026/api/v1/messages"))
                    .DELETE().build(), HttpResponse.BodyHandlers.discarding());
            assertThat(result.statusCode()).isBetween(200, 299);
        }
        users.saveAndFlush(new UserAccount(TEACHER, passwords.encode(PASSWORD), "Synthetic teacher", "TEACHER"));
    }

    @Test
    void registrationVerificationAndAcceptanceOnlyGrantTheInvitedChild() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            var child = child(teacher, "Invited child");
            var invitation = invite(teacher, child, PARENT);
            var preview = parent.post("/auth/invitations/preview", Map.of("token", invitation.raw()));
            assertThat(preview.status()).isEqualTo(200);
            assertThat(preview.data().path("maskedEmail").stringValue()).isEqualTo("m***@example.test");
            assertThat(preview.body().toString()).doesNotContain("Invited child", "internalNote", child);
            var registered = register(parent, PARENT, invitation.raw());
            assertThat(registered.status()).isEqualTo(201);
            assertThat(registered.data().path("role").stringValue()).isEqualTo("PARENT");
            assertThat(registered.data().path("emailVerifiedAt").isNull()).isTrue();
            assertThat(parent.post("/auth/login", credentials(PARENT)).status()).isEqualTo(200);
            assertThat(parent.get("/family/children").body().path("code").stringValue()).isEqualTo("EMAIL_VERIFICATION_REQUIRED");
            assertThat(parent.post("/guardian-invitations/accept", Map.of("token", invitation.raw())).status()).isEqualTo(403);
            String token = mailToken(PARENT);
            assertThat(parent.post("/auth/email-verifications/confirm", Map.of("token", token)).status()).isEqualTo(200);
            assertThat(parent.post("/auth/email-verifications/confirm", Map.of("token", token)).status()).isEqualTo(400);
            assertThat(parent.post("/guardian-invitations/accept", Map.of("token", invitation.raw(), "relationshipLabel", "Mẹ")).status()).isEqualTo(200);
            assertThat(parent.post("/guardian-invitations/accept", Map.of("token", invitation.raw())).status()).isEqualTo(400);
            var children = parent.get("/family/children");
            assertThat(children.data().size()).isEqualTo(1);
            assertThat(children.data().get(0).path("id").stringValue()).isEqualTo(child);
            assertThat(children.body().toString()).doesNotContain("TEACHER_PRIVATE_NOTE", "internalNote", "password", "tokenHash");
            assertThat(parent.get("/students/" + child).status()).isEqualTo(403);
            assertThat(jdbc.queryForObject("select count(*) from student_guardians", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select token_hash from auth_tokens limit 1", String.class)).matches("[a-f0-9]{64}").isNotEqualTo(token);
            assertThat(jdbc.queryForObject("select token_hash from guardian_invitations limit 1", String.class)).matches("[a-f0-9]{64}").isNotEqualTo(invitation.raw());
        }
    }

    @Test
    void registrationCannotPickATeacherRoleOrUseAnotherEmail() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            String child = child(teacher, "Role test child");
            var invitation = invite(teacher, child, PARENT);
            assertThat(register(parent, "wrong@example.test", invitation.raw()).status()).isEqualTo(403);
            assertThat(register(parent, PARENT, "x".repeat(43)).status()).isEqualTo(400);
            var body = new HashMap<String, Object>();
            body.put("displayName", "Synthetic parent"); body.put("email", PARENT); body.put("password", PASSWORD);
            body.put("invitationToken", invitation.raw()); body.put("role", "TEACHER");
            var result = parent.post("/auth/register", body);
            assertThat(result.status()).isEqualTo(201);
            assertThat(result.data().path("role").stringValue()).isEqualTo("PARENT");
            assertThat(jdbc.queryForObject("select count(*) from users where role='TEACHER'", Integer.class)).isEqualTo(1);
            assertThat(register(parent, PARENT, invitation.raw()).status()).isEqualTo(409);
        }
    }

    @Test
    void expiredRevokedAndReplacedInvitationsDoNotGrantAccess() throws Exception {
        seedParent(PARENT);
        try (var teacher = login(TEACHER); var parent = login(PARENT)) {
            String child = child(teacher, "Unavailable invitation child");
            var first = invite(teacher, child, PARENT);
            var second = invite(teacher, child, PARENT);
            assertThat(parent.post("/auth/invitations/preview", Map.of("token", first.raw())).data().path("status").stringValue()).isEqualTo("REVOKED");
            assertThat(parent.post("/guardian-invitations/accept", Map.of("token", first.raw())).status()).isEqualTo(400);
            assertThat(teacher.post("/guardian-invitations/" + second.id() + "/revoke", Map.of("version", 0)).status()).isEqualTo(200);
            assertThat(parent.post("/guardian-invitations/accept", Map.of("token", second.raw())).status()).isEqualTo(400);
            var expired = invite(teacher, child, PARENT);
            jdbc.update("update guardian_invitations set expires_at = now() - interval '1 second' where id = ?", UUID.fromString(expired.id()));
            assertThat(parent.post("/auth/invitations/preview", Map.of("token", expired.raw())).data().path("status").stringValue()).isEqualTo("EXPIRED");
            assertThat(parent.post("/guardian-invitations/accept", Map.of("token", expired.raw())).status()).isEqualTo(400);
            assertThat(jdbc.queryForObject("select count(*) from student_guardians", Integer.class)).isZero();
        }
    }

    @Test
    void aVerifiedAccountWithAnotherEmailCannotAcceptTheInvitation() throws Exception {
        seedParent("wrong@example.test");
        try (var teacher = login(TEACHER); var wrong = login("wrong@example.test")) {
            var invitation = invite(teacher, child(teacher, "Private child"), PARENT);
            var response = wrong.post("/guardian-invitations/accept", Map.of("token", invitation.raw()));
            assertThat(response.status()).isEqualTo(403);
            assertThat(response.body().path("code").stringValue()).isEqualTo("INVITATION_EMAIL_MISMATCH");
            assertThat(response.body().toString()).doesNotContain("Private child");
        }
    }

    @Test
    void concurrentAcceptanceConsumesTheInvitationOnlyOnce() throws Exception {
        seedParent(PARENT);
        try (var teacher = login(TEACHER); var first = login(PARENT); var second = login(PARENT)) {
            var invitation = invite(teacher, child(teacher, "Concurrent child"), PARENT);
            var start = new CountDownLatch(1);
            var a = CompletableFuture.supplyAsync(() -> acceptAfter(first, invitation.raw(), start));
            var b = CompletableFuture.supplyAsync(() -> acceptAfter(second, invitation.raw(), start));
            start.countDown();
            assertThat(List.of(a.get(15, TimeUnit.SECONDS).status(), b.get(15, TimeUnit.SECONDS).status())).containsExactlyInAnyOrder(200, 400);
            assertThat(jdbc.queryForObject("select count(*) from student_guardians", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from audit_events where action='GUARDIAN_INVITATION_ACCEPTED'", Integer.class)).isEqualTo(1);
        }
    }

    @Test
    void multipleGuardiansAndChildrenStayIndependentWhenOneLinkIsRevoked() throws Exception {
        seedParent(PARENT); seedParent("father@example.test");
        try (var teacher = login(TEACHER); var mother = login(PARENT); var father = login("father@example.test")) {
            String a = child(teacher, "Child A"), b = child(teacher, "Child B");
            var firstLink = accept(mother, invite(teacher, a, PARENT)).data().path("linkId").stringValue();
            accept(mother, invite(teacher, b, PARENT)); accept(father, invite(teacher, a, "father@example.test"));
            assertThat(mother.get("/family/children").data().size()).isEqualTo(2);
            assertThat(father.get("/family/children").data().size()).isEqualTo(1);
            assertThat(father.get("/family/children/" + b).status()).isEqualTo(404);
            assertThat(teacher.post("/student-guardians/" + firstLink + "/revoke", Map.of("version", 0, "reason", "Test revoke")).status()).isEqualTo(200);
            assertThat(mother.get("/family/children/" + a).status()).isEqualTo(404);
            assertThat(mother.get("/family/children/" + a + "/classes").status()).isEqualTo(404);
            assertThat(mother.get("/family/children/" + b).status()).isEqualTo(200);
            assertThat(father.get("/family/children/" + a).status()).isEqualTo(200);
            assertThat(mother.get("/family/children").body().path("meta").path("totalElements").intValue()).isEqualTo(1);
            var returned = accept(mother, invite(teacher, a, PARENT));
            assertThat(returned.data().path("linkId").stringValue()).isEqualTo(firstLink);
            assertThat(mother.get("/family/children/" + a).status()).isEqualTo(200);
        }
    }

    @Test
    void familyClassListsHideDraftArchivedAndWithdrawnMembershipsIncludingCounts() throws Exception {
        seedParent(PARENT);
        try (var teacher = login(TEACHER); var parent = login(PARENT)) {
            String child = child(teacher, "Class rights child");
            accept(parent, invite(teacher, child, PARENT));
            var classroom = teacher.post("/classes", Map.of("name", "Visible class")).data();
            String path = "/classes/" + classroom.path("id").stringValue();
            var enrollment = teacher.post(path + "/enrollments", Map.of("studentId", child)).data();
            String familyPath = "/family/children/" + child + "/classes";
            assertThat(parent.get(familyPath).data().size()).isZero();
            var active = teacher.post(path + "/activate", Map.of("version", 0)).data();
            assertThat(parent.get(familyPath).data().size()).isEqualTo(1);
            teacher.patch("/enrollments/" + enrollment.path("id").stringValue(), Map.of("version", 0, "status", "WITHDRAWN", "reason", "Test leave"));
            assertThat(parent.get(familyPath).body().path("meta").path("totalElements").intValue()).isZero();
            teacher.patch("/enrollments/" + enrollment.path("id").stringValue(), Map.of("version", 1, "status", "ACTIVE", "reason", "Test return"));
            var archived = teacher.post(path + "/archive", Map.of("version", active.path("version").longValue())).data();
            assertThat(parent.get(familyPath).data().size()).isZero();
            var restored = teacher.post(path + "/restore", Map.of("version", archived.path("version").longValue())).data();
            teacher.post(path + "/complete", Map.of("version", restored.path("version").longValue()));
            assertThat(parent.get(familyPath).data().get(0).path("status").stringValue()).isEqualTo("COMPLETED");
            assertThat(parent.get(familyPath).body().toString()).doesNotContain("internalNote", "teacherId", "studentName", "password");
            assertThat(parent.get("/family/children?size=101").status()).isEqualTo(400);
        }
    }

    @Test
    void resendInvalidatesOldVerificationLinksAndTokenPurposesCannotBeSwapped() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            var invitation = invite(teacher, child(teacher, "Resend child"), PARENT);
            register(parent, PARENT, invitation.raw());
            String old = mailToken(PARENT);
            parent.post("/auth/login", credentials(PARENT));
            assertThat(parent.post("/auth/email-verifications", Map.of("invitationToken", invitation.raw())).status()).isEqualTo(200);
            String fresh = mailToken(PARENT);
            assertThat(fresh).isNotEqualTo(old);
            assertThat(parent.post("/auth/email-verifications/confirm", Map.of("token", old)).status()).isEqualTo(400);
            assertThat(parent.post("/auth/password-resets", Map.of("token", fresh, "password", PASSWORD)).status()).isEqualTo(400);
            assertThat(parent.post("/auth/email-verifications/confirm", Map.of("token", fresh)).status()).isEqualTo(200);
        }
    }

    @Test
    void passwordResetHasGenericRequestsAndRevokesExistingSessions() throws Exception {
        seedParent(PARENT);
        try (var parent = login(PARENT); var anonymous = browser()) {
            var absent = anonymous.post("/auth/password-reset-requests", Map.of("email", "absent@example.test"));
            var existing = anonymous.post("/auth/password-reset-requests", Map.of("email", PARENT));
            assertThat(absent.status()).isEqualTo(202);
            assertThat(existing.status()).isEqualTo(absent.status());
            assertThat(existing.body()).isEqualTo(absent.body());
            String token = mailToken(PARENT), changed = "A-new-synthetic-password-2026";
            assertThat(anonymous.post("/auth/email-verifications/confirm", Map.of("token", token)).status()).isEqualTo(400);
            assertThat(anonymous.write("POST", "/auth/password-resets", Map.of("token", token, "password", changed), false).status()).isEqualTo(403);
            assertThat(anonymous.post("/auth/password-resets", Map.of("token", token, "password", changed)).status()).isEqualTo(200);
            assertThat(parent.get("/auth/me").status()).isEqualTo(401);
            assertThat(anonymous.post("/auth/login", credentials(PARENT)).status()).isEqualTo(401);
            assertThat(anonymous.post("/auth/login", Map.of("email", PARENT, "password", changed)).status()).isEqualTo(200);
            assertThat(anonymous.post("/auth/password-resets", Map.of("token", token, "password", PASSWORD)).status()).isEqualTo(400);
        }
    }

    @Test
    void expiredEmailTokensAndDisabledAccountsCannotConsumeLinks() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            var invitation = invite(teacher, child(teacher, "Expired email child"), PARENT);
            register(parent, PARENT, invitation.raw());
            String token = mailToken(PARENT);
            jdbc.update("update auth_tokens set expires_at = now() - interval '1 second'");
            assertThat(parent.post("/auth/email-verifications/confirm", Map.of("token", token)).status()).isEqualTo(400);
            parent.post("/auth/login", credentials(PARENT));
            parent.post("/auth/email-verifications", Map.of());
            String disabled = mailToken(PARENT);
            jdbc.update("update users set status='DISABLED' where email=?", PARENT);
            try (var anonymous = browser()) {
                assertThat(anonymous.post("/auth/email-verifications/confirm", Map.of("token", disabled)).status()).isEqualTo(400);
            }
            assertThat(parent.get("/family/children").status()).isEqualTo(401);
        }
    }

    @Test
    void failedSmtpDoesNotLeaveAPartiallyRegisteredParent() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            var invitation = invite(teacher, child(teacher, "SMTP failure child"), PARENT);
            var sender = (JavaMailSenderImpl) mailSender;
            int savedPort = sender.getPort();
            try {
                sender.setPort(1);
                var failure = register(parent, PARENT, invitation.raw());
                assertThat(failure.status()).isEqualTo(503);
                assertThat(failure.body().toString()).doesNotContain("smtp", "token=", PASSWORD);
                assertThat(users.findByEmail(PARENT)).isEmpty();
                assertThat(jdbc.queryForObject("select count(*) from auth_tokens", Integer.class)).isZero();
            } finally { sender.setPort(savedPort); }
            assertThat(register(parent, PARENT, invitation.raw()).status()).isEqualTo(201);
        }
    }

    private void seedParent(String email) { var parent = new UserAccount(email, passwords.encode(PASSWORD), "Synthetic parent", "PARENT"); parent.verifyEmail(); users.saveAndFlush(parent); }
    private ApiBrowser browser() { return new ApiBrowser("http://127.0.0.1:" + environment.getRequiredProperty("local.server.port"), json); }
    private ApiBrowser login(String email) throws Exception { var client = browser(); assertThat(client.post("/auth/login", credentials(email)).status()).isEqualTo(200); return client; }
    private Map<String, String> credentials(String email) { return Map.of("email", email, "password", PASSWORD); }
    private String child(ApiBrowser teacher, String name) throws Exception {
        var result = teacher.post("/students", Map.of("fullName", name, "internalNote", "TEACHER_PRIVATE_NOTE"));
        assertThat(result.status()).isEqualTo(201); return result.data().path("id").stringValue();
    }
    private record Invitation(String id, String raw) {}
    private Invitation invite(ApiBrowser teacher, String child, String email) throws Exception {
        var result = teacher.post("/students/" + child + "/guardian-invitations", Map.of("email", email));
        assertThat(result.status()).isEqualTo(201);
        String fragment = URI.create(result.data().path("inviteUrl").stringValue()).getFragment();
        return new Invitation(result.data().path("invitation").path("id").stringValue(), fragment.substring("token=".length()));
    }
    private Result register(ApiBrowser parent, String email, String invitation) throws Exception {
        return parent.post("/auth/register", Map.of("email", email, "password", PASSWORD, "displayName", "Synthetic parent", "invitationToken", invitation));
    }
    private Result accept(ApiBrowser parent, Invitation invitation) throws Exception {
        var result = parent.post("/guardian-invitations/accept", Map.of("token", invitation.raw()));
        assertThat(result.status()).isEqualTo(200); return result;
    }
    private Result acceptAfter(ApiBrowser client, String raw, CountDownLatch start) {
        try { start.await(); return client.post("/guardian-invitations/accept", Map.of("token", raw)); }
        catch (Exception exception) { throw new CompletionException(exception); }
    }
    private String mailToken(String email) throws Exception {
        try (var http = HttpClient.newHttpClient()) {
            var response = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18026/view/latest.txt?query="
                    + URLEncoder.encode("to:" + email, StandardCharsets.UTF_8))).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            var match = Pattern.compile("#token=([A-Za-z0-9_-]{43})").matcher(response.body());
            assertThat(match.find()).isTrue(); return match.group(1);
        }
    }
}
