package com.tinyclass;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import javax.sql.DataSource;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class MigrationTests {
    @Autowired DataSource source;
    @Autowired JdbcTemplate jdbc;

    @Test
    void allMigrationsRunFromAnEmptySchema() {
        String schema = newTestSchema();
        try {
            var flyway = Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();
            assertThat(flyway.migrate().migrationsExecuted).isEqualTo(17);
            flyway.validate();
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema = ? and table_name in ('users', 'classes', 'students', 'class_enrollments', 'audit_events')", Integer.class, schema)).isEqualTo(5);
        } finally { dropTestSchema(schema); }
    }

    @Test
    void upgradeFromV1KeepsExistingAuditEvents() {
        String schema = newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("1").load().migrate();
            UUID id = UUID.randomUUID();
            jdbc.update("insert into " + schema + ".audit_events(id, action, entity_type) values (?, 'FOUNDATION_CHECK', 'SYSTEM')", id);
            var flyway = Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();
            assertThat(flyway.migrate().migrationsExecuted).isGreaterThanOrEqualTo(6);
            flyway.validate();
            assertThat(jdbc.queryForObject("select count(*) from " + schema + ".audit_events where id = ?", Integer.class, id)).isEqualTo(1);
        } finally { dropTestSchema(schema); }
    }

    @Test
    void upgradeFromV7PreservesCompletedProgressAndStartsReviewCycleAtZero() {
        String schema = newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("7").load().migrate();
            UUID teacher=UUID.randomUUID(),child=UUID.randomUUID(),lesson=UUID.randomUUID(),assignment=UUID.randomUUID(),item=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'migration-teacher@example.test','Migration teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".students(id,teacher_id,full_name,status,created_at,updated_at) values(?,?,'Migration child','ACTIVE',now(),now())",child,teacher);
            jdbc.update("insert into "+schema+".lessons(id,teacher_id,title,default_completion_mode,status) values(?,?,'Legacy lesson','PARENT_CONFIRM','PUBLISHED')",lesson,teacher);
            jdbc.update("insert into "+schema+".assignments(id,teacher_id,title,source_type,lesson_id,target_type,student_id,status,client_request_id,request_hash) values(?,?,'Legacy assignment','LESSON',?,'STUDENT',?,'PUBLISHED',?,'legacy')",assignment,teacher,lesson,child,UUID.randomUUID());
            jdbc.update("insert into "+schema+".assignment_items(id,assignment_id,lesson_id,position,is_required,completion_mode) values(?,?,?,0,true,'PARENT_CONFIRM')",item,assignment,lesson);
            jdbc.update("insert into "+schema+".student_progress(id,assignment_item_id,student_id,status,parent_confirmed_at,completed_at) values(?,?,?,'COMPLETED',now(),now())",UUID.randomUUID(),item,child);
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();
            assertThat(flyway.migrate().migrationsExecuted).isEqualTo(10);flyway.validate();
            assertThat(jdbc.queryForObject("select status from "+schema+".student_progress where assignment_item_id=?",String.class,item)).isEqualTo("COMPLETED");
            assertThat(jdbc.queryForObject("select review_cycle from "+schema+".student_progress where assignment_item_id=?",Integer.class,item)).isZero();
            assertThat(jdbc.queryForObject("select completed_at is not null from "+schema+".student_progress where assignment_item_id=?",Boolean.class,item)).isTrue();
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=? and table_name in('submissions','submission_attachments','submission_events')",Integer.class,schema)).isEqualTo(3);
        } finally {dropTestSchema(schema);}
    }

    @Test
    void upgradeFromV8AddsCalendarWithoutChangingExistingClasses() {
        String schema=newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("8").load().migrate();
            UUID teacher=UUID.randomUUID(),classroom=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'calendar-migration@example.test','Migration teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".classes(id,teacher_id,name,status,version,created_at,updated_at) values(?,?,'Existing class','ACTIVE',4,now(),now())",classroom,teacher);
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();
            assertThat(flyway.migrate().migrationsExecuted).isEqualTo(9);flyway.validate();
            assertThat(jdbc.queryForObject("select version from "+schema+".classes where id=?",Long.class,classroom)).isEqualTo(4);
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=? and table_name in('class_schedule_rules','class_sessions')",Integer.class,schema)).isEqualTo(2);
        } finally {dropTestSchema(schema);}
    }

    @Test
    void upgradeFromV9KeepsSessionIdentityTimesAndExceptions() {
        String schema=newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("9").load().migrate();
            UUID teacher=UUID.randomUUID(),classroom=UUID.randomUUID(),session=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'attendance-migration@example.test','Migration teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".classes(id,teacher_id,name,status,created_at,updated_at) values(?,?,'Existing class','ACTIVE',now(),now())",classroom,teacher);
            jdbc.update("insert into "+schema+".class_sessions(id,class_id,title,starts_at,ends_at,is_manual_override,version) values(?,?,'Existing exception',now()+interval '1 day',now()+interval '1 day 1 hour',true,7)",session,classroom);
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();assertThat(flyway.migrate().migrationsExecuted).isEqualTo(8);flyway.validate();
            assertThat(jdbc.queryForObject("select version from "+schema+".class_sessions where id=?",Long.class,session)).isEqualTo(7);
            assertThat(jdbc.queryForObject("select is_manual_override and completed_at is null and roster_created_at is null from "+schema+".class_sessions where id=?",Boolean.class,session)).isTrue();
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=? and table_name in ('attendance_records','attendance_events')",Integer.class,schema)).isEqualTo(2);
        } finally {dropTestSchema(schema);}
    }

    @Test
    void upgradeFromV10PreservesAttendanceAndAddsPrivateNoteBindings() {
        String schema=newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("10").load().migrate();
            UUID teacher=UUID.randomUUID(),child=UUID.randomUUID(),classroom=UUID.randomUUID(),enrollment=UUID.randomUUID(),session=UUID.randomUUID(),attendance=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'notes-migration@example.test','Migration teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".students(id,teacher_id,full_name,status,created_at,updated_at) values(?,?,'Legacy child','ACTIVE',now(),now())",child,teacher);
            jdbc.update("insert into "+schema+".classes(id,teacher_id,name,status,created_at,updated_at) values(?,?,'Legacy class','ACTIVE',now(),now())",classroom,teacher);
            jdbc.update("insert into "+schema+".class_enrollments(id,class_id,student_id,status,joined_at,status_changed_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now(),now())",enrollment,classroom,child);
            jdbc.update("insert into "+schema+".class_sessions(id,class_id,title,starts_at,ends_at,roster_created_at,version) values(?,?,'Legacy roster',now()-interval '2 hours',now()-interval '1 hour',now(),5)",session,classroom);
            jdbc.update("insert into "+schema+".attendance_records(id,session_id,student_id,enrollment_id,student_name_snapshot,status,marked_by,marked_at,note,family_note,version) values(?,?,?,?,'Snapshot name','PRESENT',?,now(),'Private attendance note','Shared attendance note',3)",attendance,session,child,enrollment,teacher);
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();assertThat(flyway.migrate().migrationsExecuted).isEqualTo(7);flyway.validate();
            assertThat(jdbc.queryForObject("select version from "+schema+".attendance_records where id=?",Long.class,attendance)).isEqualTo(3);
            assertThat(jdbc.queryForObject("select note from "+schema+".attendance_records where id=?",String.class,attendance)).isEqualTo("Private attendance note");
            assertThat(jdbc.queryForObject("select version from "+schema+".class_sessions where id=?",Long.class,session)).isEqualTo(5);
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=? and table_name in ('student_notes','student_note_attachments')",Integer.class,schema)).isEqualTo(2);
        } finally {dropTestSchema(schema);}
    }

    @Test
    void upgradeFromV11KeepsPrivateNotesAndPermanentFileBindings() {
        String schema=newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("11").load().migrate();
            UUID teacher=UUID.randomUUID(),child=UUID.randomUUID(),note=UUID.randomUUID(),connection=UUID.randomUUID(),file=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'tuition-migration@example.test','Migration teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".students(id,teacher_id,full_name,status,created_at,updated_at) values(?,?,'Legacy child','ACTIVE',now(),now())",child,teacher);
            jdbc.update("insert into "+schema+".student_notes(id,teacher_id,student_id,title,body,observed_on,visibility,client_request_id,create_hash,version) values(?,?,?,'Legacy note','Private legacy observation',current_date,'PRIVATE',?,'legacy',7)",note,teacher,child,UUID.randomUUID());
            jdbc.update("insert into "+schema+".storage_connections(id,teacher_id,provider,display_name,root_reference,status,created_at,updated_at) values(?,?,'LOCAL','Legacy storage','legacy','CONNECTED',now(),now())",connection,teacher);
            jdbc.update("insert into "+schema+".files(id,uploaded_by,storage_connection_id,purpose,storage_key,original_name,mime_type,size_bytes,status,created_at,updated_at,context_student_note_id) values(?,?,?,'NOTE_ASSET','legacy.png','legacy.png','image/png',68,'READY',now(),now(),?)",file,teacher,connection,note);
            jdbc.update("insert into "+schema+".student_note_attachments(student_note_id,file_id,position) values(?,?,0)",note,file);
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();assertThat(flyway.migrate().migrationsExecuted).isEqualTo(6);flyway.validate();
            assertThat(jdbc.queryForObject("select version from "+schema+".student_notes where id=?",Long.class,note)).isEqualTo(7);
            assertThat(jdbc.queryForObject("select body from "+schema+".student_notes where id=?",String.class,note)).isEqualTo("Private legacy observation");
            assertThat(jdbc.queryForObject("select context_student_note_id from "+schema+".files where id=?",UUID.class,file)).isEqualTo(note);
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=? and table_name in ('class_tuition_policies','enrollment_tuition_agreements')",Integer.class,schema)).isEqualTo(2);
        } finally {dropTestSchema(schema);}
    }

    @Test
    void upgradeFromV12KeepsIndividualTuitionAndAddsInvoiceReservations() {
        String schema=newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("12").load().migrate();
            UUID teacher=UUID.randomUUID(),child=UUID.randomUUID(),classroom=UUID.randomUUID(),enrollment=UUID.randomUUID(),agreement=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'invoice-migration@example.test','Migration teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".students(id,teacher_id,full_name,status,created_at,updated_at) values(?,?,'Legacy child','ACTIVE',now(),now())",child,teacher);
            jdbc.update("insert into "+schema+".classes(id,teacher_id,name,status,created_at,updated_at) values(?,?,'Legacy class','ACTIVE',now(),now())",classroom,teacher);
            jdbc.update("insert into "+schema+".class_enrollments(id,class_id,student_id,status,joined_at,status_changed_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now(),now())",enrollment,classroom,child);
            jdbc.update("insert into "+schema+".enrollment_tuition_agreements(id,enrollment_id,source_type,pricing_mode,collection_timing,session_unit_price_vnd,charge_excused_absence,charge_unexcused_absence,effective_from,internal_note,client_request_id,request_hash,version) values(?,?,'CUSTOM','PER_SESSION','AT_PERIOD_END',1000000000000,false,true,current_date,'Private legacy agreement',?,?,5)",agreement,enrollment,UUID.randomUUID(),"b".repeat(64));
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();assertThat(flyway.migrate().migrationsExecuted).isEqualTo(5);flyway.validate();
            assertThat(jdbc.queryForObject("select session_unit_price_vnd from "+schema+".enrollment_tuition_agreements where id=?",Long.class,agreement)).isEqualTo(1_000_000_000_000L);
            assertThat(jdbc.queryForObject("select version from "+schema+".enrollment_tuition_agreements where id=?",Long.class,agreement)).isEqualTo(5);
            assertThat(jdbc.queryForObject("select internal_note from "+schema+".enrollment_tuition_agreements where id=?",String.class,agreement)).isEqualTo("Private legacy agreement");
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=? and table_name in ('invoices','invoice_lines','session_charge_entries')",Integer.class,schema)).isEqualTo(3);
            assertThat(jdbc.queryForObject("select count(*) from pg_constraint where conrelid=(?||'.invoices')::regclass and conname in ('invoices_period_order','invoices_due_date_bounds')",Integer.class,schema)).isEqualTo(2);
        } finally {dropTestSchema(schema);}
    }

    @Test
    void upgradeFromV15KeepsIssuedInvoiceLinesAndChargeSnapshots() {
        String schema=newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("15").load().migrate();
            UUID teacher=UUID.randomUUID(),child=UUID.randomUUID(),classroom=UUID.randomUUID(),enrollment=UUID.randomUUID(),agreement=UUID.randomUUID(),session=UUID.randomUUID(),attendance=UUID.randomUUID(),invoice=UUID.randomUUID(),line=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'payment-migration@example.test','Migration teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".students(id,teacher_id,full_name,status,created_at,updated_at) values(?,?,'Legacy child','ACTIVE',now(),now())",child,teacher);
            jdbc.update("insert into "+schema+".classes(id,teacher_id,name,status,created_at,updated_at) values(?,?,'Legacy class','ACTIVE',now(),now())",classroom,teacher);
            jdbc.update("insert into "+schema+".class_enrollments(id,class_id,student_id,status,joined_at,status_changed_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now(),now())",enrollment,classroom,child);
            jdbc.update("insert into "+schema+".enrollment_tuition_agreements(id,enrollment_id,source_type,pricing_mode,collection_timing,session_unit_price_vnd,charge_excused_absence,charge_unexcused_absence,effective_from,client_request_id,request_hash) values(?,?,'CUSTOM','PER_SESSION','UPFRONT',800000,false,true,current_date,?,?)",agreement,enrollment,UUID.randomUUID(),"b".repeat(64));
            jdbc.update("insert into "+schema+".class_sessions(id,class_id,title,starts_at,ends_at,status,roster_created_at) values(?,?,'Legacy session',now()-interval '2 hours',now()-interval '1 hour','COMPLETED',now())",session,classroom);
            jdbc.update("insert into "+schema+".attendance_records(id,session_id,student_id,enrollment_id,student_name_snapshot,status,marked_by,marked_at) values(?,?,?,?,'Legacy name','PRESENT',?,now())",attendance,session,child,enrollment,teacher);
            jdbc.update("insert into "+schema+".invoices(id,teacher_id,student_id,class_id,enrollment_id,agreement_id,invoice_code,student_name_snapshot,class_name_snapshot,pricing_mode,terms_snapshot,period_start,period_end,due_on,status,total_amount_vnd,internal_note,review_key,client_request_id,request_hash,issued_at,version) values(?,?,?,?,?,?,'LEGACY-PAYMENT-INVOICE','Legacy name','Legacy class','PER_SESSION','{}'::jsonb,current_date,current_date,current_date-1,'ISSUED',800000,'Private invoice memo',?,?,?,now(),7)",invoice,teacher,child,classroom,enrollment,agreement,"c".repeat(64),UUID.randomUUID(),"d".repeat(64));
            jdbc.update("insert into "+schema+".invoice_lines(id,invoice_id,position,description,pricing_basis,quantity,unit_price_vnd,discount_vnd,amount_vnd,attendance_id,source_snapshot) values(?,?,0,'Legacy line','PER_SESSION',1,800000,0,800000,?,'{}'::jsonb)",line,invoice,attendance);
            jdbc.update("insert into "+schema+".session_charge_entries(id,invoice_id,invoice_line_id,agreement_id,root_attendance_id,counted_attendance_id,unit_price_vnd_snapshot,status) values(?,?,?,?,?,?,800000,'CHARGED')",UUID.randomUUID(),invoice,line,agreement,attendance,attendance);
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();assertThat(flyway.migrate().migrationsExecuted).isEqualTo(2);flyway.validate();
            assertThat(jdbc.queryForObject("select version from "+schema+".invoices where id=?",Long.class,invoice)).isEqualTo(7);
            assertThat(jdbc.queryForObject("select total_amount_vnd from "+schema+".invoices where id=?",Long.class,invoice)).isEqualTo(800000);
            assertThat(jdbc.queryForObject("select internal_note from "+schema+".invoices where id=?",String.class,invoice)).isEqualTo("Private invoice memo");
            assertThat(jdbc.queryForObject("select amount_vnd from "+schema+".invoice_lines where id=?",Long.class,line)).isEqualTo(800000);
            assertThat(jdbc.queryForObject("select status from "+schema+".session_charge_entries where invoice_id=?",String.class,invoice)).isEqualTo("CHARGED");
            assertThat(jdbc.queryForObject("select count(*) from "+schema+".payments",Integer.class)).isZero();
        } finally {dropTestSchema(schema);}
    }

    @Test
    void upgradeFromV16KeepsRecordedPaymentsWithoutInventingNotifications() {
        String schema=newTestSchema();
        try {
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).target("16").load().migrate();
            UUID teacher=UUID.randomUUID(),child=UUID.randomUUID(),classroom=UUID.randomUUID(),enrollment=UUID.randomUUID(),agreement=UUID.randomUUID(),invoice=UUID.randomUUID(),payment=UUID.randomUUID();
            jdbc.update("insert into "+schema+".users(id,email,display_name,role,status,created_at,updated_at) values(?,'notification-migration@example.test','Legacy teacher','TEACHER','ACTIVE',now(),now())",teacher);
            jdbc.update("insert into "+schema+".students(id,teacher_id,full_name,status,created_at,updated_at) values(?,?,'Legacy child','ACTIVE',now(),now())",child,teacher);
            jdbc.update("insert into "+schema+".classes(id,teacher_id,name,status,created_at,updated_at) values(?,?,'Legacy class','ACTIVE',now(),now())",classroom,teacher);
            jdbc.update("insert into "+schema+".class_enrollments(id,class_id,student_id,status,joined_at,status_changed_at,created_at,updated_at) values(?,?,?,'ACTIVE',now(),now(),now(),now())",enrollment,classroom,child);
            jdbc.update("insert into "+schema+".enrollment_tuition_agreements(id,enrollment_id,source_type,pricing_mode,collection_timing,session_unit_price_vnd,charge_excused_absence,charge_unexcused_absence,effective_from,client_request_id,request_hash) values(?,?,'CUSTOM','PER_SESSION','UPFRONT',800000,false,true,current_date,?,?)",agreement,enrollment,UUID.randomUUID(),"a".repeat(64));
            jdbc.update("insert into "+schema+".invoices(id,teacher_id,student_id,class_id,enrollment_id,agreement_id,invoice_code,student_name_snapshot,class_name_snapshot,pricing_mode,terms_snapshot,period_start,period_end,status,total_amount_vnd,review_key,client_request_id,request_hash,issued_at,version) values(?,?,?,?,?,?,'LEGACY-NOTICE','Legacy child','Legacy class','PER_SESSION','{}',current_date,current_date,'ISSUED',800000,?,?,?,now(),3)",invoice,teacher,child,classroom,enrollment,agreement,"b".repeat(64),UUID.randomUUID(),"c".repeat(64));
            jdbc.update("insert into "+schema+".payments(id,invoice_id,amount_vnd,method,paid_at,recorded_by,internal_note,idempotency_key,request_hash,version) values(?,?,500000,'CASH',now(),?,'Private legacy payment','legacy-payment-key',?,5)",payment,invoice,teacher,"d".repeat(64));
            var flyway=Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema).load();assertThat(flyway.migrate().migrationsExecuted).isEqualTo(1);flyway.validate();
            assertThat(jdbc.queryForObject("select amount_vnd from "+schema+".payments where id=?",Long.class,payment)).isEqualTo(500000);
            assertThat(jdbc.queryForObject("select version from "+schema+".payments where id=?",Long.class,payment)).isEqualTo(5);
            assertThat(jdbc.queryForObject("select internal_note from "+schema+".payments where id=?",String.class,payment)).isEqualTo("Private legacy payment");
            assertThat(jdbc.queryForObject("select version from "+schema+".invoices where id=?",Long.class,invoice)).isEqualTo(3);
            assertThat(jdbc.queryForObject("select count(*) from "+schema+".notifications",Long.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from "+schema+".class_announcements",Long.class)).isZero();
        } finally {dropTestSchema(schema);}
    }

    private String newTestSchema() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("tinyclass_test");
        String schema = "migration_test_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("create schema " + schema);
        return schema;
    }
    private void dropTestSchema(String schema) {
        if (!schema.matches("migration_test_[a-f0-9]{32}")) throw new IllegalArgumentException("Not a temporary test schema");
        jdbc.execute("drop schema " + schema + " cascade");
    }
}
