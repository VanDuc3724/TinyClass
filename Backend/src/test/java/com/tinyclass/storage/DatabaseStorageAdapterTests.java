package com.tinyclass.storage;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.io.InputStream;
import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DatabaseStorageAdapterTests {
    @Test
    void zeroLengthReadsReturnZeroBeforeAndAfterEndOfFileWithoutLoadingChunks() throws Exception {
        var fixture = new Fixture(new byte[]{7});
        var target = new byte[2];
        try (var stream = fixture.open()) {
            assertThat(stream.read(target, target.length, 0)).isZero();
            fixture.verifyNoChunkReads();
            assertThat(stream.read()).isEqualTo(7);
            assertThat(stream.read()).isEqualTo(-1);
            assertThat(stream.read(target, target.length, 0)).isZero();
            assertThat(stream.read(new byte[0])).isZero();
            verify(fixture.jdbc, times(1)).query(anyString(), any(ResultSetExtractor.class), eq(fixture.file.getId()), eq(0));
        }

        var empty = new Fixture(new byte[0]);
        try (var stream = empty.open()) {
            assertThat(stream.read(new byte[0])).isZero();
            assertThat(stream.read()).isEqualTo(-1);
            empty.verifyNoChunkReads();
        }
    }

    @Test
    void validatesBufferBoundsEvenAtEndOfFile() throws Exception {
        var fixture = new Fixture(new byte[0]);
        try (var stream = fixture.open()) {
            assertThatThrownBy(() -> stream.read(new byte[2], -1, 0)).isInstanceOf(IndexOutOfBoundsException.class);
            assertThatThrownBy(() -> stream.read(new byte[2], 3, 0)).isInstanceOf(IndexOutOfBoundsException.class);
            assertThatThrownBy(() -> stream.read(new byte[2], 1, 2)).isInstanceOf(IndexOutOfBoundsException.class);
            assertThatThrownBy(() -> stream.read(null, 0, 0)).isInstanceOf(NullPointerException.class);
            fixture.verifyNoChunkReads();
        }
    }

    @Test
    void rangeReadsAcrossChunkBoundariesWithoutFetchingSkippedChunks() throws Exception {
        var data = new byte[2 * DatabaseStorageAdapter.CHUNK + 4];
        Arrays.fill(data, DatabaseStorageAdapter.CHUNK, 2 * DatabaseStorageAdapter.CHUNK, (byte) 1);
        data[data.length - 4] = 2;
        data[data.length - 3] = 3;
        data[data.length - 2] = 4;
        data[data.length - 1] = 5;
        var fixture = new Fixture(data);

        try (var stream = fixture.open()) {
            assertThat(stream.skip(-1)).isZero();
            assertThat(stream.skip(2L * DatabaseStorageAdapter.CHUNK - 2)).isEqualTo(2L * DatabaseStorageAdapter.CHUNK - 2);
            fixture.verifyNoChunkReads();
            assertThat(stream.readNBytes(6)).containsExactly(1, 1, 2, 3, 4, 5);
            assertThat(stream.read()).isEqualTo(-1);
            assertThat(stream.skip(Long.MAX_VALUE)).isZero();
            verify(fixture.jdbc, never()).query(anyString(), any(ResultSetExtractor.class), eq(fixture.file.getId()), eq(0));
            verify(fixture.jdbc, times(1)).query(anyString(), any(ResultSetExtractor.class), eq(fixture.file.getId()), eq(1));
            verify(fixture.jdbc, times(1)).query(anyString(), any(ResultSetExtractor.class), eq(fixture.file.getId()), eq(2));
        }
    }

    private static final class Fixture {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final StoredFile file;
        final DatabaseStorageAdapter storage = new DatabaseStorageAdapter(jdbc);

        Fixture(byte[] data) {
            file = new StoredFile(UUID.randomUUID(), UUID.randomUUID(), "LESSON", true, "test", "test.bin", "application/octet-stream", data.length);
            when(jdbc.queryForObject(anyString(), eq(Long.class), eq(file.getId()))).thenReturn((long) data.length);
            when(jdbc.query(anyString(), org.mockito.ArgumentMatchers.<ResultSetExtractor<byte[]>>any(), eq(file.getId()), anyInt()))
                    .thenAnswer(invocation -> {
                        int start = invocation.<Integer>getArgument(3) * DatabaseStorageAdapter.CHUNK;
                        return start >= data.length ? null : Arrays.copyOfRange(data, start, Math.min(start + DatabaseStorageAdapter.CHUNK, data.length));
                    });
        }

        InputStream open() throws Exception { return storage.read(file).getInputStream(); }

        void verifyNoChunkReads() {
            verify(jdbc, never()).query(anyString(), any(ResultSetExtractor.class), eq(file.getId()), anyInt());
        }
    }
}
