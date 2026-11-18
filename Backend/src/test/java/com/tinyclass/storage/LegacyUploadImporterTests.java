package com.tinyclass.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class LegacyUploadImporterTests {
    private final StoredFileRepository files = mock(StoredFileRepository.class);
    private final DatabaseStorageAdapter storage = mock(DatabaseStorageAdapter.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);

    @Test void productionStartsWithoutLegacyRootWhenNoFilesNeedImporting(CapturedOutput output) {
        when(files.readyWithoutContent()).thenReturn(List.of());

        assertThatCode(() -> runImport("production", "")).doesNotThrowAnyException();
        assertThat(output).doesNotContain("TINYCLASS_UPLOAD_ROOT");
    }

    @Test void productionRequiresLegacyRootWhenFilesNeedImporting() {
        givenPendingFile();

        assertThatIllegalStateException().isThrownBy(() -> runImport("production", " "))
                .withMessageContaining("1 legacy upload(s) have no content in PostgreSQL")
                .withMessageContaining("TINYCLASS_UPLOAD_ROOT is unset")
                .withMessageContaining("original, readable upload directory");
    }

    @Test void productionReportsMissingConfiguredDirectory(@TempDir Path temp) {
        givenPendingFile();
        Path missing = temp.resolve("legacy-uploads");

        assertThatIllegalStateException().isThrownBy(() -> runImport("production", missing.toString()))
                .withMessageContaining(missing.toString())
                .withMessageContaining("Set TINYCLASS_UPLOAD_ROOT");
    }

    @Test void localStartWarnsWhenFilesNeedImporting(CapturedOutput output) {
        givenPendingFile();

        runImport("local", "");

        assertThat(output).contains("1 legacy upload(s) have no content in PostgreSQL", "Set TINYCLASS_UPLOAD_ROOT");
    }

    @Test void productionRejectsLegacyRootWithSymlinkAncestor(@TempDir Path temp) throws IOException {
        givenPendingFile();
        temp = temp.toRealPath();
        Path original = Files.createDirectory(temp.resolve("original"));
        Files.createDirectories(original.resolve("old/uploads"));
        Path alias = temp.resolve("alias");
        createDirectoryLink(alias, original);

        assertThatIllegalStateException().isThrownBy(() -> runImport("production", alias.resolve("old/uploads").toString()))
                .withMessageContaining("without symbolic links");
        verifyNoInteractions(storage, transactions);
    }

    @Test void legacyUploadUnderSymlinkRemainsAvailableForRetry(@TempDir Path root, CapturedOutput output) throws IOException {
        var file = givenLockedFile();
        root = root.toRealPath();
        Path source = root.resolve(file.getStorageKey());
        Path other = Files.createDirectory(root.resolve("other"));
        Files.write(other.resolve(source.getFileName()), new byte[]{1});
        createDirectoryLink(source.getParent(), other);

        runImport("production", root.toString());

        assertThat(file.getStatus()).isEqualTo("READY");
        assertThat(output).contains("will retry on restart", "without symbolic links");
        verifyNoInteractions(storage);
    }

    @Test void transientReadFailureLeavesLegacyUploadReady(@TempDir Path root, CapturedOutput output) throws IOException {
        var file = givenLockedFile();
        root = root.toRealPath();
        Path source = root.resolve(file.getStorageKey());
        Files.createDirectories(source.getParent());
        Files.write(source, new byte[]{1});
        when(storage.write(eq(file), any(), eq(1L))).thenThrow(new IOException("read interrupted"));

        runImport("production", root.toString());

        assertThat(file.getStatus()).isEqualTo("READY");
        assertThat(output).contains("will retry on restart", "read interrupted");
    }

    @Test void fileAlreadyImportedByAnotherRunnerRemainsReady(@TempDir Path root) throws IOException {
        var file = givenLockedFile();
        when(files.hasContent(file.getId())).thenReturn(true);

        runImport("production", root.toRealPath().toString());

        assertThat(file.getStatus()).isEqualTo("READY");
        verifyNoInteractions(storage);
    }

    private void givenPendingFile() {
        var pending = mock(StoredFile.class);
        when(files.readyWithoutContent()).thenReturn(List.of(pending));
    }

    private StoredFile givenLockedFile() {
        UUID uploader = UUID.randomUUID();
        var file = new StoredFile(uploader, UUID.randomUUID(), "LESSON_ASSET", false, uploader + "/" + UUID.randomUUID() + ".png",
                "image.png", "image/png", 1);
        file.ready(new StorageAdapter.Written(1, "0".repeat(64)));
        when(files.readyWithoutContent()).thenReturn(List.of(file));
        when(files.lockOwned(file.getId(), uploader)).thenReturn(Optional.of(file));
        var status = mock(TransactionStatus.class);
        when(transactions.getTransaction(any())).thenReturn(status);
        return file;
    }

    private void createDirectoryLink(Path link, Path target) {
        try {
            Files.createSymbolicLink(link, target);
        } catch (IOException | UnsupportedOperationException unavailable) {
            assumeTrue(false, "Cannot create directory symlinks on this system: " + unavailable.getMessage());
        }
    }

    private void runImport(String profile, String root) {
        var environment = new MockEnvironment();
        environment.setActiveProfiles(profile);
        var importer = new LegacyUploadImporter(files, storage, transactions, environment, root);
        importer.run(new DefaultApplicationArguments());
    }
}
