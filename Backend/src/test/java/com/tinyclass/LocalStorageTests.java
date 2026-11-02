package com.tinyclass;

import com.tinyclass.auth.*;
import com.tinyclass.storage.*;
import com.tinyclass.support.ApiBrowser;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.json.JsonMapper;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"tinyclass.auth.attempt-limit=1000","tinyclass.storage.quota-bytes=2000"})
@ActiveProfiles("test")
class LocalStorageTests {
    private static final String EMAIL="file-teacher@example.test",PASSWORD="Synthetic-files-password-2026";
    private static final byte[] PNG=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sy8AAAAASUVORK5CYII=");
    @Autowired Environment env;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserAccountRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JsonMapper json;
    @Autowired LocalStorageAdapter local;
    @Autowired FileService service;
    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE users, audit_events CASCADE");
        users.saveAndFlush(new UserAccount(EMAIL,passwords.encode(PASSWORD),"File teacher","TEACHER"));
    }
    private ApiBrowser browser() { return new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json); }
    private ApiBrowser teacher() throws Exception { var b=browser(); assertThat(b.post("/auth/login",Map.of("email",EMAIL,"password",PASSWORD)).status()).isEqualTo(200); return b; }
    private ApiBrowser.Result upload(ApiBrowser b,String name,String mime,byte[] data) throws Exception { return b.multipart("/files",name,mime,data,Map.of(),true); }
    @Test void uploadStreamRangeDispositionAndMetadataSurviveAnotherStorageInstance() throws Exception {
        try(var b=teacher()) {
            var result=upload(b,"Hoa nhỏ.png","image/png",PNG); assertThat(result.status()).isEqualTo(201);
            var id=result.data().path("id").stringValue();
            assertThat(result.body().toString()).doesNotContain("storageKey","rootReference","checksum",".local");
            assertThat(result.data().path("learnerDownloadAllowed").booleanValue()).isFalse();
            var bytes=b.binaryGet("/files/"+id+"/content",Map.of());
            assertThat(bytes.statusCode()).isEqualTo(200); assertThat(bytes.body()).isEqualTo(PNG);
            assertThat(bytes.headers().firstValue("Content-Disposition").orElse("")).startsWith("inline;");
            assertThat(bytes.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
            var range=b.binaryGet("/files/"+id+"/content",Map.of("Range","bytes=5-12"));
            assertThat(range.statusCode()).isEqualTo(206); assertThat(range.body()).isEqualTo(Arrays.copyOfRange(PNG,5,13));
            assertThat(range.headers().firstValue("Content-Range").orElse("")).isEqualTo("bytes 5-12/"+PNG.length);
            assertThat(b.binaryGet("/files/"+id+"/content",Map.of("Range","bytes=9999-")).statusCode()).isEqualTo(416);
            assertThat(b.binaryGet("/files/"+id+"/download",Map.of()).headers().firstValue("Content-Disposition").orElse("")).startsWith("attachment;");
            String key=jdbc.queryForObject("select storage_key from files where id=?",String.class,UUID.fromString(id));
            var restarted=new LocalStorageAdapter(env.getProperty("tinyclass.storage.local-root"));
            try(var input=restarted.read(key,PNG.length).getInputStream()) { assertThat(input.readAllBytes()).isEqualTo(PNG); }
            assertThat(b.get("/files").data().size()).isEqualTo(1);
        }
    }
    @Test void spoofedTypesTraversalEmptyAndOversizedFilesAreRejectedBeforeReservation() throws Exception {
        try(var b=teacher()) {
            assertThat(upload(b,"fake.png","image/png","<html>unsafe</html>".getBytes(StandardCharsets.UTF_8)).status()).isEqualTo(400);
            assertThat(upload(b,"wrong.pdf","application/pdf",PNG).status()).isEqualTo(400);
            assertThat(upload(b,"claimed.png","text/html",PNG).status()).isEqualTo(400);
            assertThat(upload(b,"../outside.png","image/png",PNG).status()).isEqualTo(400);
            assertThat(upload(b,"empty.png","image/png",new byte[0]).status()).isEqualTo(400);
            assertThat(upload(b,"oversized.png","image/png",Arrays.copyOf(PNG,11*1024*1024)).status()).isEqualTo(413);
            assertThat(jdbc.queryForObject("select count(*) from files",Integer.class)).isZero();
            assertThatThrownBy(()->local.read("../../outside.png",PNG.length)).isInstanceOf(IOException.class);
        }
    }
    @Test void quotaReservationsAreAtomicForConcurrentUploads() throws Exception {
        byte[] pdf=Arrays.copyOf("%PDF-1.4\nSynthetic fixture\n%%EOF".getBytes(StandardCharsets.UTF_8),1400);
        try(var a=teacher();var b=teacher();var pool=Executors.newFixedThreadPool(2)) {
            var jobs=pool.invokeAll(List.of(()->upload(a,"one.pdf","application/pdf",pdf).status(),()->upload(b,"two.pdf","application/pdf",pdf).status()));
            assertThat(List.of(jobs.get(0).get(),jobs.get(1).get())).containsExactlyInAnyOrder(201,409);
            assertThat(jdbc.queryForObject("select count(*) from files where status='READY'",Integer.class)).isEqualTo(1);
        }
    }
    @Test void onlyOwnerCanReadAndOnlyTeacherCanUploadOrChangeDownloadPolicy() throws Exception {
        var parent=users.saveAndFlush(new UserAccount("file-parent@example.test",passwords.encode(PASSWORD),"Parent","PARENT"));
        try(var teacher=teacher();var guest=browser();var family=browser()) {
            String id=upload(teacher,"private.png","image/png",PNG).data().path("id").stringValue();
            assertThat(guest.binaryGet("/files/"+id+"/content",Map.of()).statusCode()).isEqualTo(401);
            assertThat(family.post("/auth/login",Map.of("email",parent.getEmail(),"password",PASSWORD)).status()).isEqualTo(200);
            assertThat(upload(family,"parent.png","image/png",PNG).status()).isEqualTo(403);
            assertThat(family.get("/files").status()).isEqualTo(403);
            assertThat(family.binaryGet("/files/"+id+"/content",Map.of()).statusCode()).isEqualTo(403);
            assertThat(family.patch("/files/"+id+"/policy",Map.of("version",0,"learnerDownloadAllowed",true)).status()).isEqualTo(403);
            long version=teacher.get("/files/"+id).data().path("version").longValue();
            var changed=teacher.patch("/files/"+id+"/policy",Map.of("version",version,"learnerDownloadAllowed",true));
            assertThat(changed.status()).isEqualTo(200);
            assertThat(teacher.patch("/files/"+id+"/policy",Map.of("version",-1,"learnerDownloadAllowed",false)).status()).isEqualTo(409);
            jdbc.update("update files set uploaded_by=? where id=?",parent.getId(),UUID.fromString(id));
            assertThat(teacher.get("/files/"+id).status()).isEqualTo(404);
            assertThat(teacher.binaryGet("/files/"+id+"/content",Map.of()).statusCode()).isEqualTo(404);
        }
    }
    @Test void missingBytesDoNotDeleteMetadataOrSwitchStorage() throws Exception {
        try(var b=teacher()) {
            String id=upload(b,"missing.png","image/png",PNG).data().path("id").stringValue();
            String key=jdbc.queryForObject("select storage_key from files where id=?",String.class,UUID.fromString(id)); local.delete(key);
            assertThat(b.binaryGet("/files/"+id+"/content",Map.of()).statusCode()).isEqualTo(503);
            assertThat(b.get("/files/"+id).data().path("status").stringValue()).isEqualTo("READY");
            assertThat(b.multipart("/files","no-csrf.png","image/png",PNG,Map.of(),false).status()).isEqualTo(403);
        }
    }
    @Test void webmRequiresTheActualEbmlDocumentTypeInsteadOfOnlyTheExtension() throws Exception {
        try(var b=teacher()) {
            var webm=HexFormat.of().parseHex("1a45dfa3874282847765626d");
            assertThat(upload(b,"sample.webm","video/webm",webm).status()).isEqualTo(201);
            var matroska=HexFormat.of().parseHex("1a45dfa38b4282886d6174726f736b61");
            assertThat(upload(b,"renamed.webm","video/webm",matroska).status()).isEqualTo(400);
        }
    }
}
