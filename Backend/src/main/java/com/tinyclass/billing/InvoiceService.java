package com.tinyclass.billing;

import com.tinyclass.billing.InvoiceDtos.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.family.GuardianService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class InvoiceService {
    private static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    private static final long MAX=1_000_000_000_000L;
    private static final List<String> TERMS=List.of("pricingMode","collectionTiming","sessionUnitPriceVnd","monthlyAmountVnd","programTotalVnd","programLabel","expectedSessions","chargeExcusedAbsence","chargeUnexcusedAbsence","fixedFeeAbsenceRule","publicTerms");
    private static final String AGREEMENT="select a.*,e.student_id,e.class_id,e.joined_at,e.ended_at,e.status as enrollment_status,c.teacher_id,c.name as class_name,c.start_date as class_start_date,c.end_date as class_end_date,st.full_name as student_name from enrollment_tuition_agreements a join class_enrollments e on e.id=a.enrollment_id join classes c on c.id=e.class_id join students st on st.id=e.student_id ";
    private final DomainStore db;
    private final GuardianService guardians;
    private final PaymentLedger ledger;
    public InvoiceService(DomainStore db,GuardianService guardians,PaymentLedger ledger){this.db=db;this.guardians=guardians;this.ledger=ledger;}

    public Map<String,Object> preview(UUID teacher,PreviewInput input) {
        var a=agreement(teacher,input.agreementId());
        if(input.invoiceId()!=null){var invoice=owned(teacher,input.invoiceId());if(!input.agreementId().equals(id(invoice,"agreementId")))throw missing();requireDraft(invoice);}
        return buildPreview(a,input.periodStart(),input.periodEnd(),input.invoiceId());
    }

    @Transactional
    public Map<String,Object> create(UUID teacher,SaveInput input,String trace) {
        if(input.clientRequestId()==null || input.version()!=null)throw problem("INVALID_CREATE_REQUEST","Tạo phiếu cần mã yêu cầu mới và không gửi phiên bản cũ.");
        var a=lockAgreement(teacher,input.agreementId());String hash=fingerprint(input);
        var found=db.rows("select id,request_hash from invoices where teacher_id=? and client_request_id=?",teacher,input.clientRequestId());
        if(!found.isEmpty()){if(!hash.equals(found.getFirst().get("requestHash")))throw conflict("REQUEST_REUSED","Mã lưu đã dùng cho nội dung khác. Cập nhật danh sách để đối chiếu phiếu đã có.");return detail(teacher,id(found.getFirst(),"id"));}
        var preview=buildPreview(a,input.periodStart(),input.periodEnd(),null);validateSave(input,preview);
        var lines=validateLines(input,preview);long total=total(lines);UUID invoice=UUID.randomUUID();
        long sequence=db.count("select nextval('invoice_code_sequence')");String code="TC-"+LocalDate.now(ZONE).getYear()+"-"+String.format(Locale.ROOT,"%06d",sequence);
        db.update("insert into invoices(id,teacher_id,student_id,class_id,enrollment_id,agreement_id,invoice_code,student_name_snapshot,class_name_snapshot,pricing_mode,terms_snapshot,period_start,period_end,due_on,total_amount_vnd,public_note,internal_note,adjustment_reason,review_key,client_request_id,request_hash) values(?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?)",
                invoice,teacher,id(a,"studentId"),id(a,"classId"),id(a,"enrollmentId"),input.agreementId(),code,a.get("studentName"),a.get("className"),a.get("pricingMode"),db.json(snapshot(a)),input.periodStart(),input.periodEnd(),input.dueOn(),total,clean(input.publicNote()),clean(input.internalNote()),clean(input.adjustmentReason()),input.previewKey(),input.clientRequestId(),hash);
        insertLines(invoice,input.agreementId(),lines);var after=rawDetail(teacher,invoice);audit(teacher,"CREATED",invoice,Map.of(),after,clean(input.reason()),trace);return detail(teacher,invoice);
    }

    @Transactional
    public Map<String,Object> update(UUID teacher,UUID invoice,SaveInput input,String trace) {
        var reference=owned(teacher,invoice);if(!input.agreementId().equals(id(reference,"agreementId")))throw conflict("INVOICE_CONTEXT_FIXED","Không đổi bé/thỏa thuận của phiếu. Hủy nháp rồi tạo phiếu đúng nguồn.");
        var a=lockAgreement(teacher,input.agreementId());lockInvoice(teacher,invoice);var before=rawDetail(teacher,invoice);version(before,input.version());requireDraft(before);reason(input.reason());
        var preview=buildPreview(a,input.periodStart(),input.periodEnd(),invoice);validateSave(input,preview);var lines=validateLines(input,preview);long total=total(lines);
        voidCharges(invoice,input.reason().strip());db.update("update invoice_lines set is_active=false where invoice_id=? and is_active",invoice);
        db.update("update invoices set period_start=?,period_end=?,due_on=?,terms_snapshot=?::jsonb,total_amount_vnd=?,public_note=?,internal_note=?,adjustment_reason=?,review_key=?,updated_at=clock_timestamp(),version=version+1 where id=?",input.periodStart(),input.periodEnd(),input.dueOn(),db.json(snapshot(a)),total,clean(input.publicNote()),clean(input.internalNote()),clean(input.adjustmentReason()),input.previewKey(),invoice);
        insertLines(invoice,input.agreementId(),lines);audit(teacher,"UPDATED",invoice,before,rawDetail(teacher,invoice),input.reason().strip(),trace);return detail(teacher,invoice);
    }

    @Transactional
    public Map<String,Object> issue(UUID teacher,UUID invoice,IssueInput input,String trace) {
        var reference=owned(teacher,invoice);var a=lockAgreement(teacher,id(reference,"agreementId"));lockInvoice(teacher,invoice);var before=rawDetail(teacher,invoice);version(before,input.version());
        if("ISSUED".equals(before.get("status")))return detail(teacher,invoice);requireDraft(before);
        if(!input.reviewKey().equals(before.get("reviewKey")))throw conflict("INVOICE_REVIEW_CHANGED","Phiếu đã thay đổi. Đọc lại trước khi phát hành.");
        var preview=buildPreview(a,(LocalDate)before.get("periodStart"),(LocalDate)before.get("periodEnd"),invoice);
        if(!input.reviewKey().equals(preview.get("previewKey")))throw conflict("BILLING_SOURCE_CHANGED","Điểm danh hoặc nguồn tính phí đã thay đổi. Chỉnh sửa và xem trước lại phiếu nháp.");
        var lines=db.rows("select * from invoice_lines where invoice_id=? and is_active order by position",invoice);
        if(lines.isEmpty())throw problem("INVOICE_LINES_REQUIRED","Phiếu cần ít nhất một dòng trước khi phát hành; có thể ghi mức miễn phí 0 VND.");
        db.update("update invoices set status='ISSUED',issued_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where id=?",invoice);
        db.update("update session_charge_entries set status='CHARGED' where invoice_id=? and status='RESERVED'",invoice);
        audit(teacher,"ISSUED",invoice,before,rawDetail(teacher,invoice),null,trace);return detail(teacher,invoice);
    }

    @Transactional
    public Map<String,Object> cancel(UUID teacher,UUID invoice,CancelInput input,String trace) {
        var reference=owned(teacher,invoice);lockAgreement(teacher,id(reference,"agreementId"));lockInvoice(teacher,invoice);var before=rawDetail(teacher,invoice);version(before,input.version());
        if("CANCELLED".equals(before.get("status")))return detail(teacher,invoice);
        if(number(before,"paidAmountVnd")>0)throw conflict("INVOICE_HAS_PAYMENTS","Phiếu đang có khoản thu hợp lệ, chưa thể hủy. Nếu nhập sai, điều chỉnh bản ghi đó kèm lý do trước.");
        db.update("update invoices set status='CANCELLED',cancelled_at=clock_timestamp(),cancel_reason=?,updated_at=clock_timestamp(),version=version+1 where id=?",input.reason().strip(),invoice);
        voidCharges(invoice,input.reason().strip());audit(teacher,"CANCELLED",invoice,before,rawDetail(teacher,invoice),input.reason().strip(),trace);return detail(teacher,invoice);
    }

    public Map<String,Object> detail(UUID teacher,UUID invoice) {
        var row=rawDetail(teacher,invoice);boolean changed=false;String key=null;List<String> warnings=new ArrayList<>();
        if(!"CANCELLED".equals(row.get("status"))){try{var p=buildPreview(agreement(teacher,id(row,"agreementId")),(LocalDate)row.get("periodStart"),(LocalDate)row.get("periodEnd"),invoice);key=text(p,"previewKey");changed=!key.equals(row.get("reviewKey"));warnings.addAll(strings(p,"warnings"));}catch(ApiException unavailable){changed=true;warnings.add("Nguồn hoặc khoảng ngày không còn phù hợp. Đối chiếu lại phiếu và dữ liệu hiện tại.");}}
        row.put("sourceChanged",changed);row.put("currentPreviewKey",key);row.put("warnings",warnings);row.put("canEdit","DRAFT".equals(row.get("status")));row.put("canIssue","DRAFT".equals(row.get("status"))&&!changed&&!list(row,"lines").isEmpty());row.put("canCancel",!"CANCELLED".equals(row.get("status"))&&number(row,"paidAmountVnd")==0);row.put("canRecordPayment","ISSUED".equals(row.get("status"))&&number(row,"outstandingAmountVnd")>0);return row;
    }

    public PageResponse<Map<String,Object>> list(UUID teacher,String status,UUID enrollment,UUID classroom,UUID student,String collection,int page,int size) {
        pagination(page,size);if(status!=null&&!status.isBlank()&&!Set.of("DRAFT","ISSUED","CANCELLED").contains(status))throw problem("INVALID_INVOICE_STATUS","Trạng thái phiếu chưa hợp lệ.");
        var where=new StringBuilder(" where teacher_id=?");var args=new ArrayList<Object>();args.add(teacher);
        if(status!=null&&!status.isBlank()){where.append(" and status=?");args.add(status);}if(enrollment!=null){where.append(" and enrollment_id=?");args.add(enrollment);}if(classroom!=null){where.append(" and class_id=?");args.add(classroom);}if(student!=null){where.append(" and student_id=?");args.add(student);}
        where.append(InvoiceCollection.filter("invoices",collection,args,LocalDate.now(ZONE)));
        long total=db.count("select count(*) from invoices"+where,args.toArray());args.add(size);args.add((long)page*size);
        var rows=db.rows("select id,invoice_code,student_id,class_id,enrollment_id,student_name_snapshot as student_name,class_name_snapshot as class_name,pricing_mode,period_start,period_end,due_on,status,total_amount_vnd,issued_at,cancelled_at,created_at,version,(select coalesce(sum(p.amount_vnd),0) from payments p where p.invoice_id=invoices.id and p.status='RECORDED') as paid_amount_vnd from invoices"+where+" order by created_at desc,id desc limit ? offset ?",args.toArray());rows.forEach(r->ledger.decorate(r,number(r,"paidAmountVnd")));return db.page(rows,total,page,size);
    }

    public PageResponse<Map<String,Object>> history(UUID teacher,UUID invoice,int page,int size) {
        owned(teacher,invoice);pagination(page,size);long total=db.count("select count(*) from audit_events where entity_type='INVOICE' and entity_id=?",invoice);
        return db.page(db.rows("select a.id,a.action,a.changed_fields,a.reason,a.created_at,u.display_name as actor_name from audit_events a join users u on u.id=a.actor_id where a.entity_type='INVOICE' and a.entity_id=? order by a.created_at desc,a.id desc limit ? offset ?",invoice,size,(long)page*size),total,page,size);
    }

    public Map<String,Object> familyList(UUID parent,UUID child,int page,int size) {
        var student=guardians.child(parent,child);pagination(page,size);long total=db.count("select count(*) from invoices where student_id=? and issued_at is not null",child);
        var rows=db.rows("select id,invoice_code,student_name_snapshot as student_name,class_name_snapshot as class_name,pricing_mode,period_start,period_end,due_on,status,total_amount_vnd,issued_at,cancelled_at,(select coalesce(sum(p.amount_vnd),0) from payments p where p.invoice_id=invoices.id and p.status='RECORDED') as paid_amount_vnd from invoices where student_id=? and issued_at is not null order by issued_at desc,id desc limit ? offset ?",child,size,(long)page*size);rows.forEach(r->ledger.decorate(r,number(r,"paidAmountVnd")));
        return Map.of("student",Map.of("id",student.id(),"fullName",student.fullName()),"invoices",db.page(rows,total,page,size));
    }
    public Map<String,Object> familyDetail(UUID parent,UUID child,UUID invoice) {
        guardians.child(parent,child);var row=db.one("select id,invoice_code,student_name_snapshot as student_name,class_name_snapshot as class_name,pricing_mode,period_start,period_end,due_on,status,total_amount_vnd,public_note,terms_snapshot,issued_at,cancelled_at from invoices where id=? and student_id=? and issued_at is not null",invoice,child);
        row.put("lines",db.rows("select description,pricing_basis,quantity,unit_price_vnd,discount_vnd,amount_vnd from invoice_lines where invoice_id=? and is_active order by position",invoice));return ledger.decorate(row);
    }

    private Map<String,Object> buildPreview(Map<String,Object> a,LocalDate from,LocalDate to,UUID ownInvoice) {
        validatePeriod(a,from,to);String mode=text(a,"pricingMode");UUID enrollment=id(a,"enrollmentId");
        if(!mode.equals("PER_SESSION")) {
            if(db.count("select count(*) from invoices where enrollment_id=? and pricing_mode<>'PER_SESSION' and status<>'CANCELLED' and period_start<=? and period_end>=? and (?::uuid is null or id<>?)",enrollment,to,from,ownInvoice,ownInvoice)>0)throw conflict("INVOICE_PERIOD_RESERVED","Khoảng này đã có phiếu cố định chưa hủy của bé. Đối chiếu phiếu hiện có.");
            if(mode.equals("FULL_PROGRAM")&&db.count("select count(*) from invoices where agreement_id=? and status<>'CANCELLED' and (?::uuid is null or id<>?)",id(a,"id"),ownInvoice,ownInvoice)>0)throw conflict("PROGRAM_ALREADY_INVOICED","Thỏa thuận trọn khóa đã có phiếu chưa hủy. Không lập lại toàn bộ tổng phí.");
        }
        List<Map<String,Object>> candidates=List.of();var suggested=new ArrayList<Map<String,Object>>();var warnings=new ArrayList<String>();
        if(mode.equals("PER_SESSION")) {
            candidates=db.rows("select r.id as attendance_id,r.session_id,r.status as attendance_status,r.version as attendance_version,r.is_active,s.title as session_title,s.starts_at,s.ends_at,s.status as session_status,ce.invoice_id as reserved_invoice_id,i.invoice_code as reserved_invoice_code from attendance_records r join class_sessions s on s.id=r.session_id left join session_charge_entries ce on ce.root_attendance_id=r.id and ce.status in ('RESERVED','CHARGED') left join invoices i on i.id=ce.invoice_id where r.enrollment_id=? and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date between ? and ? order by s.starts_at,r.id limit 501",enrollment,from,to);
            if(candidates.size()>500)throw problem("BILLING_RANGE_TOO_LARGE","Khoảng có hơn 500 dòng điểm danh. Chọn kỳ ngắn hơn.");
            for(var row:candidates){if(ownInvoice!=null&&ownInvoice.equals(id(row,"reservedInvoiceId"))){row.put("reservedInvoiceId",null);row.put("reservedInvoiceCode",null);}String blocked=null;String attendance=text(row,"attendanceStatus");
                if(!Boolean.TRUE.equals(row.get("isActive")))blocked="Đã loại khỏi danh sách buổi";
                else if("CANCELLED".equals(row.get("sessionStatus")))blocked="Buổi đã hủy";
                else if(!"COMPLETED".equals(row.get("sessionStatus"))||((Instant)row.get("endsAt")).isAfter(Instant.now()))blocked="Buổi chưa hoàn thành";
                else if("UNMARKED".equals(attendance))blocked="Chưa điểm danh";
                else if("ABSENT_EXCUSED".equals(attendance)&&!Boolean.TRUE.equals(a.get("chargeExcusedAbsence")))blocked="Nghỉ có phép không tính theo thỏa thuận";
                else if("ABSENT_UNEXCUSED".equals(attendance)&&!Boolean.TRUE.equals(a.get("chargeUnexcusedAbsence")))blocked="Nghỉ chưa báo không tính theo thỏa thuận";
                else if(row.get("reservedInvoiceId")!=null)blocked="Đã giữ/tính trong phiếu "+row.get("reservedInvoiceCode");
                row.put("billable",blocked==null);row.put("blockedReason",blocked);
                if(blocked==null){LocalDate day=((Instant)row.get("startsAt")).atZone(ZONE).toLocalDate();suggested.add(line("Buổi "+day+" · "+text(row,"sessionTitle"),mode,1,number(a,"sessionUnitPriceVnd"),0,id(row,"attendanceId"),row));}
            }
            if(suggested.isEmpty())warnings.add("Chưa có buổi đủ điều kiện chưa được giữ/tính. Đối chiếu trạng thái hoàn thành và các phiếu khác.");
        } else if(mode.equals("MONTHLY_FIXED")) {
            if(from.getDayOfMonth()==1 && to.equals(from.withDayOfMonth(from.lengthOfMonth())))suggested.add(line("Học phí tháng "+from.getMonthValue()+"/"+from.getYear(),mode,1,number(a,"monthlyAmountVnd"),0,null,null));
            else warnings.add("Kỳ chưa đủ tháng. Hệ thống không tự chia tiền theo ngày; cô nhập khoản thủ công và lý do điều chỉnh.");
        } else suggested.add(line("Học phí trọn khóa · "+text(a,"programLabel"),mode,1,number(a,"programTotalVnd"),0,null,null));
        if("MANUAL_ADJUSTMENT".equals(a.get("fixedFeeAbsenceRule")))warnings.add("Thỏa thuận cho phép cô điều chỉnh khi bé nghỉ. Đối chiếu và nhập giảm trừ/khoản riêng trước khi phát hành.");
        long suggestedTotal=suggested.stream().mapToLong(l->number(l,"amountVnd")).sum();
        if(suggestedTotal>MAX)warnings.add("Các dòng gợi ý vượt giới hạn một phiếu. Chọn bớt dòng hoặc chia thành các phiếu phù hợp trước khi lưu.");
        String key=hash(db.json(Arrays.asList(id(a,"id"),terms(a),from,to,candidates)));
        var result=new LinkedHashMap<String,Object>();result.put("agreementId",id(a,"id"));result.put("enrollmentId",enrollment);result.put("studentId",id(a,"studentId"));result.put("studentName",a.get("studentName"));result.put("className",a.get("className"));result.put("periodStart",from);result.put("periodEnd",to);result.put("termsSnapshot",snapshot(a));result.put("previewKey",key);result.put("candidates",candidates);result.put("suggestedLines",suggested);result.put("suggestedTotalVnd",suggestedTotal>MAX?null:suggestedTotal);result.put("warnings",warnings);return result;
    }

    private void validatePeriod(Map<String,Object> a,LocalDate from,LocalDate to) {
        if(from==null||to==null||from.getYear()<1900||to.getYear()>2200||to.isBefore(from)||ChronoUnit.DAYS.between(from,to)>365)throw problem("INVALID_BILLING_PERIOD","Kỳ cần 1–366 ngày, năm 1900–2200 và ngày cuối không trước ngày đầu.");
        if("CANCELLED".equals(a.get("status")))throw conflict("AGREEMENT_CANCELLED","Thỏa thuận đã hủy, không tạo hoặc phát hành phiếu từ bản này.");
        LocalDate start=(LocalDate)a.get("effectiveFrom"),end=(LocalDate)a.get("effectiveTo"),classStart=(LocalDate)a.get("classStartDate"),classEnd=(LocalDate)a.get("classEndDate");
        LocalDate joined=((Instant)a.get("joinedAt")).atZone(ZONE).toLocalDate(),ended=a.get("endedAt")==null?null:((Instant)a.get("endedAt")).atZone(ZONE).toLocalDate();
        if(from.isBefore(start)||end!=null&&to.isAfter(end)||from.isBefore(joined)||classStart!=null&&from.isBefore(classStart)||classEnd!=null&&to.isAfter(classEnd)||ended!=null&&to.isAfter(ended))throw problem("OUTSIDE_BILLING_DATES","Kỳ cần nằm trong thỏa thuận, ngày lớp và thời gian bé tham gia. Kỳ lẻ cần cô đối chiếu thủ công.");
        if("MONTHLY_FIXED".equals(a.get("pricingMode"))&&!YearMonth.from(from).equals(YearMonth.from(to)))throw problem("ONE_MONTH_PER_INVOICE","Mỗi phiếu cố định theo tháng chỉ thuộc một tháng lịch. Tạo phiếu riêng cho tháng khác.");
    }
    private void validateSave(SaveInput input,Map<String,Object> preview) {
        if(!input.previewKey().equals(preview.get("previewKey")))throw conflict("BILLING_SOURCE_CHANGED","Nguồn tính phí đã thay đổi. Xem trước lại trước khi lưu phiếu.");
        if(input.dueOn()!=null&&(input.dueOn().getYear()<1900||input.dueOn().getYear()>2200))throw problem("INVALID_DUE_DATE","Hạn thanh toán trong năm 1900–2200, có thể trước kỳ học khi thu trước.");
    }
    private List<Map<String,Object>> validateLines(SaveInput input,Map<String,Object> preview) {
        var result=new ArrayList<Map<String,Object>>();var selected=new HashSet<UUID>();boolean adjustment=false;int fixed=0;
        Map<String,Object> terms=map(preview,"termsSnapshot");String mode=text(terms,"pricingMode");var available=new HashMap<UUID,Map<String,Object>>();
        for(var c:list(preview,"candidates"))if(Boolean.TRUE.equals(c.get("billable")))available.put(id(c,"attendanceId"),c);
        for(LineInput l:input.lines()){
            long quantity=integer(l.quantity(),1,10000),price=integer(l.unitPriceVnd(),0,MAX),discount=integer(l.discountVnd(),0,MAX);long gross=Math.multiplyExact(quantity,price);
            if(discount>gross||gross-discount>MAX)throw problem("INVALID_LINE_AMOUNT","Giảm trừ không vượt tiền dòng; tiền dòng sau giảm không vượt 1.000.000.000.000 VND.");
            String basis=l.pricingBasis();Map<String,Object> source=null;
            if("PER_SESSION".equals(basis)){
                source=available.get(l.attendanceId());if(!mode.equals(basis)||source==null||!selected.add(l.attendanceId())||quantity!=1||price!=number(terms,"sessionUnitPriceVnd"))throw conflict("INVALID_SESSION_CHARGE","Buổi không đủ điều kiện, đã trùng hoặc đơn giá không đúng thỏa thuận. Xem trước lại.");
            }else{
                if(l.attendanceId()!=null)throw problem("UNEXPECTED_ATTENDANCE","Chỉ dòng theo buổi được gắn điểm danh.");
                if(!"OTHER".equals(basis)){
                    if(!mode.equals(basis)||quantity!=1||++fixed>1||"MONTHLY_FIXED".equals(basis)&&list(preview,"suggestedLines").isEmpty())throw problem("INVALID_FIXED_LINE","Dòng tháng/trọn khóa cần đúng nguồn, một lần và đủ kỳ; kỳ lẻ dùng khoản thủ công.");
                    long expected=number(terms,mode.equals("MONTHLY_FIXED")?"monthlyAmountVnd":"programTotalVnd");if(price!=expected)throw problem("INVALID_FIXED_PRICE","Giữ đơn giá theo thỏa thuận; dùng giảm trừ hoặc khoản thủ công có lý do để điều chỉnh.");
                }else adjustment=true;
            }
            if(discount>0)adjustment=true;result.add(line(l.description().strip(),basis,quantity,price,discount,l.attendanceId(),source));
        }
        if(adjustment&&clean(input.adjustmentReason())==null)throw problem("ADJUSTMENT_REASON_REQUIRED","Nhập lý do riêng khi có giảm trừ hoặc khoản thủ công.");return result;
    }
    private Map<String,Object> line(String description,String basis,long quantity,long price,long discount,UUID attendance,Map<String,Object> source) {
        var r=new LinkedHashMap<String,Object>();r.put("description",description);r.put("pricingBasis",basis);r.put("quantity",quantity);r.put("unitPriceVnd",price);r.put("discountVnd",discount);r.put("amountVnd",quantity*price-discount);r.put("attendanceId",attendance);r.put("sourceSnapshot",source);return r;
    }
    private void insertLines(UUID invoice,UUID agreement,List<Map<String,Object>> lines) {
        for(int position=0;position<lines.size();position++) {var l=lines.get(position);UUID id=UUID.randomUUID();
            db.update("insert into invoice_lines(id,invoice_id,position,description,pricing_basis,quantity,unit_price_vnd,discount_vnd,amount_vnd,attendance_id,source_snapshot) values(?,?,?,?,?,?,?,?,?,?,?::jsonb)",id,invoice,position,l.get("description"),l.get("pricingBasis"),number(l,"quantity"),l.get("unitPriceVnd"),l.get("discountVnd"),l.get("amountVnd"),l.get("attendanceId"),l.get("sourceSnapshot")==null?null:db.json(l.get("sourceSnapshot")));
            if(l.get("attendanceId")!=null)db.update("insert into session_charge_entries(id,invoice_id,invoice_line_id,agreement_id,root_attendance_id,counted_attendance_id,unit_price_vnd_snapshot,status) values(?,?,?,?,?,?,?,'RESERVED')",UUID.randomUUID(),invoice,id,agreement,l.get("attendanceId"),l.get("attendanceId"),l.get("unitPriceVnd"));
        }
    }
    private void voidCharges(UUID invoice,String reason){db.update("update session_charge_entries set status='VOIDED',void_reason=?,voided_at=clock_timestamp() where invoice_id=? and status in ('RESERVED','CHARGED')",reason,invoice);}
    private Map<String,Object> rawDetail(UUID teacher,UUID invoice){var r=owned(teacher,invoice);r.remove("clientRequestId");r.remove("requestHash");r.put("studentName",r.remove("studentNameSnapshot"));r.put("className",r.remove("classNameSnapshot"));r.put("lines",db.rows("select id,position,description,pricing_basis,quantity,unit_price_vnd,discount_vnd,amount_vnd,attendance_id,source_snapshot from invoice_lines where invoice_id=? and is_active order by position",invoice));return ledger.decorate(r);}
    private Map<String,Object> owned(UUID teacher,UUID invoice){return db.one("select * from invoices where id=? and teacher_id=?",invoice,teacher);}
    private Map<String,Object> agreement(UUID teacher,UUID agreement){return db.one(AGREEMENT+"where a.id=? and c.teacher_id=?",agreement,teacher);}
    private Map<String,Object> lockAgreement(UUID teacher,UUID agreement){var a=agreement(teacher,agreement);db.one("select id from classes where id=? and teacher_id=? for update",id(a,"classId"),teacher);db.one("select id from students where id=? and teacher_id=? for update",id(a,"studentId"),teacher);db.one("select id from class_enrollments where id=? for update",id(a,"enrollmentId"));return agreement(teacher,agreement);}
    private void lockInvoice(UUID teacher,UUID invoice){db.one("select id from invoices where id=? and teacher_id=? for update",invoice,teacher);}
    private Map<String,Object> terms(Map<String,Object> a){var r=new LinkedHashMap<String,Object>();for(String k:TERMS)r.put(k,a.get(k));return r;}
    private Map<String,Object> snapshot(Map<String,Object> a){var r=terms(a);r.put("effectiveFrom",a.get("effectiveFrom"));r.put("effectiveTo",a.get("effectiveTo"));return r;}
    private long total(List<Map<String,Object>> lines){long sum=0;for(var l:lines){sum=Math.addExact(sum,number(l,"amountVnd"));if(sum>MAX)throw problem("INVOICE_TOTAL_TOO_LARGE","Tổng phiếu không vượt 1.000.000.000.000 VND.");}return sum;}
    private long integer(BigDecimal value,long min,long max){try{long n=value.longValueExact();if(n<min||n>max)throw new ArithmeticException();return n;}catch(ArithmeticException|NullPointerException invalid){throw problem("INVALID_INVOICE_NUMBER","Số tiền/số lượng cần là số nguyên trong giới hạn cho phép.");}}
    private void requireDraft(Map<String,Object> row){if(!"DRAFT".equals(row.get("status")))throw conflict("INVOICE_READ_ONLY","Chỉ sửa hoặc phát hành phiếu nháp. Phiếu đã công bố giữ nguyên nội dung.");}
    private void reason(String value){if(clean(value)==null)throw problem("REASON_REQUIRED","Nhập lý do thay đổi để đối chiếu lịch sử.");}
    private String fingerprint(SaveInput i){return hash(db.json(Arrays.asList(i.agreementId(),i.periodStart(),i.periodEnd(),i.dueOn(),i.previewKey(),i.lines(),clean(i.publicNote()),clean(i.internalNote()),clean(i.adjustmentReason()),clean(i.reason()))));}
    private void audit(UUID actor,String action,UUID id,Map<String,Object> before,Map<String,Object> after,String reason,String trace){db.audit(actor,"INVOICE_"+action,"INVOICE",id,Map.of("before",before,"after",after),reason,trace);}
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> list(Map<String,Object> row,String key){return (List<Map<String,Object>>)row.get(key);}
    @SuppressWarnings("unchecked") private static List<String> strings(Map<String,Object> row,String key){return (List<String>)row.get(key);}
    @SuppressWarnings("unchecked") private static Map<String,Object> map(Map<String,Object> row,String key){return (Map<String,Object>)row.get(key);}
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException failure){throw new IllegalStateException(failure);}}
}
