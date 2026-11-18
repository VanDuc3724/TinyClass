package com.tinyclass.storage;

import com.tinyclass.common.api.ApiException;
import org.springframework.core.io.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Component;
import java.io.*;
import java.security.*;
import java.util.*;

/** LOCAL ("Máy chủ TinyClass") keeps each file's bytes in PostgreSQL as file_chunks rows beside its metadata. */
@Component
public class DatabaseStorageAdapter implements StorageAdapter {
    static final int CHUNK = 1024 * 1024;
    private static final ResultSetExtractor<byte[]> DATA = rows -> rows.next() ? rows.getBytes(1) : null;
    private static final String INSERT_CHUNK = "INSERT INTO file_chunks(file_id,chunk_index,data) VALUES (?,?,?)";
    private static final String INSERT_UPLOAD_CHUNK = """
            WITH upload AS (
                UPDATE files SET updated_at=statement_timestamp() WHERE id=? AND status='UPLOADING' RETURNING id
            )
            INSERT INTO file_chunks(file_id,chunk_index,data) SELECT id, ?, ? FROM upload
            """;
    private final JdbcTemplate jdbc;
    public DatabaseStorageAdapter(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Override public String provider() { return "LOCAL"; }
    @Override public Written write(StoredFile file, InputStream source, long limit) throws IOException {
        return write(file, source, limit, INSERT_CHUNK);
    }
    /** Each statement renews the reservation and releases its connection before reading the next chunk. */
    Written writeUpload(StoredFile file, InputStream source, long limit) throws IOException {
        return write(file, source, limit, INSERT_UPLOAD_CHUNK);
    }
    private Written write(StoredFile file, InputStream source, long limit, String statement) throws IOException {
        MessageDigest digest;
        try { digest = MessageDigest.getInstance("SHA-256"); } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
        long size = 0; int index = 0, read; byte[] buffer = new byte[CHUNK];
        while ((read = source.readNBytes(buffer, 0, CHUNK)) > 0) {
            size += read;
            if (size > limit) throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE", "Tệp vượt quá giới hạn cho phép.");
            digest.update(buffer, 0, read);
            if (jdbc.update(statement, file.getId(), index++, Arrays.copyOf(buffer, read)) != 1)
                throw new IOException("Could not write file chunk");
        }
        return new Written(size, HexFormat.of().formatHex(digest.digest()));
    }
    void deleteChunks(UUID file) { jdbc.update("DELETE FROM file_chunks WHERE file_id=?", file); }
    @Override public Resource read(StoredFile file) throws IOException {
        // octet_length comes from the TOAST pointer, so checking the size does not load the bytes.
        Long stored = jdbc.queryForObject("SELECT coalesce(sum(octet_length(data)),0) FROM file_chunks WHERE file_id=?", Long.class, file.getId());
        if (stored == null || stored != file.getSizeBytes()) throw new IOException("File unavailable");
        return new Chunks(file.getId(), file.getSizeBytes());
    }

    /** Read after the controller returns; each chunk is its own short query, so a slow client never holds a connection. */
    private final class Chunks extends AbstractResource {
        private final UUID file; private final long size;
        Chunks(UUID file, long size) { this.file = file; this.size = size; }
        @Override public String getDescription() { return "file " + file; }
        @Override public boolean exists() { return true; }
        @Override public long contentLength() { return size; }
        @Override public InputStream getInputStream() { return new ChunkStream(file, size); }
    }

    private final class ChunkStream extends InputStream {
        private final UUID file; private final long size;
        private long position; private int loaded = -1; private byte[] chunk;
        ChunkStream(UUID file, long size) { this.file = file; this.size = size; }
        @Override public int read() throws IOException { byte[] one = new byte[1]; return read(one, 0, 1) < 0 ? -1 : one[0] & 255; }
        @Override public int read(byte[] target, int offset, int length) throws IOException {
            Objects.checkFromIndexSize(offset, length, target.length);
            if (length == 0) return 0;
            if (position >= size) return -1;
            int index = (int) (position / CHUNK), start = (int) (position % CHUNK);
            if (index != loaded) { chunk = jdbc.query("SELECT data FROM file_chunks WHERE file_id=? AND chunk_index=?", DATA, file, index); loaded = index; }
            if (chunk == null || chunk.length <= start) throw new IOException("File unavailable");
            int count = Math.min(length, chunk.length - start);
            System.arraycopy(chunk, start, target, offset, count);
            position += count;
            return count;
        }
        // Range responses skip to their first byte; moving the position loads none of the chunks before it.
        @Override public long skip(long count) { long skipped = Math.max(0, Math.min(count, size - position)); position += skipped; return skipped; }
    }
}
