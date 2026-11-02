package com.tinyclass.storage;

import com.tinyclass.auth.*;
import com.tinyclass.common.api.*;
import com.tinyclass.common.audit.*;
import com.tinyclass.storage.FileDtos.*;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.text.Normalizer;
import java.util.*;

@Service
public class FileService {
    private record Kind(long limit, Set<String> extensions) {}
    private static final long MB=1024L*1024;
    private static final Map<String,Kind> TYPES=Map.ofEntries(
            Map.entry("image/png",new Kind(10*MB,Set.of("png"))), Map.entry("image/jpeg",new Kind(10*MB,Set.of("jpg","jpeg"))),
            Map.entry("image/gif",new Kind(10*MB,Set.of("gif"))), Map.entry("image/webp",new Kind(10*MB,Set.of("webp"))),
            Map.entry("application/pdf",new Kind(50*MB,Set.of("pdf"))), Map.entry("video/mp4",new Kind(200*MB,Set.of("mp4"))),
            Map.entry("video/webm",new Kind(200*MB,Set.of("webm"))), Map.entry("audio/mpeg",new Kind(20*MB,Set.of("mp3"))),
            Map.entry("audio/ogg",new Kind(20*MB,Set.of("ogg"))), Map.entry("audio/vnd.wave",new Kind(20*MB,Set.of("wav"))));
    private final StoredFileRepository files;
    private final StorageConnectionRepository connections;
    private final UserAccountRepository users;
    private final AuditEventRepository audit;
    private final StorageAdapter local;
    private final TransactionTemplate tx;
    private final long quota;
    private final Tika tika=new Tika();
    public FileService(StoredFileRepository files, StorageConnectionRepository connections, UserAccountRepository users,
            AuditEventRepository audit, LocalStorageAdapter local, PlatformTransactionManager transactions,
            @Value("${tinyclass.storage.quota-bytes}") long quota) {
        this.files=files; this.connections=connections; this.users=users; this.audit=audit; this.local=local;
        this.tx=new TransactionTemplate(transactions); this.quota=quota;
        if(quota<=0) throw new IllegalStateException("Storage quota must be positive");
    }
    public List<ConnectionView> connections(UUID actor) {
        return tx.execute(status->{ ensureLocal(actor); return connections.findByTeacherId(actor).stream()
                .map(c->new ConnectionView(c.getId(),c.getProvider(),c.getDisplayName(),c.getStatus(),c.isDefaultStorage(),files.used(actor),quota)).toList(); });
    }
    private StorageConnection ensureLocal(UUID actor) {
        users.lockById(actor).orElseThrow(FileService::missing);
        return connections.findByTeacherIdAndProvider(actor,"LOCAL").orElseGet(()->connections.saveAndFlush(new StorageConnection(actor)));
    }
    public PageResponse<FileView> list(UUID actor,String q,String purpose,int page,int size) {
        if(page<0||size<1||size>100) throw problem(HttpStatus.BAD_REQUEST,"INVALID_PAGINATION","Phân trang chưa hợp lệ.");
        if(q!=null&&q.length()>150) throw problem(HttpStatus.BAD_REQUEST,"INVALID_SEARCH","Từ khóa tối đa 150 ký tự.");
        if(purpose!=null&&!Set.of("LESSON_ASSET","PROFILE_ASSET","NOTE_ASSET","REVIEW_ASSET").contains(purpose))
            throw problem(HttpStatus.BAD_REQUEST,"INVALID_PURPOSE","Mục đích tệp chưa hợp lệ.");
        Specification<StoredFile> filter=(root,query,cb)->{
            var where=cb.and(cb.equal(root.get("uploadedBy"),actor),cb.notEqual(root.get("status"),"DELETED"));
            if(q!=null&&!q.isBlank()) where=cb.and(where,cb.like(cb.lower(root.get("originalName")),"%"+q.strip().toLowerCase(Locale.ROOT)
                    .replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%",'\\'));
            if(purpose!=null) where=cb.and(where,cb.equal(root.get("purpose"),purpose));
            return where;
        };
        return PageResponse.from(files.findAll(filter,PageRequest.of(page,size,Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id")))).map(this::view));
    }
    public FileView detail(UUID actor,UUID id) { return view(owned(actor,id)); }
    public FileView upload(UUID actor,MultipartFile part,UUID connectionId,String purpose,boolean allowed,String trace) {
        if(!Set.of("LESSON_ASSET","PROFILE_ASSET","NOTE_ASSET","REVIEW_ASSET").contains(purpose))
            throw problem(HttpStatus.BAD_REQUEST,"INVALID_PURPOSE","Chưa hỗ trợ mục đích upload này.");
        if(part.isEmpty()) throw problem(HttpStatus.BAD_REQUEST,"EMPTY_FILE","Chọn tệp có nội dung.");
        String name=Normalizer.normalize(Objects.toString(part.getOriginalFilename(),""),Normalizer.Form.NFC).strip();
        if(name.isBlank()||name.length()>255||name.chars().anyMatch(c->Character.isISOControl(c))||name.contains("/")||name.contains("\\"))
            throw problem(HttpStatus.BAD_REQUEST,"INVALID_FILE_NAME","Tên tệp chưa hợp lệ; không chứa đường dẫn hoặc ký tự điều khiển.");
        String extension=name.contains(".")?name.substring(name.lastIndexOf('.')+1).toLowerCase(Locale.ROOT):"";
        String mime;
        try(var input=new BufferedInputStream(part.getInputStream())) {
            mime=normalizeMime(tika.detect(input));
            // Core detectors can identify only the Matroska container. Verify its EBML DocType before treating it as WebM.
            if("webm".equals(extension)) {
                try(var header=part.getInputStream()) { if(webmHeader(header.readNBytes(4096))) mime="video/webm"; }
            }
        }
        catch(IOException failure) { throw unavailable(); }
        Kind kind=TYPES.get(mime);
        String claimed=normalizeMime(Objects.toString(part.getContentType(),"application/octet-stream").split(";")[0]);
        if(kind==null||!kind.extensions().contains(extension)||(!"application/octet-stream".equals(claimed)&&!mime.equals(claimed)))
            throw problem(HttpStatus.BAD_REQUEST,"UNSUPPORTED_FILE_TYPE","Định dạng/nội dung tệp không khớp. Dùng ảnh, PDF, MP3/WAV/OGG, MP4 hoặc WebM.");
        if(part.getSize()>kind.limit()) throw problem(HttpStatus.PAYLOAD_TOO_LARGE,"FILE_TOO_LARGE","Tệp vượt quá giới hạn cho định dạng này.");
        if("PROFILE_ASSET".equals(purpose)&&!mime.startsWith("image/")) throw problem(HttpStatus.BAD_REQUEST,"INVALID_PROFILE_FILE","Ảnh hồ sơ phải là tệp ảnh.");
        final String detected=mime;
        StoredFile reserved=tx.execute(status->{
            var defaultConnection=ensureLocal(actor); // User lock serializes quota reservations.
            var connection=connectionId==null?defaultConnection:connections.findByIdAndTeacherId(connectionId,actor).orElseThrow(FileService::missing);
            if(!"CONNECTED".equals(connection.getStatus())||!"LOCAL".equals(connection.getProvider())) throw unavailable();
            if(files.used(actor)+part.getSize()>quota) throw problem(HttpStatus.CONFLICT,"STORAGE_QUOTA_EXCEEDED","Kho đã hết dung lượng cho phép.");
            return files.saveAndFlush(new StoredFile(actor,connection.getId(),purpose,allowed,
                    actor+"/"+UUID.randomUUID()+"."+extension,name,detected,part.getSize()));
        });
        try(var input=part.getInputStream()) {
            var written=local.write(reserved.getStorageKey(),input,kind.limit());
            if(written.size()!=part.getSize()) throw new IOException("Upload size changed");
            return tx.execute(status->{
                var saved=files.lockOwned(reserved.getId(),actor).orElseThrow(FileService::missing);
                saved.ready(written); files.flush();
                audit.save(new AuditEvent(actor,"FILE_UPLOADED","FILE",saved.getId(),Map.of("purpose",purpose,"sizeBytes",written.size()),null,trace));
                return view(saved);
            });
        } catch(Exception failure) {
            try { local.delete(reserved.getStorageKey()); } catch(IOException ignored) { /* Keep metadata for a later cleanup. */ }
            tx.executeWithoutResult(status->files.findById(reserved.getId()).ifPresent(StoredFile::failed));
            if(failure instanceof ApiException api) throw api;
            throw unavailable();
        }
    }
    public FileView policy(UUID actor,UUID id,PolicyInput input,String trace) {
        return tx.execute(status->{
            var file=files.lockOwned(id,actor).orElseThrow(FileService::missing);
            if(!"READY".equals(file.getStatus())) throw missing();
            if(!Objects.equals(file.getVersion(),input.version())) throw problem(HttpStatus.CONFLICT,"VERSION_CONFLICT","Tệp đã thay đổi; tải lại trước khi lưu.");
            if(!"LESSON_ASSET".equals(file.getPurpose())) throw problem(HttpStatus.CONFLICT,"INVALID_PURPOSE","Chỉ học liệu dùng cờ cho phép tải.");
            file.policy(input.learnerDownloadAllowed()); files.flush();
            audit.save(new AuditEvent(actor,"FILE_POLICY_CHANGED","FILE",id,Map.of("learnerDownloadAllowed",input.learnerDownloadAllowed()),null,trace));
            return view(file);
        });
    }
    public record Content(Resource resource,String mime,String name,long size) {}
    public Content content(UUID actor,UUID id) { return content(owned(actor,id)); }
    public Content content(StoredFile file) {
        if(!"READY".equals(file.getStatus())) throw missing();
        var connection=connections.findById(file.getStorageConnectionId()).orElseThrow(FileService::missing);
        if(!"CONNECTED".equals(connection.getStatus())||!"LOCAL".equals(connection.getProvider())) throw unavailable();
        try { return new Content(local.read(file.getStorageKey(),file.getSizeBytes()),file.getMimeType(),file.getOriginalName(),file.getSizeBytes()); }
        catch(IOException failure) { throw unavailable(); }
    }
    public StoredFile owned(UUID actor,UUID id) { return files.findByIdAndUploadedBy(id,actor).filter(f->!"DELETED".equals(f.getStatus())).orElseThrow(FileService::missing); }
    private FileView view(StoredFile file) { return FileView.from(file,connections.findById(file.getStorageConnectionId()).orElseThrow(FileService::missing).getProvider()); }
    private String normalizeMime(String mime) { return switch(mime.toLowerCase(Locale.ROOT)) { case "audio/wav","audio/x-wav","audio/wave"->"audio/vnd.wave"; case "application/ogg"->"audio/ogg"; default->mime.toLowerCase(Locale.ROOT); }; }
    private boolean webmHeader(byte[] bytes) {
        if(bytes.length<8||(bytes[0]&255)!=0x1a||(bytes[1]&255)!=0x45||(bytes[2]&255)!=0xdf||(bytes[3]&255)!=0xa3) return false;
        int[] offset={4}; long length=ebmlNumber(bytes,offset,true);
        if(length<0||length>bytes.length-offset[0]) return false;
        int end=offset[0]+(int)length;
        while(offset[0]<end) {
            long identifier=ebmlNumber(bytes,offset,false),size=ebmlNumber(bytes,offset,true);
            if(identifier<0||size<0||size>end-offset[0]) return false;
            if(identifier==0x4282) return size==4&&bytes[offset[0]]=='w'&&bytes[offset[0]+1]=='e'&&bytes[offset[0]+2]=='b'&&bytes[offset[0]+3]=='m';
            offset[0]+=(int)size;
        }
        return false;
    }
    private long ebmlNumber(byte[] bytes,int[] offset,boolean size) {
        if(offset[0]>=bytes.length) return -1;
        int first=bytes[offset[0]]&255,mask=0x80,length=1;
        while(length<=8&&(first&mask)==0) { length++; mask>>=1; }
        if(length>8||(!size&&length>4)||offset[0]+length>bytes.length) return -1;
        long value=size?first&(mask-1):first;
        for(int i=1;i<length;i++) value=(value<<8)|(bytes[offset[0]+i]&255);
        offset[0]+=length;
        return value;
    }
    private static ApiException problem(HttpStatus status,String code,String message) { return new ApiException(status,code,message); }
    private static ApiException unavailable() { return problem(HttpStatus.SERVICE_UNAVAILABLE,"STORAGE_UNAVAILABLE","Tệp/kho tạm không khả dụng. Giữ nội dung nháp và thử lại sau."); }
    private static ApiException missing() { return problem(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Không tìm thấy tệp."); }
}
