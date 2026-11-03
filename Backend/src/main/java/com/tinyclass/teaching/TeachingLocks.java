package com.tinyclass.teaching;

import com.tinyclass.common.persistence.DomainStore;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Calendar and attendance share a transaction-scoped write lock. */
@Component
public class TeachingLocks {
    private final DomainStore db;
    public TeachingLocks(DomainStore db) {this.db=db;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void teacher(UUID teacher) {db.rows("select pg_advisory_xact_lock(hashtextextended(?,0))","tinyclass-schedule:"+teacher);}
}
