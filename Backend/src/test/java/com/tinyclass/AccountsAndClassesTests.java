package com.tinyclass;

import com.tinyclass.auth.UserAccount;
import com.tinyclass.auth.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "tinyclass.auth.setup-key=integration-only-setup-secret-0123456789",
        "tinyclass.auth.attempt-limit=1000"
})
@ActiveProfiles("test")
class AccountsAndClassesTests {
    private static final String KEY = "integration-only-setup-secret-0123456789";
    private static final String EMAIL = "teacher@example.test";
    private static final String PASSWORD = "Synthetic-test-password-2026";
    @Autowired Environment environment;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired UserAccountRepository users;
    @Autowired PasswordEncoder passwords;

    @BeforeEach
    void resetOnlyTheDedicatedTestDatabase() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE class_enrollments, classes, students, audit_events, users CASCADE");
    }

    @Test
    void firstTeacherNeedsCsrfAndSetupKeyAndCannotBeCreatedTwice() throws Exception {
        try (var client = new Browser()) {
            assertThat(client.get("/auth/setup-status").data().path("setupRequired").asBoolean()).isTrue();
            assertThat(client.write("POST", "/auth/setup", setupInput(KEY), false).status()).isEqualTo(403);
            assertThat(client.post("/auth/setup", setupInput("incorrect-key")).status()).isEqualTo(403);
            var setup = client.post("/auth/setup", setupInput(KEY));
            assertThat(setup.status()).isEqualTo(201);
            assertThat(setup.data().path("email").stringValue()).isEqualTo(EMAIL);
            assertThat(setup.body().toString()).doesNotContain("password", KEY);
            String storedHash = jdbc.queryForObject("select password_hash from users", String.class);
            assertThat(storedHash).isNotEqualTo(PASSWORD);
            assertThat(passwords.matches(PASSWORD, storedHash)).isTrue();
            assertThat(client.post("/auth/setup", setupInput(KEY)).status()).isEqualTo(409);
            assertThat(jdbc.queryForObject("select count(*) from users where role = 'TEACHER'", Integer.class)).isEqualTo(1);
            assertThat(client.get("/auth/setup-status").data().path("setupRequired").asBoolean()).isFalse();
        }
    }

    @Test
    void loginIsGenericForUnknownWrongAndDisabledCredentials() throws Exception {
        seedTeacher();
        try (var client = new Browser()) {
            var wrong = client.post("/auth/login", Map.of("email", EMAIL, "password", "wrong-password"));
            var unknown = client.post("/auth/login", Map.of("email", "unknown@example.test", "password", PASSWORD));
            jdbc.update("update users set status = 'DISABLED'");
            var disabled = client.post("/auth/login", Map.of("email", EMAIL, "password", PASSWORD));
            for (var result : List.of(wrong, unknown, disabled)) {
                assertThat(result.status()).isEqualTo(401);
                assertThat(result.body().path("code").stringValue()).isEqualTo("INVALID_CREDENTIALS");
            }
            assertThat(client.get("/auth/me").status()).isEqualTo(401);
        }
    }

    @Test
    void loginRotatesSessionAndCsrfAndLogoutEndsAccess() throws Exception {
        seedTeacher();
        try (var client = new Browser()) {
            var csrf = client.get("/auth/csrf");
            String initialSession = client.sessionId();
            var login = client.post("/auth/login", Map.of("email", EMAIL.toUpperCase(Locale.ROOT), "password", PASSWORD));
            assertThat(login.status()).isEqualTo(200);
            assertThat(login.headers().allValues("Set-Cookie").toString()).contains("HttpOnly", "SameSite=Lax");
            assertThat(client.sessionId()).isNotEqualTo(initialSession);
            assertThat(client.get("/auth/me").data().path("role").stringValue()).isEqualTo("TEACHER");
            assertThat(client.rawWrite("POST", "/classes", Map.of("name", "Expired CSRF"),
                    csrf.data().path("headerName").stringValue(), csrf.data().path("token").stringValue()).status()).isEqualTo(403);
            assertThat(client.post("/classes", Map.of("name", "Valid new CSRF")).status()).isEqualTo(201);
            assertThat(client.write("POST", "/auth/logout", Map.of(), false).status()).isEqualTo(403);
            assertThat(client.post("/auth/logout", Map.of()).status()).isEqualTo(200);
            assertThat(client.get("/auth/me").status()).isEqualTo(401);
            assertThat(client.get("/classes").status()).isEqualTo(401);
        }
    }

    @Test
    void disablingAnAccountRevokesItsExistingSessionOnTheNextRequest() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            jdbc.update("update users set status = 'DISABLED' where email = ?", EMAIL);
            var response = client.get("/students");
            assertThat(response.status()).isEqualTo(401);
            assertThat(response.body().toString()).doesNotContain(EMAIL, "internalNote");
            assertThat(client.get("/auth/me").status()).isEqualTo(401);
        }
    }

    @Test
    void parentsCannotReadTeacherListsNotesOrWriteTeacherData() throws Exception {
        seedTeacher();
        users.saveAndFlush(new UserAccount("parent@example.test", passwords.encode(PASSWORD), "Test parent", "PARENT"));
        try (var client = new Browser()) {
            assertThat(client.post("/auth/login", Map.of("email", "parent@example.test", "password", PASSWORD)).status()).isEqualTo(200);
            assertThat(client.get("/auth/me").data().path("role").stringValue()).isEqualTo("PARENT");
            assertThat(client.get("/classes").status()).isEqualTo(403);
            assertThat(client.get("/students").status()).isEqualTo(403);
            assertThat(client.post("/students", Map.of("fullName", "Unauthorized child")).status()).isEqualTo(403);
            assertThat(jdbc.queryForObject("select count(*) from students", Integer.class)).isZero();
        }
    }

    @Test
    void validationRejectsInvalidClassDatesAgesPaginationAndIds() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            var validation = client.post("/classes", Map.of("name", " ", "capacity", 0));
            assertThat(validation.status()).isEqualTo(400);
            assertThat(validation.body().path("fieldErrors").size()).isEqualTo(2);
            assertThat(client.post("/classes", Map.of("name", "Wrong ages", "minAgeMonths", 60, "maxAgeMonths", 36)).status()).isEqualTo(400);
            assertThat(client.post("/classes", Map.of("name", "Wrong dates", "startDate", "2026-12-02", "endDate", "2026-12-01")).status()).isEqualTo(400);
            assertThat(client.get("/classes?size=101").status()).isEqualTo(400);
            assertThat(client.get("/classes?status=UNKNOWN").status()).isEqualTo(400);
            assertThat(client.get("/classes/not-a-uuid").status()).isEqualTo(400);
            assertThat(client.post("/students", Map.of("fullName", "Future child", "birthDate", "2999-01-01")).status()).isEqualTo(400);
        }
    }

    @Test
    void withdrawalAndReturnKeepTheSameEnrollmentAndAnAuditHistory() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            var classroom = client.post("/classes", Map.of("name", "Little explorers", "capacity", 2)).data();
            String classId = id(classroom);
            assertThat(classroom.path("status").stringValue()).isEqualTo("DRAFT");
            assertThat(client.post("/classes/" + classId + "/activate", version(classroom)).data().path("status").stringValue()).isEqualTo("ACTIVE");
            String childId = id(client.post("/students", Map.of("fullName", "Synthetic child", "internalNote", "Teacher-only note")).data());
            var enrollment = client.post("/classes/" + classId + "/enrollments", Map.of("studentId", childId)).data();
            String enrollmentId = id(enrollment);
            assertThat(client.post("/classes/" + classId + "/enrollments", Map.of("studentId", childId)).status()).isEqualTo(409);
            var withdrawn = client.patch("/enrollments/" + enrollmentId, Map.of("version", 0, "status", "WITHDRAWN", "reason", "Family break")).data();
            assertThat(withdrawn.path("endedAt").isNull()).isFalse();
            var returned = client.patch("/enrollments/" + enrollmentId, Map.of("version", 1, "status", "ACTIVE", "reason", "Returned after break")).data();
            assertThat(id(returned)).isEqualTo(enrollmentId);
            assertThat(returned.path("joinedAt")).isEqualTo(enrollment.path("joinedAt"));
            assertThat(returned.path("endedAt").isNull()).isTrue();
            assertThat(client.patch("/enrollments/" + enrollmentId, Map.of("version", 0, "status", "WITHDRAWN", "reason", "Stale edit")).status()).isEqualTo(409);
            var history = client.get("/enrollments/" + enrollmentId + "/history");
            assertThat(history.body().path("meta").path("totalElements").intValue()).isEqualTo(3);
            assertThat(client.get("/students/" + childId + "/classes").data().size()).isEqualTo(1);
            assertThat(client.get("/classes/" + classId).data().path("activeStudents").intValue()).isEqualTo(1);
        }
    }

    @Test
    void oneStudentCanJoinSeveralClassesWithoutDuplicatingTheStudent() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            String child = id(client.post("/students", Map.of("fullName", "Same-name child")).data());
            String first = id(client.post("/classes", Map.of("name", "Class A")).data());
            String second = id(client.post("/classes", Map.of("name", "Class B")).data());
            assertThat(client.post("/classes/" + first + "/enrollments", Map.of("studentId", child)).status()).isEqualTo(201);
            assertThat(client.post("/classes/" + second + "/enrollments", Map.of("studentId", child)).status()).isEqualTo(201);
            assertThat(jdbc.queryForObject("select count(*) from students", Integer.class)).isEqualTo(1);
            assertThat(client.get("/students/" + child + "/classes").data().size()).isEqualTo(2);
            assertThat(client.post("/students", Map.of("fullName", "Same-name child")).status()).isEqualTo(201);
        }
    }

    @Test
    void archivedClassesRestoreTheirPreviousStateAndCompletedClassesRejectNewMembers() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            var classroom = client.post("/classes", Map.of("name", "Lifecycle class")).data();
            String path = "/classes/" + id(classroom);
            String child = id(client.post("/students", Map.of("fullName", "Lifecycle child")).data());
            client.post(path + "/enrollments", Map.of("studentId", child));
            var active = client.post(path + "/activate", version(classroom)).data();
            var archived = client.post(path + "/archive", version(active)).data();
            assertThat(client.post(path + "/enrollments", Map.of("studentId", child)).status()).isEqualTo(409);
            var restored = client.post(path + "/restore", version(archived)).data();
            assertThat(restored.path("status").stringValue()).isEqualTo("ACTIVE");
            var completed = client.post(path + "/complete", version(restored)).data();
            assertThat(completed.path("activeStudents").intValue()).isZero();
            assertThat(client.get(path + "/enrollments").data().get(0).path("status").stringValue()).isEqualTo("COMPLETED");
            assertThat(client.post(path + "/enrollments", Map.of("studentId", child)).status()).isEqualTo(409);
            assertThat(client.post(path + "/activate", version(completed)).status()).isEqualTo(409);
        }
    }

    @Test
    void staleEditsAndCapacityShrinksDoNotOverwriteCommittedData() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            var classroom = client.post("/classes", Map.of("name", "Capacity", "capacity", 2)).data();
            String path = "/classes/" + id(classroom);
            for (int index = 0; index < 2; index++) client.post(path + "/enrollments", Map.of("studentId",
                    id(client.post("/students", Map.of("fullName", "Child " + index)).data())));
            assertThat(client.patch(path, Map.of("name", "Invalid shrink", "capacity", 1, "version", 0)).status()).isEqualTo(409);
            assertThat(client.patch(path, Map.of("name", "Updated name", "capacity", 3, "version", 0)).status()).isEqualTo(200);
            assertThat(client.patch(path, Map.of("name", "Stale name", "capacity", 4, "version", 0)).status()).isEqualTo(409);
            var detail = client.get(path).data();
            assertThat(detail.path("name").stringValue()).isEqualTo("Updated name");
            assertThat(detail.path("capacity").intValue()).isEqualTo(3);
        }
    }

    @Test
    void finalSeatCannotBeOverbookedByConcurrentRequests() throws Exception {
        seedTeacher();
        try (var first = signedIn(); var second = signedIn()) {
            String path = "/classes/" + id(first.post("/classes", Map.of("name", "One seat", "capacity", 1)).data()) + "/enrollments";
            String a = id(first.post("/students", Map.of("fullName", "Seat A")).data());
            String b = id(first.post("/students", Map.of("fullName", "Seat B")).data());
            var start = new CountDownLatch(1);
            var aResult = CompletableFuture.supplyAsync(() -> concurrentEnroll(first, path, a, start));
            var bResult = CompletableFuture.supplyAsync(() -> concurrentEnroll(second, path, b, start));
            start.countDown();
            var results = List.of(aResult.get(15, TimeUnit.SECONDS), bResult.get(15, TimeUnit.SECONDS));
            assertThat(results.stream().map(Result::status)).containsExactlyInAnyOrder(201, 409);
            assertThat(results.stream().filter(r -> r.status() == 409).findFirst().orElseThrow().body()
                    .path("code").stringValue()).isEqualTo("CLASS_FULL");
            assertThat(jdbc.queryForObject("select count(*) from class_enrollments where status = 'ACTIVE'", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from audit_events where action = 'ENROLLMENT_CREATED'", Integer.class)).isEqualTo(1);
        }
    }

    @Test
    void concurrentDuplicateEnrollmentCreatesOnlyOneRelationship() throws Exception {
        seedTeacher();
        try (var first = signedIn(); var second = signedIn()) {
            String path = "/classes/" + id(first.post("/classes", Map.of("name", "Duplicate race")).data()) + "/enrollments";
            String child = id(first.post("/students", Map.of("fullName", "One shared child")).data());
            var start = new CountDownLatch(1);
            var a = CompletableFuture.supplyAsync(() -> concurrentEnroll(first, path, child, start));
            var b = CompletableFuture.supplyAsync(() -> concurrentEnroll(second, path, child, start));
            start.countDown();
            var results = List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
            assertThat(results.stream().map(Result::status)).containsExactlyInAnyOrder(201, 409);
            assertThat(results.stream().filter(r -> r.status() == 409).findFirst().orElseThrow().body()
                    .path("code").stringValue()).isEqualTo("ALREADY_ENROLLED");
            assertThat(jdbc.queryForObject("select count(*) from class_enrollments", Integer.class)).isEqualTo(1);
        }
    }

    @Test
    void foreignResourcesReturn404AndCannotBeUsedForEnrollment() throws Exception {
        seedTeacher();
        var foreignOwner = users.saveAndFlush(new UserAccount("other@example.test", passwords.encode(PASSWORD), "Other owner", "PARENT"));
        UUID child = UUID.randomUUID(), classroom = UUID.randomUUID();
        jdbc.update("insert into students(id, teacher_id, full_name, status, created_at, updated_at) values (?, ?, 'Foreign child', 'ACTIVE', now(), now())", child, foreignOwner.getId());
        jdbc.update("insert into classes(id, teacher_id, name, status, created_at, updated_at) values (?, ?, 'Foreign class', 'DRAFT', now(), now())", classroom, foreignOwner.getId());
        try (var client = signedIn()) {
            assertThat(client.get("/students/" + child).status()).isEqualTo(404);
            assertThat(client.get("/classes/" + classroom).status()).isEqualTo(404);
            String owned = id(client.post("/classes", Map.of("name", "Owned class")).data());
            assertThat(client.post("/classes/" + owned + "/enrollments", Map.of("studentId", child)).status()).isEqualTo(404);
            assertThat(client.get("/classes").body().path("meta").path("totalElements").intValue()).isEqualTo(1);
            assertThat(client.get("/students").data().size()).isZero();
        }
    }

    @Test
    void studentArchivalRequiresLeavingActiveEnrollmentsAndKeepsHistory() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            var student = client.post("/students", Map.of("fullName", "Archive child")).data();
            String childPath = "/students/" + id(student);
            String classroom = id(client.post("/classes", Map.of("name", "Archive class")).data());
            String enrollment = id(client.post("/classes/" + classroom + "/enrollments", Map.of("studentId", id(student))).data());
            assertThat(client.post(childPath + "/archive", version(student)).status()).isEqualTo(409);
            client.patch("/enrollments/" + enrollment, Map.of("version", 0, "status", "WITHDRAWN", "reason", "Finished"));
            var archived = client.post(childPath + "/archive", version(student)).data();
            assertThat(archived.path("status").stringValue()).isEqualTo("ARCHIVED");
            assertThat(client.post(childPath + "/restore", version(archived)).data().path("status").stringValue()).isEqualTo("ACTIVE");
            assertThat(client.get(childPath + "/classes").data().size()).isEqualTo(1);
        }
    }

    @Test
    void searchTreatsWildcardCharactersLiterallyAndReturnsPaginationMetadata() throws Exception {
        seedTeacher();
        try (var client = signedIn()) {
            client.post("/classes", Map.of("name", "100% play"));
            client.post("/classes", Map.of("name", "Ordinary class"));
            var literal = client.get("/classes?q=%25");
            assertThat(literal.data().size()).isEqualTo(1);
            assertThat(literal.data().get(0).path("name").stringValue()).isEqualTo("100% play");
            var page = client.get("/classes?size=1&page=1");
            assertThat(page.data().size()).isEqualTo(1);
            assertThat(page.body().path("meta").path("totalPages").intValue()).isEqualTo(2);
        }
    }

    private Result concurrentEnroll(Browser browser, String path, String child, CountDownLatch start) {
        try { start.await(); return browser.post(path, Map.of("studentId", child)); }
        catch (Exception exception) { throw new CompletionException(exception); }
    }
    private void seedTeacher() { users.saveAndFlush(new UserAccount(EMAIL, passwords.encode(PASSWORD), "Synthetic teacher", "TEACHER")); }
    private Map<String, String> setupInput(String key) { return Map.of("displayName", "Synthetic teacher", "email", EMAIL.toUpperCase(Locale.ROOT), "password", PASSWORD, "setupKey", key); }
    private Map<String, Long> version(JsonNode node) { return Map.of("version", node.path("version").longValue()); }
    private String id(JsonNode node) { return node.path("id").stringValue(); }
    private Browser signedIn() throws Exception {
        var client = new Browser();
        assertThat(client.post("/auth/login", Map.of("email", EMAIL, "password", PASSWORD)).status()).isEqualTo(200);
        return client;
    }
    private record Result(int status, JsonNode body, HttpHeaders headers) { JsonNode data() { return body.path("data"); } }

    private final class Browser implements AutoCloseable {
        private final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        private final HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();
        Result get(String path) throws Exception { return request(HttpRequest.newBuilder(uri(path)).GET().build()); }
        Result post(String path, Object body) throws Exception { return write("POST", path, body, true); }
        Result patch(String path, Object body) throws Exception { return write("PATCH", path, body, true); }
        Result write(String method, String path, Object body, boolean csrf) throws Exception {
            if (!csrf) return rawWrite(method, path, body, null, null);
            var token = get("/auth/csrf").data();
            return rawWrite(method, path, body, token.path("headerName").stringValue(), token.path("token").stringValue());
        }
        Result rawWrite(String method, String path, Object body, String header, String token) throws Exception {
            var builder = HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
            if (header != null) builder.header(header, token);
            return request(builder.build());
        }
        private URI uri(String path) { return URI.create("http://127.0.0.1:" + environment.getRequiredProperty("local.server.port") + "/api/v1" + path); }
        private Result request(HttpRequest request) throws Exception {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            return new Result(response.statusCode(), json.readTree(response.body()), response.headers());
        }
        String sessionId() { return cookies.getCookieStore().getCookies().stream().filter(cookie -> cookie.getName().equals("JSESSIONID")).findFirst().orElseThrow().getValue(); }
        @Override public void close() { http.close(); }
    }
}
