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
import org.junit.jupiter.api.io.TempDir;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"tinyclass.auth.attempt-limit=1000","tinyclass.storage.quota-bytes=4194304"})
@ActiveProfiles("test")
class LocalStorageTests {
    private static final String EMAIL="file-teacher@example.test",PASSWORD="Synthetic-files-password-2026";
    private static final byte[] PNG=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sy8AAAAASUVORK5CYII=");
    @Autowired Environment env;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserAccountRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JsonMapper json;
    @Autowired LegacyUploadImporter importer;
    @Autowired FileService service;
    @Autowired StoredFileRepository files;
    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE users, audit_events CASCADE");
        users.saveAndFlush(new UserAccount(EMAIL,passwords.encode(PASSWORD),"File teacher","TEACHER"));
    }
    private ApiBrowser browser() { return new ApiBrowser("http://127.0.0.1:"+env.getProperty("local.server.port"),json); }
    private ApiBrowser teacher() throws Exception { var b=browser(); assertThat(b.post("/auth/login",Map.of("email",EMAIL,"password",PASSWORD)).status()).isEqualTo(200); return b; }
    private ApiBrowser.Result upload(ApiBrowser b,String name,String mime,byte[] data) throws Exception { return b.multipart("/files",name,mime,data,Map.of(),true); }
    @Test void uploadStreamRangeAndDispositionServeBytesStoredInTheDatabase() throws Exception {
        try(var b=teacher()) {
            var result=upload(b,"Hoa nhỏ.png","image/png",PNG); assertThat(result.status()).isEqualTo(201);
            var id=result.data().path("id").stringValue();
            assertThat(result.body().toString()).doesNotContain("storageKey","rootReference","checksum",".local");
            assertThat(result.data().path("learnerDownloadAllowed").booleanValue()).isFalse();
            var bytes=b.binaryGet("/files/"+id+"/content",Map.of());
            assertThat(bytes.statusCode()).isEqualTo(200); assertThat(bytes.body()).isEqualTo(PNG);
            assertThat(bytes.headers().firstValue("Content-Disposition").orElse("")).startsWith("inline;");
            assertThat(bytes.headers().firstValue("Cache-Control")).hasValue("private, no-store");
            String etag=bytes.headers().firstValue("ETag").orElseThrow();
            assertThat(etag).isEqualTo("\""+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(PNG))+"\"");
            var cached=b.binaryGet("/files/"+id+"/content",Map.of("If-None-Match",etag));
            assertThat(cached.statusCode()).isEqualTo(304); assertThat(cached.body()).isEmpty();
            assertThat(cached.headers().firstValue("Cache-Control")).hasValue("private, no-store");
            assertThat(b.binaryGet("/files/"+id+"/content",Map.of("If-None-Match","\"stale\"")).statusCode()).isEqualTo(200);
            var range=b.binaryGet("/files/"+id+"/content",Map.of("Range","bytes=5-12"));
            assertThat(range.statusCode()).isEqualTo(206); assertThat(range.body()).isEqualTo(Arrays.copyOfRange(PNG,5,13));
            assertThat(range.headers().firstValue("Content-Range").orElse("")).isEqualTo("bytes 5-12/"+PNG.length);
            assertThat(range.headers().firstValue("Cache-Control")).hasValue("private, no-store");
            assertThat(b.binaryGet("/files/"+id+"/content",Map.of("Range","bytes=9999-")).statusCode()).isEqualTo(416);
            var download=b.binaryGet("/files/"+id+"/download",Map.of());
            assertThat(download.headers().firstValue("Content-Disposition").orElse("")).startsWith("attachment;");
            assertThat(download.headers().firstValue("Cache-Control")).hasValue("private, no-store");
            assertThat(jdbc.queryForList("select octet_length(data) from file_chunks where file_id=?",Integer.class,UUID.fromString(id))).containsExactly(PNG.length);
            assertThat(b.get("/files").data().size()).isEqualTo(1);
        }
    }
    @Test void largeFilesSpanChunksAndRangesCrossChunkBoundaries() throws Exception {
        int chunk=1024*1024; byte[] pdf=new byte[2*chunk+4321]; new Random(7).nextBytes(pdf);
        byte[] header="%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII); System.arraycopy(header,0,pdf,0,header.length);
        try(var b=teacher()) {
            var result=upload(b,"Bài lớn.pdf","application/pdf",pdf); assertThat(result.status()).isEqualTo(201);
            var id=UUID.fromString(result.data().path("id").stringValue());
            assertThat(jdbc.queryForList("select octet_length(data) from file_chunks where file_id=? order by chunk_index",Integer.class,id)).containsExactly(chunk,chunk,4321);
            assertThat(b.binaryGet("/files/"+id+"/content",Map.of()).body()).isEqualTo(pdf);
            var across=b.binaryGet("/files/"+id+"/content",Map.of("Range","bytes="+(chunk-10)+"-"+(chunk+9)));
            assertThat(across.statusCode()).isEqualTo(206); assertThat(across.body()).isEqualTo(Arrays.copyOfRange(pdf,chunk-10,chunk+10));
            var tail=b.binaryGet("/files/"+id+"/content",Map.of("Range","bytes=-100"));
            assertThat(tail.statusCode()).isEqualTo(206); assertThat(tail.body()).isEqualTo(Arrays.copyOfRange(pdf,pdf.length-100,pdf.length));
        }
    }
    @Test void legacyUploadsAreImportedOnlyFromServerKeysWithMatchingBytes(@TempDir Path temp) throws Exception {
        Path legacy=Files.createDirectories(temp.toRealPath().resolve("uploads"));
        byte[] tampered=PNG.clone(); tampered[tampered.length-1]^=1;
        try(var b=teacher()) {
            String kept=upload(b,"old.png","image/png",PNG).data().path("id").stringValue();
            String changed=upload(b,"changed.png","image/png",PNG).data().path("id").stringValue();
            String missing=upload(b,"missing.png","image/png",PNG).data().path("id").stringValue();
            String escaped=upload(b,"escaped.png","image/png",PNG).data().path("id").stringValue();
            // Rows from before V19 have metadata only; their bytes sit under the old upload root.
            for(var entry:Map.of(kept,PNG,changed,tampered).entrySet()) {
                Path old=legacy.resolve(jdbc.queryForObject("select storage_key from files where id=?",String.class,UUID.fromString(entry.getKey())));
                Files.createDirectories(old.getParent()); Files.write(old,entry.getValue());
            }
            Files.write(temp.resolve("outside.png"),PNG);
            jdbc.update("update files set storage_key='../outside.png' where id=?",UUID.fromString(escaped));
            jdbc.update("delete from file_chunks");
            assertThat(importer.importFrom(legacy)).isEqualTo(1);
            assertThat(b.binaryGet("/files/"+kept+"/content",Map.of()).body()).isEqualTo(PNG);
            for (String rejected : List.of(changed,missing,escaped)) {
                assertThat(b.get("/files/"+rejected).data().path("status").stringValue()).isEqualTo("FAILED");
                assertThat(b.binaryGet("/files/"+rejected+"/content",Map.of()).statusCode()).isEqualTo(404);
            }
            assertThat(jdbc.queryForList("select file_id from file_chunks",UUID.class)).containsExactly(UUID.fromString(kept));
            assertThat(files.readyWithoutContent()).isEmpty();
            assertThat(importer.importFrom(legacy)).isZero();
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
        }
    }
    @Test void pickerFiltersOwnedReadyMediaBeforePaginationAndCounts() throws Exception {
        UUID actor=users.findByEmail(EMAIL).orElseThrow().getId();
        UUID connection=service.connections(actor).getFirst().id();
        var other=users.saveAndFlush(new UserAccount("other-file-parent@example.test",passwords.encode(PASSWORD),"Other uploader","PARENT"));
        var expected=new HashSet<String>();
        for(int index=0;index<13;index++)
            expected.add(fileFixture(actor,connection,"picker-image-"+index+".png","image/png","LESSON_ASSET","READY").toString());
        fileFixture(actor,connection,"picker-image-failed.png","image/png","LESSON_ASSET","FAILED");
        fileFixture(actor,connection,"picker-image-uploading.png","image/png","LESSON_ASSET","UPLOADING");
        fileFixture(actor,connection,"picker-image-deleted.png","image/png","LESSON_ASSET","DELETED");
        fileFixture(actor,connection,"picker-image-note.png","image/png","NOTE_ASSET","READY");
        fileFixture(actor,connection,"other-search.png","image/png","LESSON_ASSET","READY");
        UUID audio=fileFixture(actor,connection,"picker-audio.wav","audio/vnd.wave","LESSON_ASSET","READY");
        fileFixture(actor,connection,"picker-document.pdf","application/pdf","LESSON_ASSET","READY");
        // A different uploader can share the teacher's storage connection, as parent submissions do.
        fileFixture(other.getId(),connection,"picker-image-private.png","image/png","LESSON_ASSET","READY");
        try(var b=teacher()) {
            String filter="/files?purpose=LESSON_ASSET&mediaType=image&status=READY&q=picker-&size=12";
            var first=b.get(filter+"&page=0");
            var second=b.get(filter+"&page=1");
            assertThat(first.status()).isEqualTo(200);assertThat(second.status()).isEqualTo(200);
            assertThat(first.data().size()).isEqualTo(12);assertThat(second.data().size()).isEqualTo(1);
            for(var result:List.of(first,second)) {
                assertThat(result.body().path("meta").path("totalElements").longValue()).isEqualTo(13);
                assertThat(result.body().path("meta").path("totalPages").longValue()).isEqualTo(2);
            }
            var actual=new ArrayList<String>();
            for(var result:List.of(first,second)) for(var file:result.data()) {
                actual.add(file.path("id").stringValue());
                assertThat(file.path("mimeType").stringValue()).startsWith("image/");
                assertThat(file.path("status").stringValue()).isEqualTo("READY");
            }
            assertThat(actual).containsExactlyInAnyOrderElementsOf(expected);
            var sound=b.get("/files?purpose=LESSON_ASSET&mediaType=audio&status=READY&size=12");
            assertThat(sound.status()).isEqualTo(200);assertThat(sound.data().size()).isEqualTo(1);
            assertThat(sound.data().get(0).path("id").stringValue()).isEqualTo(audio.toString());
            assertThat(sound.body().path("meta").path("totalElements").longValue()).isEqualTo(1);
            assertThat(b.get("/files?mediaType=image%25").status()).isEqualTo(400);
            assertThat(b.get("/files?status=DELETED").status()).isEqualTo(400);
            // The unfiltered library still includes failed/in-progress uploads, but never deleted/other-owner files.
            var library=b.get("/files?size=100");
            assertThat(library.body().path("meta").path("totalElements").longValue()).isEqualTo(19);
        }
    }
    private UUID fileFixture(UUID actor,UUID connection,String name,String mime,String purpose,String status) {
        var file=new StoredFile(actor,connection,purpose,false,UUID.randomUUID().toString(),name,mime,1);
        switch(status) {
            case "READY" -> file.ready(new StorageAdapter.Written(1,"0".repeat(64)));
            case "FAILED" -> file.failed();
            case "DELETED" -> file.delete();
            default -> { }
        }
        return files.saveAndFlush(file).getId();
    }
    @Test void quotaReservationsAreAtomicForConcurrentUploads() throws Exception {
        byte[] pdf=Arrays.copyOf("%PDF-1.4\nSynthetic fixture\n%%EOF".getBytes(StandardCharsets.UTF_8),2621440);
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
            jdbc.update("delete from file_chunks where file_id=?",UUID.fromString(id));
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
