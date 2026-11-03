package com.tinyclass.billing;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import com.tinyclass.billing.TuitionDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class TuitionService {
    private static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    private static final List<String> TERMS=List.of("pricingMode","collectionTiming","sessionUnitPriceVnd","monthlyAmountVnd","programTotalVnd","programLabel","expectedSessions","chargeExcusedAbsence","chargeUnexcusedAbsence","fixedFeeAbsenceRule","publicTerms");
    private static final String AGREEMENT="select a.*,e.student_id,e.class_id,e.status as enrollment_status,st.full_name as student_name,st.status as student_status,c.name as class_name,c.status as class_status from enrollment_tuition_agreements a join class_enrollments e on e.id=a.enrollment_id join students st on st.id=e.student_id join classes c on c.id=e.class_id ";
    private final DomainStore db;
    private final GuardianService guardians;
    public TuitionService(DomainStore db,GuardianService guardians){this.db=db;this.guardians=guardians;}

    public Map<String,Object> policyWorkspace(UUID teacher,UUID classroom) {
        var c=classroom(teacher,classroom,false);var result=new LinkedHashMap<String,Object>();result.put("classroom",c);result.put("policy",policy(classroom));result.put("canEdit",Set.of("DRAFT","ACTIVE").contains(c.get("status")));return result;
    }
    @Transactional
    public Map<String,Object> savePolicy(UUID teacher,UUID classroom,PolicyInput input,String trace) {
        var c=classroom(teacher,classroom,true);if(!Set.of("DRAFT","ACTIVE").contains(c.get("status")))throw conflict("POLICY_READ_ONLY","Lớp đã kết thúc/lưu trữ; chỉ xem chính sách cũ.");
        var values=terms(input.terms());values.put("internalNote",clean(input.internalNote()));var before=policy(classroom);
        if(before==null){if(input.version()!=null)throw conflict("VERSION_CONFLICT","Chính sách chưa được tạo; tải lại trước khi lưu.");UUID id=UUID.randomUUID();values.put("id",id);values.put("classId",classroom);insert("class_tuition_policies",values);audit(teacher,"POLICY_CREATED","TUITION_POLICY",id,Map.of(),policy(classroom),clean(input.reason()),trace);}
        else {version(before,input.version());boolean changed=values.entrySet().stream().anyMatch(e->!Objects.equals(before.get(e.getKey()),e.getValue()));if(changed){reason(input.reason());write("class_tuition_policies",id(before,"id"),values);audit(teacher,"POLICY_UPDATED","TUITION_POLICY",id(before,"id"),before,policy(classroom),input.reason().strip(),trace);}}
        return policyWorkspace(teacher,classroom);
    }
    public PageResponse<Map<String,Object>> policyHistory(UUID teacher,UUID classroom,int page,int size){classroom(teacher,classroom,false);pagination(page,size);var p=policy(classroom);return p==null?db.page(List.of(),0,page,size):history("TUITION_POLICY",id(p,"id"),page,size);}

    public Map<String,Object> enrollmentWorkspace(UUID teacher,UUID enrollment,int page,int size) {
        pagination(page,size);var e=enrollment(teacher,enrollment);var args=new ArrayList<Object>(List.of(enrollment,teacher));
        long total=db.count("select count(*) from enrollment_tuition_agreements a join class_enrollments e on e.id=a.enrollment_id join classes c on c.id=e.class_id where e.id=? and c.teacher_id=?",args.toArray());args.add(size);args.add((long)page*size);
        var rows=db.rows(AGREEMENT+"where e.id=? and c.teacher_id=? order by a.effective_from desc,a.created_at desc,a.id desc limit ? offset ?",args.toArray()).stream().map(r->decorate(r,false)).toList();
        var result=new LinkedHashMap<String,Object>();result.put("enrollment",e);result.put("policy",policy(id(e,"classId")));result.put("canCreate",writable(e));result.put("businessDate",today());result.put("agreements",db.page(rows,total,page,size));return result;
    }
    public Map<String,Object> teacherDetail(UUID teacher,UUID id){return decorate(db.one(AGREEMENT+"where a.id=? and c.teacher_id=?",id,teacher),false);}
    @Transactional
    public Map<String,Object> create(UUID teacher,UUID enrollment,AgreementInput input,String trace) {
        var e=lockEnrollment(teacher,enrollment);if(input.version()!=null)throw problem("UNEXPECTED_VERSION","Tạo mới không dùng phiên bản thỏa thuận cũ.");String hash=fingerprint(input,null);
        var retry=retry(teacher,enrollment,input.clientRequestId(),hash);if(retry!=null)return retry;
        requireWritable(e);dates(e,input.effectiveFrom(),input.effectiveTo());var values=agreementValues(e,input);overlap(enrollment,input.effectiveFrom(),input.effectiveTo(),null);
        UUID id=UUID.randomUUID();values.put("id",id);values.put("clientRequestId",input.clientRequestId());values.put("requestHash",hash);insert("enrollment_tuition_agreements",values);
        var after=teacherDetail(teacher,id);audit(teacher,"AGREEMENT_CREATED","TUITION_AGREEMENT",id,Map.of(),after,clean(input.reason()),trace);return after;
    }
    @Transactional
    public Map<String,Object> replace(UUID teacher,UUID agreement,AgreementInput input,String trace) {
        var reference=owned(teacher,agreement);UUID enrollment=id(reference,"enrollmentId");var e=lockEnrollment(teacher,enrollment);String hash=fingerprint(input,agreement);
        var retry=retry(teacher,enrollment,input.clientRequestId(),hash);if(retry!=null)return retry;
        var before=owned(teacher,agreement);version(before,input.version());reason(input.reason());requireWritable(e);
        if("CANCELLED".equals(before.get("status")) || before.get("replacementId")!=null)throw conflict("AGREEMENT_REPLACED","Bản này đã hủy/thay thế. Chọn thỏa thuận hiện tại.");
        LocalDate from=input.effectiveFrom(),oldFrom=(LocalDate)before.get("effectiveFrom"),oldTo=(LocalDate)before.get("effectiveTo");dates(e,from,input.effectiveTo());
        if(from.isBefore(today()) || from.isBefore(oldFrom) || oldTo!=null&&from.isAfter(oldTo))throw problem("INVALID_CHANGE_DATE","Ngày đổi mức phải từ hôm nay và nằm trong khoảng hiệu lực của bản cũ.");
        protectInvoices(before,from.equals(oldFrom)?null:from.minusDays(1),true);
        var values=agreementValues(e,input);overlap(enrollment,from,input.effectiveTo(),agreement);UUID id=UUID.randomUUID();
        if(from.equals(oldFrom))db.update("update enrollment_tuition_agreements set status='CANCELLED',cancelled_at=clock_timestamp(),change_reason=?,updated_at=clock_timestamp(),version=version+1 where id=?",input.reason().strip(),agreement);
        else db.update("update enrollment_tuition_agreements set status='ENDED',effective_to=?,change_reason=?,updated_at=clock_timestamp(),version=version+1 where id=?",from.minusDays(1),input.reason().strip(),agreement);
        values.put("id",id);values.put("clientRequestId",input.clientRequestId());values.put("requestHash",hash);insert("enrollment_tuition_agreements",values);db.update("update enrollment_tuition_agreements set replacement_id=? where id=?",id,agreement);
        var after=teacherDetail(teacher,id);audit(teacher,"AGREEMENT_REPLACED","TUITION_AGREEMENT",agreement,decorate(before,false),teacherDetail(teacher,agreement),input.reason().strip(),trace);audit(teacher,"AGREEMENT_CREATED","TUITION_AGREEMENT",id,Map.of(),after,input.reason().strip(),trace);return after;
    }
    @Transactional
    public Map<String,Object> end(UUID teacher,UUID agreement,EndInput input,String trace) {
        var reference=owned(teacher,agreement);lockEnrollment(teacher,id(reference,"enrollmentId"));var before=owned(teacher,agreement);version(before,input.version());requireNotReplaced(before);
        LocalDate end=input.effectiveTo(),from=(LocalDate)before.get("effectiveFrom"),old=(LocalDate)before.get("effectiveTo");date(end);
        if(end.isBefore(today()) || end.isBefore(from) || old!=null&&end.isAfter(old))throw problem("INVALID_END_DATE","Chỉ rút ngắn ngày cuối áp dụng từ hôm nay trở đi, không sửa các ngày đã qua.");
        protectInvoices(before,end,false);
        if("ENDED".equals(before.get("status"))&&end.equals(old))return teacherDetail(teacher,agreement);
        db.update("update enrollment_tuition_agreements set effective_to=?,status='ENDED',change_reason=?,updated_at=clock_timestamp(),version=version+1 where id=?",end,input.reason().strip(),agreement);
        var after=teacherDetail(teacher,agreement);audit(teacher,"AGREEMENT_ENDED","TUITION_AGREEMENT",agreement,decorate(before,false),after,input.reason().strip(),trace);return after;
    }
    @Transactional
    public Map<String,Object> cancel(UUID teacher,UUID agreement,CancelInput input,String trace) {
        var reference=owned(teacher,agreement);lockEnrollment(teacher,id(reference,"enrollmentId"));var before=owned(teacher,agreement);version(before,input.version());
        if("CANCELLED".equals(before.get("status")))return teacherDetail(teacher,agreement);requireNotReplaced(before);
        if(((LocalDate)before.get("effectiveFrom")).isBefore(today()))throw conflict("AGREEMENT_ALREADY_APPLIED","Không hủy điều kiện đã áp dụng qua ngày trước. Kết thúc phần tương lai hoặc tạo mức thay thế.");
        protectInvoices(before,null,false);
        db.update("update enrollment_tuition_agreements set status='CANCELLED',cancelled_at=clock_timestamp(),change_reason=?,updated_at=clock_timestamp(),version=version+1 where id=?",input.reason().strip(),agreement);
        var after=teacherDetail(teacher,agreement);audit(teacher,"AGREEMENT_CANCELLED","TUITION_AGREEMENT",agreement,decorate(before,false),after,input.reason().strip(),trace);return after;
    }
    public PageResponse<Map<String,Object>> agreementHistory(UUID teacher,UUID agreement,int page,int size){teacherDetail(teacher,agreement);pagination(page,size);return history("TUITION_AGREEMENT",agreement,page,size);}
    public Map<String,Object> familyWorkspace(UUID parent,UUID child,int page,int size) {
        var student=guardians.child(parent,child);pagination(page,size);long total=db.count("select count(*) from enrollment_tuition_agreements a join class_enrollments e on e.id=a.enrollment_id where e.student_id=?",child);
        var rows=db.rows(AGREEMENT+"where e.student_id=? order by a.effective_from desc,a.created_at desc,a.id desc limit ? offset ?",child,size,(long)page*size).stream().map(r->decorate(r,true)).toList();
        return Map.of("student",Map.of("id",student.id(),"fullName",student.fullName(),"status",student.status()),"businessDate",today(),"agreements",db.page(rows,total,page,size));
    }
    public Map<String,Object> familyDetail(UUID parent,UUID child,UUID agreement){guardians.child(parent,child);return decorate(db.one(AGREEMENT+"where a.id=? and e.student_id=?",agreement,child),true);}

    private Map<String,Object> agreementValues(Map<String,Object> enrollment,AgreementInput input) {
        var result=new LinkedHashMap<String,Object>();
        if("POLICY".equals(input.source())){if(input.terms()!=null || input.policyVersion()==null)throw problem("INVALID_SOURCE","Dùng chính sách lớp cần phiên bản chính sách và không gửi mức riêng.");var policy=policy(id(enrollment,"classId"));if(policy==null)throw conflict("POLICY_REQUIRED","Lớp chưa có chính sách. Thiết lập mặc định hoặc chọn mức riêng.");version(policy,input.policyVersion());for(String key:TERMS)result.put(key,policy.get(key));result.put("sourcePolicyId",id(policy,"id"));result.put("sourcePolicyVersion",number(policy,"version"));}
        else {if(input.terms()==null || input.policyVersion()!=null)throw problem("INVALID_SOURCE","Thiết lập riêng cần bộ điều kiện đầy đủ và không dùng phiên bản chính sách lớp.");result.putAll(terms(input.terms()));result.put("sourcePolicyId",null);result.put("sourcePolicyVersion",null);}
        result.put("enrollmentId",id(enrollment,"id"));result.put("sourceType",input.source());result.put("effectiveFrom",input.effectiveFrom());result.put("effectiveTo",input.effectiveTo());result.put("internalNote",clean(input.internalNote()));result.put("changeReason",clean(input.reason()));return result;
    }
    private LinkedHashMap<String,Object> terms(Terms input) {
        if(input==null)throw problem("TERMS_REQUIRED","Nhập điều kiện học phí.");
        boolean session="PER_SESSION".equals(input.pricingMode()),monthly="MONTHLY_FIXED".equals(input.pricingMode()),program="FULL_PROGRAM".equals(input.pricingMode());
        if(!(session||monthly||program) || !Set.of("AT_PERIOD_START","AT_PERIOD_END","UPFRONT").contains(input.collectionTiming()))throw problem("INVALID_TERMS","Cách tính hoặc thời điểm thu chưa hợp lệ.");
        String label=clean(input.programLabel()),rule=clean(input.fixedFeeAbsenceRule());
        boolean rightAmounts=session?input.sessionUnitPriceVnd()!=null&&input.monthlyAmountVnd()==null&&input.programTotalVnd()==null:monthly?input.monthlyAmountVnd()!=null&&input.sessionUnitPriceVnd()==null&&input.programTotalVnd()==null:input.programTotalVnd()!=null&&input.sessionUnitPriceVnd()==null&&input.monthlyAmountVnd()==null;
        boolean rightAbsence=session?input.chargeExcusedAbsence()!=null&&input.chargeUnexcusedAbsence()!=null&&rule==null:input.chargeExcusedAbsence()==null&&input.chargeUnexcusedAbsence()==null&&Set.of("KEEP_AGREED_AMOUNT","MANUAL_ADJUSTMENT").contains(Objects.toString(rule,""));
        if(!rightAmounts || !rightAbsence || program&&label==null || !program&&(label!=null||input.expectedSessions()!=null))throw problem("INCOMPATIBLE_TERMS","Chỉ nhập số tiền/tham số của cách tính đã chọn và chọn rõ quy tắc khi bé nghỉ.");
        var result=new LinkedHashMap<String,Object>();result.put("pricingMode",input.pricingMode());result.put("collectionTiming",input.collectionTiming());result.put("sessionUnitPriceVnd",money(input.sessionUnitPriceVnd()));result.put("monthlyAmountVnd",money(input.monthlyAmountVnd()));result.put("programTotalVnd",money(input.programTotalVnd()));result.put("programLabel",label);result.put("expectedSessions",input.expectedSessions());result.put("chargeExcusedAbsence",input.chargeExcusedAbsence());result.put("chargeUnexcusedAbsence",input.chargeUnexcusedAbsence());result.put("fixedFeeAbsenceRule",rule);result.put("publicTerms",clean(input.publicTerms()));return result;
    }
    private Long money(BigDecimal value){if(value==null)return null;try{long amount=value.longValueExact();if(amount<0||amount>1000000000000L)throw new ArithmeticException();return amount;}catch(ArithmeticException failure){throw problem("INVALID_MONEY","Số tiền phải là VND nguyên từ 0 đến 1.000.000.000.000.");}}
    private void dates(Map<String,Object> e,LocalDate from,LocalDate to){date(from);if(to!=null){date(to);if(to.isBefore(from))throw problem("INVALID_EFFECTIVE_RANGE","Ngày cuối không được trước ngày bắt đầu.");}LocalDate joined=((Instant)e.get("joinedAt")).atZone(ZONE).toLocalDate(),start=(LocalDate)e.get("classStartDate"),end=(LocalDate)e.get("classEndDate");if(from.isBefore(joined)||start!=null&&from.isBefore(start)||end!=null&&(from.isAfter(end)||to==null||to.isAfter(end)))throw problem("OUTSIDE_ENROLLMENT_DATES","Hiệu lực cần từ ngày bé tham gia và nằm trong ngày dạy của lớp.");}
    private void date(LocalDate day){if(day==null||day.getYear()<1900||day.getYear()>2200)throw problem("INVALID_DATE","Ngày hiệu lực cần trong năm 1900–2200.");}
    private void overlap(UUID enrollment,LocalDate from,LocalDate to,UUID ignore){var args=new ArrayList<Object>();args.add(enrollment);args.add(from);args.add(to);if(ignore!=null)args.add(ignore);if(db.count("select count(*) from enrollment_tuition_agreements where enrollment_id=? and status<>'CANCELLED' and coalesce(effective_to,date '9999-12-31')>=? and effective_from<=coalesce(?::date,date '9999-12-31')"+(ignore==null?"":" and id<>?"),args.toArray())>0)throw conflict("AGREEMENT_OVERLAP","Khoảng ngày đã có mức học phí. Chọn thay mức của thỏa thuận hiện tại hoặc một khoảng không trùng.");}
    private Map<String,Object> retry(UUID teacher,UUID enrollment,UUID request,String hash){var found=db.rows("select id,request_hash from enrollment_tuition_agreements where enrollment_id=? and client_request_id=?",enrollment,request);if(found.isEmpty())return null;var row=found.getFirst();if(!hash.equals(row.get("requestHash")))throw conflict("REQUEST_REUSED","Mã lưu đã dùng cho nội dung khác. Tải lại để đối chiếu bản đã lưu.");return teacherDetail(teacher,id(row,"id"));}
    private String fingerprint(AgreementInput i,UUID replaced){return hash(db.json(Arrays.asList(replaced,i.version(),i.source(),i.policyVersion(),i.terms()==null?null:terms(i.terms()),i.effectiveFrom(),i.effectiveTo(),clean(i.internalNote()),clean(i.reason()))));}
    private Map<String,Object> decorate(Map<String,Object> row,boolean family){var result=new LinkedHashMap<>(row);result.remove("requestHash");result.remove("clientRequestId");String period="CANCELLED".equals(row.get("status"))?"CANCELLED":today().isBefore((LocalDate)row.get("effectiveFrom"))?"UPCOMING":row.get("effectiveTo")!=null&&today().isAfter((LocalDate)row.get("effectiveTo"))?"ENDED":"CURRENT";result.put("periodState",period);
        if(!family){var usage=invoiceUsage(id(row,"id"));LocalDate billed=(LocalDate)usage.get("billedThrough");boolean has=number(usage,"invoiceCount")>0;boolean available=!"CANCELLED".equals(row.get("status"))&&row.get("replacementId")==null;result.put("billedThrough",billed);result.put("hasInvoices",has);result.put("canReplace",available&&active(row)&&!"ENDED".equals(period)&&!(has&&"FULL_PROGRAM".equals(row.get("pricingMode")))&&(billed==null||row.get("effectiveTo")==null||billed.isBefore((LocalDate)row.get("effectiveTo"))));result.put("canEnd",available&&(row.get("effectiveTo")==null||!((LocalDate)row.get("effectiveTo")).isBefore(today())));result.put("canCancel",available&&!has&&!((LocalDate)row.get("effectiveFrom")).isBefore(today()));return result;}
        var publicRow=new LinkedHashMap<String,Object>();for(String key:List.of("id","classId","className","effectiveFrom","effectiveTo","status","periodState","cancelledAt","updatedAt"))publicRow.put(key,result.get(key));for(String key:TERMS)publicRow.put(key,result.get(key));return publicRow;
    }
    private Map<String,Object> classroom(UUID teacher,UUID id,boolean lock){return db.one("select id,name,status,start_date,end_date from classes where id=? and teacher_id=?"+(lock?" for update":""),id,teacher);}
    private Map<String,Object> enrollment(UUID teacher,UUID id){return db.one("select e.id,e.class_id,c.name as class_name,c.status as class_status,c.start_date as class_start_date,c.end_date as class_end_date,e.student_id,st.full_name as student_name,st.status as student_status,e.status,e.joined_at,e.ended_at from class_enrollments e join classes c on c.id=e.class_id join students st on st.id=e.student_id where e.id=? and c.teacher_id=?",id,teacher);}
    private Map<String,Object> lockEnrollment(UUID teacher,UUID id){var e=enrollment(teacher,id);classroom(teacher,id(e,"classId"),true);db.one("select id from students where id=? and teacher_id=? for update",id(e,"studentId"),teacher);db.one("select id from class_enrollments where id=? for update",id);return enrollment(teacher,id);}
    private Map<String,Object> policy(UUID classroom){var rows=db.rows("select * from class_tuition_policies where class_id=?",classroom);return rows.isEmpty()?null:rows.getFirst();}
    private Map<String,Object> owned(UUID teacher,UUID id){return db.one(AGREEMENT+"where a.id=? and c.teacher_id=?",id,teacher);}
    private boolean writable(Map<String,Object> e){return "ACTIVE".equals(e.get("classStatus"))&&"ACTIVE".equals(e.get("studentStatus"))&&"ACTIVE".equals(e.get("status"));}
    private boolean active(Map<String,Object> row){return "ACTIVE".equals(row.get("classStatus"))&&"ACTIVE".equals(row.get("studentStatus"))&&"ACTIVE".equals(row.get("enrollmentStatus"));}
    private void requireWritable(Map<String,Object> e){if(!writable(e))throw conflict("TUITION_READ_ONLY","Thỏa thuận mới/thay mức cần lớp, hồ sơ và việc tham gia đang hoạt động.");}
    private void requireNotReplaced(Map<String,Object> row){if("CANCELLED".equals(row.get("status"))||row.get("replacementId")!=null)throw conflict("AGREEMENT_REPLACED","Bản đã hủy/thay thế chỉ được xem lại.");}
    private Map<String,Object> invoiceUsage(UUID agreement){return db.one("select count(*) as invoice_count,max(period_end) as billed_through from invoices where agreement_id=? and status<>'CANCELLED'",agreement);}
    private void protectInvoices(Map<String,Object> agreement,LocalDate end,boolean replacing){var usage=invoiceUsage(id(agreement,"id"));if(number(usage,"invoiceCount")==0)return;LocalDate billed=(LocalDate)usage.get("billedThrough");if(end==null||billed.isAfter(end)||replacing&&"FULL_PROGRAM".equals(agreement.get("pricingMode")))throw conflict("AGREEMENT_INVOICED","Thỏa thuận đang có phiếu chưa hủy. Không cắt ngày đã giữ/tính hoặc thay lại tổng trọn khóa; đối chiếu các phiếu trước.");}
    private void reason(String value){if(clean(value)==null)throw problem("REASON_REQUIRED","Nhập lý do thay đổi để đối chiếu sau này.");}
    private PageResponse<Map<String,Object>> history(String type,UUID id,int page,int size){long total=db.count("select count(*) from audit_events where entity_type=? and entity_id=?",type,id);return db.page(db.rows("select a.id,a.action,a.changed_fields,a.reason,a.created_at,u.display_name as actor_name from audit_events a join users u on u.id=a.actor_id where a.entity_type=? and a.entity_id=? order by a.created_at desc,a.id desc limit ? offset ?",type,id,size,(long)page*size),total,page,size);}
    private void audit(UUID actor,String action,String type,UUID id,Map<String,Object> before,Map<String,Object> after,String reason,String trace){db.audit(actor,"TUITION_"+action,type,id,Map.of("before",before,"after",after),reason,trace);}
    private void insert(String table,Map<String,Object> values){db.update("insert into "+table+"("+String.join(",",values.keySet().stream().map(this::column).toList())+") values("+String.join(",",Collections.nCopies(values.size(),"?"))+")",values.values().toArray());}
    private void write(String table,UUID id,Map<String,Object> values){var args=new ArrayList<Object>(values.values());args.add(id);db.update("update "+table+" set "+String.join(",",values.keySet().stream().map(k->column(k)+"=?").toList())+",updated_at=clock_timestamp(),version=version+1 where id=?",args.toArray());}
    private String column(String key){return key.replaceAll("([A-Z])","_$1").toLowerCase(Locale.ROOT);}
    private static LocalDate today(){return LocalDate.now(ZONE);}
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException failure){throw new IllegalStateException(failure);}}
}
