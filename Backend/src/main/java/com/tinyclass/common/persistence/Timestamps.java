package com.tinyclass.common.persistence;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class Timestamps {
    private Timestamps() {}
    /** PostgreSQL timestamptz precision, also used for the first API response before reload. */
    public static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
}
