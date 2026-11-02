package com.tinyclass;

import com.tinyclass.auth.*;
import com.tinyclass.support.*;
import com.tinyclass.support.MockOidcProvider.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "tinyclass.auth.attempt-limit=1000", "tinyclass.mail.cooldown-seconds=0"
})
@ActiveProfiles({"test", "oauth-test"})
@Import(MockOidcConfiguration.class)
class GoogleOidcTests {
    private static final String TEACHER = "oauth-teacher@example.test", PASSWORD = "Synthetic-oidc-password-2026";
    @Autowired Environment environment; @Autowired JsonMapper json; @Autowired JdbcTemplate jdbc;
    @Autowired UserAccountRepository users; @Autowired PasswordEncoder passwords; @Autowired MockOidcProvider provider;

    @BeforeEach
    void resetOnlyDedicatedTestData() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE auth_identities, auth_tokens, guardian_invitations, student_guardians, class_enrollments, classes, students, audit_events, users CASCADE");
        users.saveAndFlush(new UserAccount(TEACHER, passwords.encode(PASSWORD), "Synthetic teacher", "TEACHER"));
        provider.scenario(Scenario.trusted("parent-subject", "qa-parent@gmail.com"));
    }

    @Test
    void trustedGoogleRegistrationCreatesOneParentIdentityAndChildLinkWithoutAPassword() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            var invitation = invitation(teacher, "qa-parent@gmail.com");
            var result = flow(parent, Map.of("intent", "REGISTER", "invitationToken", invitation));
            assertThat(result.data().path("status").stringValue()).isEqualTo("SUCCESS");
            var me = parent.get("/auth/me");
            assertThat(me.status()).isEqualTo(200);
            assertThat(me.data().path("role").stringValue()).isEqualTo("PARENT");
            assertThat(me.data().path("emailVerifiedAt").isNull()).isFalse();
            var user = users.findByEmail("qa-parent@gmail.com").orElseThrow();
            assertThat(user.getPasswordHash()).isNull();
            assertThat(jdbc.queryForObject("select count(*) from auth_identities", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from student_guardians", Integer.class)).isEqualTo(1);
            assertThat(parent.get("/family/children").data().size()).isEqualTo(1);
            assertThat(parent.get("/classes").status()).isEqualTo(403);
            assertThat(result.data().toString()).doesNotContain("id_token", "access_token", "parent-subject", "synthetic-access");
            assertThat(parent.get("/auth/methods").data().path("hasPassword").asBoolean()).isFalse();
        }
    }

    @Test
    void workspaceHdCanVerifyEmailButExternalGoogleEmailStillNeedsTheApplicationChallenge() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            provider.scenario(new Scenario("workspace", "parent@school.example.test", true, "school.example.test", "Workspace parent", Fault.NONE));
            var invitation = invitation(teacher, "parent@school.example.test");
            assertThat(flow(parent, Map.of("intent", "REGISTER", "invitationToken", invitation)).data().path("status").stringValue()).isEqualTo("SUCCESS");
            assertThat(parent.get("/family/children").data().size()).isEqualTo(1);
        }
    }

    @Test
    void thirdPartyEmailRequiresSmtpVerificationBeforeAcceptingTheInvitation() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            String email = "external-parent@example.test";
            provider.scenario(new Scenario("external", email, true, null, "External parent", Fault.NONE));
            String invitation = invitation(teacher, email);
            assertThat(flow(parent, Map.of("intent", "REGISTER", "invitationToken", invitation)).data().path("status").stringValue()).isEqualTo("SUCCESS");
            assertThat(parent.get("/auth/me").data().path("emailVerifiedAt").isNull()).isTrue();
            assertThat(parent.get("/family/children").status()).isEqualTo(403);
            assertThat(jdbc.queryForObject("select count(*) from student_guardians", Integer.class)).isZero();
            assertThat(parent.post("/auth/email-verifications/confirm", Map.of("token", mailToken(email))).status()).isEqualTo(200);
            assertThat(parent.post("/guardian-invitations/accept", Map.of("token", invitation)).status()).isEqualTo(200);
            assertThat(parent.get("/family/children").data().size()).isEqualTo(1);
        }
    }

    @Test
    void aMatchingEmailDoesNotMergeUntilTheOwnerReauthenticatesAndLinks() throws Exception {
        provider.scenario(Scenario.trusted("teacher-google", TEACHER));
        try (var teacher = login(TEACHER); var stranger = browser()) {
            String originalId = teacher.get("/auth/me").data().path("id").stringValue();
            var collision = flow(stranger, Map.of("intent", "LOGIN"));
            assertThat(collision.data().path("code").stringValue()).isEqualTo("ACCOUNT_LINK_REQUIRED");
            assertThat(stranger.get("/auth/me").status()).isEqualTo(401);
            assertThat(teacher.post("/auth/google/start", Map.of("intent", "LINK")).body().path("code").stringValue()).isEqualTo("REAUTHENTICATION_REQUIRED");
            assertThat(teacher.post("/auth/reauthenticate", Map.of("password", "wrong-password")).status()).isEqualTo(401);
            assertThat(teacher.get("/auth/me").status()).isEqualTo(200);
            assertThat(teacher.post("/auth/reauthenticate", Map.of("password", PASSWORD)).status()).isEqualTo(200);
            assertThat(flow(teacher, Map.of("intent", "LINK")).data().path("status").stringValue()).isEqualTo("SUCCESS");
            assertThat(teacher.get("/auth/me").data().path("id").stringValue()).isEqualTo(originalId);
            assertThat(flow(stranger, Map.of("intent", "LOGIN")).data().path("status").stringValue()).isEqualTo("SUCCESS");
            assertThat(stranger.get("/auth/me").data().path("id").stringValue()).isEqualTo(originalId);
            assertThat(stranger.get("/auth/me").data().path("role").stringValue()).isEqualTo("TEACHER");
            assertThat(stranger.get("/auth/methods").body().toString()).doesNotContain("providerSubject", "teacher-google", "access_token");
        }
    }

    @Test
    void newGoogleIdentitiesNeedAnInvitationAndCannotRegisterForAnotherRecipient() throws Exception {
        try (var teacher = login(TEACHER); var guest = browser()) {
            assertThat(guest.post("/auth/google/start", Map.of("intent", "REGISTER")).status()).isEqualTo(400);
            assertThat(flow(guest, Map.of("intent", "LOGIN")).data().path("code").stringValue()).isEqualTo("INVITATION_REQUIRED");
            String invitation = invitation(teacher, "different@gmail.com");
            var result = flow(guest, Map.of("intent", "REGISTER", "invitationToken", invitation));
            assertThat(result.data().path("code").stringValue()).isEqualTo("INVITATION_EMAIL_MISMATCH");
            assertThat(jdbc.queryForObject("select count(*) from auth_identities", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from users where role='PARENT'", Integer.class)).isZero();
        }
    }

    @ParameterizedTest
    @EnumSource(value = Fault.class, names = {"STATE", "NONCE", "AUDIENCE", "ISSUER", "SIGNATURE", "EXPIRED"})
    void realOidcValidationRejectsTamperedResponsesWithoutCreatingAccounts(Fault fault) throws Exception {
        provider.scenario(Scenario.trusted("parent-subject", "qa-parent@gmail.com").withFault(fault));
        try (var teacher = login(TEACHER); var guest = browser()) {
            var result = flow(guest, Map.of("intent", "REGISTER", "invitationToken", invitation(teacher, "qa-parent@gmail.com")));
            assertThat(result.data().path("status").stringValue()).isEqualTo("ERROR");
            assertThat(guest.get("/auth/me").status()).isEqualTo(401);
            assertThat(jdbc.queryForObject("select count(*) from auth_identities", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from student_guardians", Integer.class)).isZero();
        }
    }

    @Test
    void callbackReplayCannotLogInAnotherBrowser() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser(); var replay = browser()) {
            var original = flow(parent, Map.of("intent", "REGISTER", "invitationToken", invitation(teacher, "qa-parent@gmail.com")));
            replay.rawGet(original.callback());
            assertThat(replay.get("/auth/google/result").data().path("status").stringValue()).isEqualTo("ERROR");
            assertThat(replay.get("/auth/me").status()).isEqualTo(401);
            assertThat(jdbc.queryForObject("select count(*) from auth_identities", Integer.class)).isEqualTo(1);
        }
    }

    @Test
    void cancellingGoogleReauthenticationKeepsTheExistingAccountSession() throws Exception {
        provider.scenario(Scenario.trusted("teacher-google", TEACHER));
        try (var teacher = login(TEACHER)) {
            linkTeacher(teacher);
            provider.scenario(Scenario.trusted("teacher-google", TEACHER).withFault(Fault.CANCEL));
            var result = flow(teacher, Map.of("intent", "REAUTHENTICATE"));
            assertThat(result.data().path("status").stringValue()).isEqualTo("ERROR");
            assertThat(teacher.get("/auth/me").data().path("email").stringValue()).isEqualTo(TEACHER);
        }
    }

    @Test
    void disabledAccountsCannotUseAnOtherwiseValidGoogleIdentity() throws Exception {
        provider.scenario(Scenario.trusted("teacher-google", TEACHER));
        try (var teacher = login(TEACHER); var browser = browser()) {
            linkTeacher(teacher);
            jdbc.update("update users set status='DISABLED' where email=?", TEACHER);
            var result = flow(browser, Map.of("intent", "LOGIN"));
            assertThat(result.data().path("status").stringValue()).isEqualTo("ERROR");
            assertThat(browser.get("/auth/me").status()).isEqualTo(401);
        }
    }

    @Test
    void googleReauthenticationMustMatchTheAlreadyLinkedSubject() throws Exception {
        provider.scenario(Scenario.trusted("teacher-google", TEACHER));
        try (var teacher = login(TEACHER)) {
            linkTeacher(teacher);
            provider.scenario(Scenario.trusted("another-subject", "other@gmail.com"));
            var mismatch = flow(teacher, Map.of("intent", "REAUTHENTICATE"));
            assertThat(mismatch.data().path("code").stringValue()).isEqualTo("GOOGLE_REAUTHENTICATION_MISMATCH");
            assertThat(teacher.get("/auth/methods").data().path("reauthenticated").asBoolean()).isFalse();
            assertThat(teacher.get("/auth/me").status()).isEqualTo(200);
        }
    }

    @Test
    void googleOnlyAccountsNeedEmailSetupAndCannotRemoveTheirLastLoginMethod() throws Exception {
        try (var teacher = login(TEACHER); var parent = browser()) {
            flow(parent, Map.of("intent", "REGISTER", "invitationToken", invitation(teacher, "qa-parent@gmail.com")));
            String identity = parent.get("/auth/methods").data().path("google").path("id").stringValue();
            assertThat(flow(parent, Map.of("intent", "REAUTHENTICATE")).data().path("status").stringValue()).isEqualTo("SUCCESS");
            assertThat(parent.post("/auth/identities/" + identity + "/unlink", Map.of()).body().path("code").stringValue()).isEqualTo("LAST_LOGIN_METHOD");
            assertThat(parent.post("/auth/password-reset-requests", Map.of("email", "qa-parent@gmail.com")).status()).isEqualTo(202);
            assertThat(users.findByEmail("qa-parent@gmail.com").orElseThrow().getPasswordHash()).isNull();
            assertThat(parent.post("/auth/password-setup-requests", Map.of()).body().path("code").stringValue()).isEqualTo("REAUTHENTICATION_REQUIRED");
            flow(parent, Map.of("intent", "REAUTHENTICATE"));
            assertThat(parent.post("/auth/password-setup-requests", Map.of()).status()).isEqualTo(200);
            String raw = mailToken("qa-parent@gmail.com");
            assertThat(parent.post("/auth/password-resets", Map.of("token", raw, "password", PASSWORD)).status()).isEqualTo(400);
            try (var other = browser()) {
                provider.scenario(Scenario.trusted("other-parent", "other-parent@gmail.com"));
                flow(other, Map.of("intent", "REGISTER", "invitationToken", invitation(teacher, "other-parent@gmail.com")));
                assertThat(other.post("/auth/password-setups", Map.of("token", raw, "password", PASSWORD)).status()).isEqualTo(400);
            }
            provider.scenario(Scenario.trusted("parent-subject", "qa-parent@gmail.com"));
            assertThat(parent.post("/auth/password-setups", Map.of("token", raw, "password", PASSWORD)).status()).isEqualTo(200);
            assertThat(parent.get("/auth/me").status()).isEqualTo(401);
            try (var newLogin = login("qa-parent@gmail.com")) {
                assertThat(newLogin.get("/auth/methods").data().path("hasPassword").asBoolean()).isTrue();
                assertThat(newLogin.post("/auth/reauthenticate", Map.of("password", PASSWORD)).status()).isEqualTo(200);
                assertThat(newLogin.post("/auth/identities/" + identity + "/unlink", Map.of()).status()).isEqualTo(200);
                assertThat(newLogin.get("/auth/me").status()).isEqualTo(401);
            }
            try (var other = browser()) {
                assertThat(flow(other, Map.of("intent", "LOGIN")).data().path("code").stringValue()).isEqualTo("ACCOUNT_LINK_REQUIRED");
            }
        }
    }

    private void linkTeacher(ApiBrowser teacher) throws Exception {
        teacher.post("/auth/reauthenticate", Map.of("password", PASSWORD));
        assertThat(flow(teacher, Map.of("intent", "LINK")).data().path("status").stringValue()).isEqualTo("SUCCESS");
    }
    private record Flow(JsonNode data, String callback) {}
    private Flow flow(ApiBrowser browser, Map<String, Object> input) throws Exception {
        var start = browser.post("/auth/google/start", input);
        assertThat(start.status()).isEqualTo(200);
        var authorization = browser.rawGet("/auth/google/authorize");
        assertThat(authorization.statusCode()).isEqualTo(302);
        String providerUrl = authorization.headers().firstValue("Location").orElseThrow();
        var params = parameters(URI.create(providerUrl).getRawQuery());
        assertThat(Set.of(params.get("scope").split(" "))).containsExactlyInAnyOrder("openid", "email", "profile");
        assertThat(params).containsKeys("state", "nonce", "code_challenge");
        assertThat(params.get("code_challenge_method")).isEqualTo("S256");
        var response = browser.rawGet(providerUrl);
        assertThat(response.statusCode()).isEqualTo(302);
        String callback = response.headers().firstValue("Location").orElseThrow();
        assertThat(browser.rawGet(callback).statusCode()).isEqualTo(302);
        return new Flow(browser.get("/auth/google/result").data(), callback);
    }
    private ApiBrowser browser() { return new ApiBrowser("http://127.0.0.1:" + environment.getRequiredProperty("local.server.port"), json); }
    private ApiBrowser login(String email) throws Exception {
        var client = browser(); assertThat(client.post("/auth/login", Map.of("email", email, "password", PASSWORD)).status()).isEqualTo(200); return client;
    }
    private String invitation(ApiBrowser teacher, String email) throws Exception {
        var student = teacher.post("/students", Map.of("fullName", "Google child", "internalNote", "PRIVATE_GOOGLE_TEST_NOTE")).data();
        var invitation = teacher.post("/students/" + student.path("id").stringValue() + "/guardian-invitations", Map.of("email", email));
        assertThat(invitation.status()).isEqualTo(201);
        return parameters(URI.create(invitation.data().path("inviteUrl").stringValue()).getFragment()).get("token");
    }
    private Map<String, String> parameters(String query) {
        var result = new HashMap<String, String>();
        for (var item : query.split("&")) { var pair = item.split("=", 2); result.put(URLDecoder.decode(pair[0], StandardCharsets.UTF_8), pair.length > 1 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : ""); }
        return result;
    }
    private String mailToken(String email) throws Exception {
        try (var http = HttpClient.newHttpClient()) {
            var response = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18026/view/latest.txt?query="
                    + URLEncoder.encode("to:" + email, StandardCharsets.UTF_8))).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            var matcher = Pattern.compile("#token=([A-Za-z0-9_-]{43})").matcher(response.body());
            assertThat(matcher.find()).isTrue(); return matcher.group(1);
        }
    }
}
