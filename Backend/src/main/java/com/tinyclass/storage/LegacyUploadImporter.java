package com.tinyclass.storage;

import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Until V19, LOCAL bytes were files under TINYCLASS_UPLOAD_ROOT. At startup, copies each READY file still missing its
 * chunks from that directory into the database, keeping it only when size and SHA-256 match the metadata. The directory
 * is only read; once nothing is left to import it can be removed.
 */
@Component
public class LegacyUploadImporter implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(LegacyUploadImporter.class);
    private static final Pattern LEGACY_KEY = Pattern.compile("[a-f0-9-]{36}/[a-f0-9-]{36}\\.[a-z0-9]{2,5}");
    private final StoredFileRepository files;
    private final DatabaseStorageAdapter storage;
    private final TransactionTemplate tx;
    private final Environment environment;
    private final String root;
    public LegacyUploadImporter(StoredFileRepository files, DatabaseStorageAdapter storage, PlatformTransactionManager transactions,
            Environment environment, @Value("${tinyclass.storage.legacy-root:}") String root) {
        this.files = files;
        this.storage = storage;
        this.tx = new TransactionTemplate(transactions);
        this.environment = environment;
        this.root = root;
    }

    @Override public void run(ApplicationArguments args) {
        List<StoredFile> pending = files.readyWithoutContent();
        if (pending.isEmpty()) return;
        if (root.isBlank()) {
            configurationError(pending.size(), "TINYCLASS_UPLOAD_ROOT is unset");
            return;
        }
        Path directory;
        try {
            directory = Path.of(root);
        } catch (InvalidPathException failure) {
            configurationError(pending.size(), "TINYCLASS_UPLOAD_ROOT is not a valid path");
            return;
        }
        importFrom(directory, pending);
    }

    public int importFrom(Path directory) {
        return importFrom(directory, files.readyWithoutContent());
    }

    private int importFrom(Path directory, List<StoredFile> pending) {
        if (pending.isEmpty()) return 0;
        Path base = directory.toAbsolutePath().normalize();
        try {
            requireReadableRoot(base);
        } catch (IOException invalidRoot) {
            configurationError(pending.size(), "Cannot use legacy upload directory at " + base + " (" + invalidRoot.getMessage() + ")");
            return 0;
        }
        int imported = 0;
        for (var file : pending) {
            try {
                if (Boolean.TRUE.equals(tx.execute(status -> importFile(base, file)))) imported++;
            } catch (RuntimeException failure) {
                log.warn("Could not import legacy bytes for file {}; will retry on restart: {}", file.getId(), failure.getMessage());
            }
        }
        if (imported > 0) log.info("Imported {} legacy file(s) from {} into PostgreSQL", imported, base);
        return imported;
    }

    private boolean importFile(Path base, StoredFile candidate) {
        // Recheck chunks after acquiring the row lock. Another instance might have imported this file since the scan.
        StoredFile file = files.lockOwned(candidate.getId(), candidate.getUploadedBy()).orElse(null);
        if (file == null || !"READY".equals(file.getStatus()) || files.hasContent(file.getId())) return false;
        try {
            writeLegacyBytes(base, file);
            return true;
        } catch (InvalidLegacyFile failure) {
            storage.deleteChunks(file.getId());
            file.failed();
            log.warn("Marking legacy file {} FAILED: {}", file.getId(), failure.getMessage());
            return false;
        } catch (IOException failure) {
            throw new UncheckedIOException(failure);
        }
    }

    private void writeLegacyBytes(Path base, StoredFile file) throws IOException, InvalidLegacyFile {
        try (var input = openLegacyBytes(base, file)) {
            var written = storage.write(file, input, file.getSizeBytes());
            if (written.size() != file.getSizeBytes() || !Objects.equals(written.checksum(), file.getChecksum()))
                throw new InvalidLegacyFile("bytes differ from the recorded size or SHA-256");
        }
    }

    private InputStream openLegacyBytes(Path base, StoredFile file) throws IOException, InvalidLegacyFile {
        String key = file.getStorageKey();
        if (!LEGACY_KEY.matcher(key).matches()) throw new InvalidLegacyFile("invalid storage key");
        Path source = base.resolve(key);
        try {
            requireDirectoryWithoutLinks(source.getParent());
            var attributes = Files.readAttributes(source, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            if (!attributes.isRegularFile()) throw new IOException("Legacy upload is not a regular file: " + source);
            if (attributes.size() != file.getSizeBytes()) throw new InvalidLegacyFile("size differs from metadata");
            return Files.newInputStream(source, LinkOption.NOFOLLOW_LINKS);
        } catch (NoSuchFileException missing) {
            // Confirm the root is still available before treating an absent path as a lost file.
            requireReadableRoot(base);
            throw new InvalidLegacyFile("source file is missing");
        }
    }

    private static void requireReadableRoot(Path base) throws IOException {
        requireDirectoryWithoutLinks(base);
        if (!Files.isReadable(base)) throw new AccessDeniedException(base.toString());
    }

    private static void requireDirectoryWithoutLinks(Path directory) throws IOException {
        var attributes = Files.readAttributes(directory, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
        if (!attributes.isDirectory())
            throw new IOException("Expected a directory without symbolic links in its path: " + directory);
        try {
            if (!directory.equals(directory.toRealPath()))
                throw new IOException("Expected a directory without symbolic links in its path: " + directory);
        } catch (NoSuchFileException changed) {
            throw new IOException("Directory changed or resolves to a missing target: " + directory, changed);
        }
    }

    private static final class InvalidLegacyFile extends Exception {
        InvalidLegacyFile(String reason) { super(reason); }
    }

    private void configurationError(int pending, String problem) {
        String message = "%d legacy upload(s) have no content in PostgreSQL. %s. Set TINYCLASS_UPLOAD_ROOT to the original, readable upload directory and restart TinyClass."
                .formatted(pending, problem);
        if (environment.matchesProfiles("production")) throw new IllegalStateException(message);
        log.warn(message);
    }
}
