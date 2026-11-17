package com.tinyclass.storage;

import org.springframework.core.io.Resource;
import java.io.*;

public interface StorageAdapter {
    String provider();
    record Written(long size, String checksum) {}
    Written write(StoredFile file, InputStream source, long limit) throws IOException;
    Resource read(StoredFile file) throws IOException;
}
