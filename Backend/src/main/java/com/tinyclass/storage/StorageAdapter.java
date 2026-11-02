package com.tinyclass.storage;

import org.springframework.core.io.Resource;
import java.io.*;

public interface StorageAdapter {
    String provider();
    record Written(long size, String checksum) {}
    Written write(String key, InputStream source, long limit) throws IOException;
    Resource read(String key, long expectedSize) throws IOException;
    void delete(String key) throws IOException;
}
