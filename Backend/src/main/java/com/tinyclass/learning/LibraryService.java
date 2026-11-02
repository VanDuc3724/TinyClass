package com.tinyclass.learning;

import com.tinyclass.common.api.*;
import com.tinyclass.common.persistence.DomainStore;
import com.tinyclass.learning.LibraryDtos.*;
import com.tinyclass.storage.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

@Service @Transactional(readOnly=true)
public class LibraryService {
    private final DomainStore db;
    private final FileService files;
    public LibraryService(DomainStore db,FileService files) { this.db=db; this.files=files; }
    public List<Map<String,Object>> topics(UUID actor) { return db.rows("select id,name,description,version,archived_at from topics where teacher_id=? order by normalized_name,id",actor); }
    @Transactional public Map<String,Object> topic(UUID actor,UUID id,TopicInput input,String trace) {
        if(id==null) { id=UUID.randomUUID(); db.update("insert into topics(id,teacher_id,name,normalized_name,description) values(?,?,?,?,?)",id,actor,input.name().strip(),input.name().strip().toLowerCase(Locale.ROOT),clean(input.description())); }
        else {
            var old=db.one("select id,version from topics where id=? and teacher_id=? for update",id,actor); version(old,input.version());
            db.update("update topics set name=?,normalized_name=?,description=?,archived_at=case when ? then now() else null end,version=version+1,updated_at=now() where id=?",
                    input.name().strip(),input.name().strip().toLowerCase(Locale.ROOT),clean(input.description()),input.archived(),id);
        }
        db.audit(actor,"TOPIC_SAVED","TOPIC",id,Map.of(),null,trace);
        return db.one("select id,name,description,version,archived_at from topics where id=?",id);
    }
    public PageResponse<Map<String,Object>> list(UUID actor,String type,String q,String status,UUID topic,int page,int size) {
        pagination(page,size); table(type);
        if(status!=null&&!Set.of("DRAFT","PUBLISHED","ARCHIVED").contains(status)) throw problem("INVALID_STATUS","Trạng thái chưa hợp lệ.");
        String where=" where teacher_id=? and lower(title) like ? escape '\\'"; var args=new ArrayList<Object>(List.of(actor,search(q)));
        if(status!=null) { where+=" and status=?"; args.add(status); }
        if(topic!=null&&"lessons".equals(type)) { where+=" and exists(select 1 from lesson_topics lt where lt.lesson_id=lessons.id and lt.topic_id=?)"; args.add(topic); }
        long total=db.count("select count(*) from "+type+where,args.toArray());
        args.add(size); args.add((long)page*size);
        return db.page(db.rows("select id,title,"+("lessons".equals(type)?"summary,default_completion_mode,estimated_minutes":"description")+",status,version,created_at from "+type+where+" order by created_at desc,id desc limit ? offset ?",args.toArray()),total,page,size);
    }
    public Map<String,Object> lesson(UUID actor,UUID id) {
        var lesson=db.one("select id,title,summary,parent_guidance,activity_instructions,estimated_minutes,default_completion_mode,default_response_types,status,version,created_at,published_at from lessons where id=? and teacher_id=?",id,actor);
        lesson.put("topicIds",db.rows("select topic_id from lesson_topics where lesson_id=? order by topic_id",id).stream().map(r->r.get("topicId")).toList());
        lesson.put("blocks",blocks(id)); return lesson;
    }
    public List<Map<String,Object>> blocks(UUID lesson) {
        return db.rows("select b.id,b.position,b.type,b.text_content,b.file_id,b.caption,b.alt_text,f.mime_type,f.original_name,f.learner_download_allowed from lesson_blocks b left join files f on f.id=b.file_id where b.lesson_id=? order by b.position",lesson);
    }
    @Transactional public Map<String,Object> saveLesson(UUID actor,UUID id,LessonInput input,String trace) {
        boolean published=false;
        if(id!=null) {
            var old=lock(actor,"lessons",id); version(old,input.version()); published="PUBLISHED".equals(old.get("status"));
            if("ARCHIVED".equals(old.get("status"))) throw conflict("INVALID_STATE","Khôi phục bài trước khi sửa.");
            if(published&&!input.acknowledgeSharedUpdate()) throw conflict("SHARED_UPDATE_CONFIRMATION_REQUIRED","Bài đã xuất bản; xác nhận cập nhật ở mọi nơi đang dùng.");
        }
        validateLesson(actor,input,published);
        if(id==null) { id=UUID.randomUUID(); db.update("insert into lessons(id,teacher_id,title,summary,parent_guidance,activity_instructions,estimated_minutes,default_completion_mode,default_response_types,status) values(?,?,?,?,?,?,?,?,?::jsonb,'DRAFT')",
                id,actor,input.title().strip(),clean(input.summary()),clean(input.parentGuidance()),clean(input.activityInstructions()),input.estimatedMinutes(),input.defaultCompletionMode(),db.json(input.defaultResponseTypes())); }
        else db.update("update lessons set title=?,summary=?,parent_guidance=?,activity_instructions=?,estimated_minutes=?,default_completion_mode=?,default_response_types=?::jsonb,version=version+1,updated_at=now() where id=?",
                input.title().strip(),clean(input.summary()),clean(input.parentGuidance()),clean(input.activityInstructions()),input.estimatedMinutes(),input.defaultCompletionMode(),db.json(input.defaultResponseTypes()),id);
        db.update("delete from lesson_blocks where lesson_id=?",id); db.update("delete from lesson_topics where lesson_id=?",id);
        for(UUID topic:input.topicIds()) db.update("insert into lesson_topics(lesson_id,topic_id) values(?,?)",id,topic);
        int position=0;
        for(var block:input.blocks()) db.update("insert into lesson_blocks(id,lesson_id,position,type,text_content,file_id,caption,alt_text) values(?,?,?,?,?,?,?,?)",
                UUID.randomUUID(),id,position++,block.type(),clean(block.textContent()),block.fileId(),clean(block.caption()),clean(block.altText()));
        db.audit(actor,"LESSON_SAVED","LESSON",id,Map.of("sharedUpdate",published),null,trace); return lesson(actor,id);
    }
    private void validateLesson(UUID actor,LessonInput input,boolean publishing) {
        if(new HashSet<>(input.topicIds()).size()!=input.topicIds().size()) throw problem("DUPLICATE_TOPIC","Không chọn trùng chủ đề.");
        if(new HashSet<>(input.defaultResponseTypes()).size()!=input.defaultResponseTypes().size()) throw problem("DUPLICATE_RESPONSE_TYPE","Loại sản phẩm bị trùng.");
        if("TEACHER_REVIEW".equals(input.defaultCompletionMode())&&input.defaultResponseTypes().isEmpty()) throw problem("RESPONSE_TYPES_REQUIRED","Chọn ít nhất một loại sản phẩm.");
        for(UUID topic:input.topicIds()) db.one("select id from topics where id=? and teacher_id=?",topic,actor);
        if(publishing&&input.blocks().isEmpty()&&clean(input.activityInstructions())==null) throw conflict("LESSON_CONTENT_REQUIRED","Thêm nội dung hoặc hướng dẫn hoạt động trước khi xuất bản.");
        for(var block:input.blocks()) {
            if("TEXT".equals(block.type())) {
                if(block.fileId()!=null) throw problem("INVALID_BLOCK","Khối chữ không chứa tệp.");
                if(publishing&&clean(block.textContent())==null) throw conflict("EMPTY_BLOCK","Khối chữ chưa có nội dung.");
            } else {
                if(clean(block.textContent())!=null) throw problem("INVALID_BLOCK","Khối tệp không chứa nội dung chữ.");
                if(block.fileId()==null) { if(publishing) throw conflict("FILE_REQUIRED","Chọn tệp cho từng khối trước khi xuất bản."); continue; }
                var file=files.owned(actor,block.fileId());
                if(!"LESSON_ASSET".equals(file.getPurpose())) throw problem("INVALID_FILE_PURPOSE","Chỉ dùng tệp học liệu trong bài.");
                boolean matches=switch(block.type()) { case "IMAGE"->file.getMimeType().startsWith("image/"); case "VIDEO"->file.getMimeType().startsWith("video/"); case "AUDIO"->file.getMimeType().startsWith("audio/"); case "PDF"->"application/pdf".equals(file.getMimeType()); default->false; };
                if(!matches) throw problem("FILE_TYPE_MISMATCH","Loại tệp chưa khớp với khối nội dung.");
                if(publishing&&!"READY".equals(file.getStatus())) throw conflict("FILE_NOT_READY","Có tệp chưa sẵn sàng để xuất bản.");
            }
        }
    }
    public Map<String,Object> course(UUID actor,UUID id) {
        var course=db.one("select id,title,description,min_age_months,max_age_months,status,version,created_at,published_at from courses where id=? and teacher_id=?",id,actor);
        course.put("lessons",db.rows("select cl.lesson_id,cl.position,cl.is_required,l.title,l.status,l.default_completion_mode from course_lessons cl join lessons l on l.id=cl.lesson_id where cl.course_id=? order by cl.position",id));
        return course;
    }
    @Transactional public Map<String,Object> saveCourse(UUID actor,UUID id,CourseInput input,String trace) {
        boolean published=false;
        if(id!=null) { var old=lock(actor,"courses",id); version(old,input.version()); published="PUBLISHED".equals(old.get("status"));
            if("ARCHIVED".equals(old.get("status"))) throw conflict("INVALID_STATE","Khôi phục khóa trước khi sửa.");
            if(published&&!input.acknowledgeSharedUpdate()) throw conflict("SHARED_UPDATE_CONFIRMATION_REQUIRED","Xác nhận cập nhật khóa đã xuất bản."); }
        validateCourse(actor,input,published);
        if(id==null) { id=UUID.randomUUID(); db.update("insert into courses(id,teacher_id,title,description,min_age_months,max_age_months,status) values(?,?,?,?,?,?,'DRAFT')",id,actor,input.title().strip(),clean(input.description()),input.minAgeMonths(),input.maxAgeMonths()); }
        else db.update("update courses set title=?,description=?,min_age_months=?,max_age_months=?,version=version+1,updated_at=now() where id=?",input.title().strip(),clean(input.description()),input.minAgeMonths(),input.maxAgeMonths(),id);
        db.update("delete from course_lessons where course_id=?",id); int position=0;
        for(var lesson:input.lessons()) db.update("insert into course_lessons(course_id,lesson_id,position,is_required) values(?,?,?,?)",id,lesson.lessonId(),position++,lesson.isRequired());
        db.audit(actor,"COURSE_SAVED","COURSE",id,Map.of("sharedUpdate",published),null,trace); return course(actor,id);
    }
    private void validateCourse(UUID actor,CourseInput input,boolean publishing) {
        if(input.minAgeMonths()!=null&&input.maxAgeMonths()!=null&&input.maxAgeMonths()<input.minAgeMonths()) throw problem("INVALID_AGE_RANGE","Độ tuổi tối đa phải lớn hơn tối thiểu.");
        var seen=new HashSet<UUID>();
        if(publishing&&input.lessons().isEmpty()) throw conflict("COURSE_LESSONS_REQUIRED","Thêm ít nhất một bài trước khi xuất bản.");
        for(var lesson:input.lessons()) {
            if(!seen.add(lesson.lessonId())) throw problem("DUPLICATE_LESSON","Mỗi bài chỉ xuất hiện một lần trong khóa.");
            var row=db.one("select id,status,default_completion_mode from lessons where id=? and teacher_id=?",lesson.lessonId(),actor);
            if("ARCHIVED".equals(row.get("status"))||publishing&&!"PUBLISHED".equals(row.get("status"))) throw conflict("LESSON_NOT_PUBLISHED","Chỉ xuất bản khóa có bài đã xuất bản và chưa lưu trữ.");
            if(lesson.isRequired()&&"REFERENCE".equals(row.get("defaultCompletionMode"))) throw problem("REFERENCE_IS_OPTIONAL","Bài tham khảo phải để tùy chọn.");
        }
    }
    @Transactional public Map<String,Object> action(UUID actor,String type,UUID id,String action,ActionInput input,String trace) {
        var row=lock(actor,type,id); version(row,input.version());
        String old=text(row,"status");
        if("publish".equals(action)) {
            if(!"DRAFT".equals(old)) throw conflict("INVALID_STATE","Chỉ xuất bản nội dung đang ở bản nháp.");
            if("lessons".equals(type)) {
                var source=lesson(actor,id);
                @SuppressWarnings("unchecked") var response=(List<String>)source.get("defaultResponseTypes");
                @SuppressWarnings("unchecked") var topics=(List<UUID>)source.get("topicIds");
                var blocks=blocks(id).stream().map(b->new BlockInput(text(b,"type"),(String)b.get("textContent"),id(b,"fileId"),(String)b.get("caption"),(String)b.get("altText"))).toList();
                validateLesson(actor,new LessonInput(text(source,"title"),(String)source.get("summary"),(String)source.get("parentGuidance"),(String)source.get("activityInstructions"),
                        source.get("estimatedMinutes")==null?null:((Number)source.get("estimatedMinutes")).intValue(),text(source,"defaultCompletionMode"),response,topics,blocks,input.version(),true),true);
            } else {
                var source=course(actor,id);
                var lessons=db.rows("select lesson_id,is_required from course_lessons where course_id=? order by position",id).stream().map(l->new CourseLessonInput(id(l,"lessonId"),(Boolean)l.get("isRequired"))).toList();
                validateCourse(actor,new CourseInput(text(source,"title"),(String)source.get("description"),null,null,lessons,input.version(),true),true);
            }
            db.update("update "+type+" set status='PUBLISHED',published_at=now(),version=version+1,updated_at=now() where id=?",id);
        } else if("archive".equals(action)) {
            if("ARCHIVED".equals(old)) throw conflict("INVALID_STATE","Nội dung đã lưu trữ.");
            db.update("update "+type+" set status='ARCHIVED',archived_at=now(),version=version+1,updated_at=now() where id=?",id);
        } else if("restore".equals(action)) {
            if(!"ARCHIVED".equals(old)) throw conflict("INVALID_STATE","Nội dung chưa lưu trữ.");
            db.update("update "+type+" set status=case when published_at is null then 'DRAFT' else 'PUBLISHED' end,archived_at=null,version=version+1,updated_at=now() where id=?",id);
        } else throw missing();
        db.audit(actor,type.toUpperCase(Locale.ROOT)+"_"+action.toUpperCase(Locale.ROOT),"CONTENT",id,Map.of("from",old),input.reason(),trace);
        return "lessons".equals(type)?lesson(actor,id):course(actor,id);
    }
    private Map<String,Object> lock(UUID actor,String table,UUID id) { table(table); return db.one("select id,status,version from "+table+" where id=? and teacher_id=? for update",id,actor); }
    private void table(String table) { if(!Set.of("lessons","courses").contains(table)) throw missing(); }
}
