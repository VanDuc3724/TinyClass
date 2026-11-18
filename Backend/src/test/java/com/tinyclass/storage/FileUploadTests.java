package com.tinyclass.storage;

import com.tinyclass.auth.UserAccount;
import com.tinyclass.auth.UserAccountRepository;
import com.tinyclass.common.api.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties={
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.datasource.hikari.connection-timeout=2000",
        "tinyclass.storage.quota-bytes=2097152",
        // Flyway uses two simultaneous connections during startup.
        "spring.flyway.url=${spring.datasource.url}",
        "spring.flyway.user=${spring.datasource.username}",
        "spring.flyway.password=${spring.datasource.password}"
})
@ActiveProfiles("test")
class FileUploadTests {
    private static final byte[] PDF = Arrays.copyOf("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII), DatabaseStorageAdapter.CHUNK + 16);

    @Autowired UserAccountRepository users;
    @Autowired StoredFileRepository files;
    @Autowired FileService service;
    @Autowired JdbcTemplate jdbc;
    private UUID teacher;

    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("SELECT current_database()", String.class)).isEqualTo("tinyclass_test");
        jdbc.execute("TRUNCATE users, audit_events CASCADE");
        teacher = users.saveAndFlush(new UserAccount("upload-teacher@example.test", "unused", "Upload teacher", "TEACHER")).getId();
    }

    @Test void interruptedSourceLeavesTheConnectionAvailableAndClearsPartialChunks() throws Exception {
        var waitingForSource = new CountDownLatch(1);
        var releaseSource = new CountDownLatch(1);
        var part = new MockMultipartFile("file", "interrupted.pdf", "application/pdf", PDF) {
            private boolean openedForDetection;

            @Override public InputStream getInputStream() throws IOException {
                var source = super.getInputStream();
                if (!openedForDetection) {
                    openedForDetection = true;
                    return source;
                }
                return new FilterInputStream(source) {
                    private boolean firstChunk = true;

                    @Override public int readNBytes(byte[] target, int offset, int length) throws IOException {
                        if (firstChunk) {
                            firstChunk = false;
                            return super.readNBytes(target, offset, length);
                        }
                        waitingForSource.countDown();
                        try {
                            if (!releaseSource.await(15, SECONDS)) throw new IOException("Timed out waiting for test");
                        } catch (InterruptedException interrupted) {
                            Thread.currentThread().interrupt();
                            throw new IOException(interrupted);
                        }
                        throw new IOException("Interrupted upload source");
                    }
                };
            }
        };

        try (var worker = Executors.newSingleThreadExecutor()) {
            var upload = worker.submit(() -> service.upload(teacher, part, null, "LESSON_ASSET", false, null));
            UUID id;
            try {
                assertThat(waitingForSource.await(10, SECONDS)).isTrue();
                // The only connection in the pool can read metadata and the already committed chunk.
                id = jdbc.queryForObject("SELECT id FROM files WHERE status='UPLOADING'", UUID.class);
                assertThat(chunkCount(id)).isEqualTo(1);
                assertThatThrownBy(() -> service.content(teacher, id)).isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.code()).isEqualTo("RESOURCE_NOT_FOUND"));
            } finally {
                releaseSource.countDown();
            }

            assertThatThrownBy(() -> upload.get(10, SECONDS)).isInstanceOf(ExecutionException.class)
                    .cause().isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.code()).isEqualTo("STORAGE_UNAVAILABLE"));
            assertThat(files.findById(id).orElseThrow().getStatus()).isEqualTo("FAILED");
            assertThat(chunkCount(id)).isZero();
            assertThat(files.used(teacher)).isZero();
        }
    }

    @Test void newUploadReclaimsQuotaAndChunksFromAnAbandonedReservation() {
        UUID connection = service.connections(teacher).getFirst().id();
        var abandoned = files.saveAndFlush(new StoredFile(teacher, connection, "LESSON_ASSET", false,
                "abandoned.pdf", "abandoned.pdf", "application/pdf", PDF.length));
        jdbc.update("UPDATE files SET updated_at=now()-interval '2 hours' WHERE id=?", abandoned.getId());
        jdbc.update("INSERT INTO file_chunks(file_id,chunk_index,data) VALUES (?,0,?)", abandoned.getId(), new byte[] {1});

        var retry = service.upload(teacher, new MockMultipartFile("file", "retry.pdf", "application/pdf", PDF),
                connection, "LESSON_ASSET", false, null);

        assertThat(retry.status()).isEqualTo("READY");
        assertThat(chunkCount(retry.id())).isEqualTo(2);
        assertThat(files.findById(abandoned.getId()).orElseThrow().getStatus()).isEqualTo("FAILED");
        assertThat(chunkCount(abandoned.getId())).isZero();
        assertThat(files.used(teacher)).isEqualTo(PDF.length);
    }

    private int chunkCount(UUID id) {
        return jdbc.queryForObject("SELECT count(*) FROM file_chunks WHERE file_id=?", Integer.class, id);
    }
}
