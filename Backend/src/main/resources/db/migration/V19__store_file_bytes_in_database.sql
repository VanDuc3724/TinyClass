-- LOCAL bytes live beside their metadata, so one PostgreSQL backup holds everything. Fixed 1 MiB chunks keep memory
-- bounded and let a Range request read only the chunks it covers.
CREATE TABLE file_chunks (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 1048576),
    PRIMARY KEY (file_id, chunk_index)
);
-- Images, audio and video are already compressed; skip TOAST compression so writes stay cheap.
ALTER TABLE file_chunks ALTER COLUMN data SET STORAGE EXTERNAL;
