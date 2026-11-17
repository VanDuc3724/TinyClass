package com.tinyclass.games;

import com.tinyclass.storage.FileService;
import org.springframework.stereotype.Component;
import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;
import static com.tinyclass.games.GameDtos.*;

@Component
public class GameRules {
    private final FileService files;
    public GameRules(FileService files){this.files=files;}
    public void validate(UUID teacher,Save input,boolean complete){
        int min=input.minAgeMonths()==null?36:input.minAgeMonths(),max=input.maxAgeMonths()==null?72:input.maxAgeMonths();
        if(min>max)throw problem("INVALID_GAME_AGE","Tuổi nhỏ nhất không vượt tuổi lớn nhất.");
        var content=input.content();var ids=new HashSet<UUID>();
        file(teacher,content.instructionAudioFileId(),"audio/");
        if("CHOICE".equals(input.gameType())){
            if(!content.pairs().isEmpty()||complete&&content.questions().isEmpty())throw problem("INVALID_GAME_CONTENT","Trò chọn hình cần câu hỏi, không dùng danh sách cặp.");
            for(var q:content.questions()){
                unique(ids,q.id());file(teacher,q.imageFileId(),"image/");file(teacher,q.audioFileId(),"audio/");
                if(complete&&(clean(q.prompt())==null||q.options().size()<2||q.correctOptionId()==null))throw problem("INCOMPLETE_GAME_QUESTION","Mỗi câu cần lời hỏi, 2–4 đáp án và một đáp án đúng.");
                var faces=new HashSet<Face>();
                for(var o:q.options()){unique(ids,o.id());var face=new Face(clean(o.label()),o.imageFileId(),o.audioFileId());face(teacher,face,complete);if(complete&&!faces.add(face))throw problem("DUPLICATE_GAME_OPTION","Các đáp án trong một câu cần khác nhau.");}
                if(q.correctOptionId()!=null&&q.options().stream().noneMatch(o->o.id().equals(q.correctOptionId())))throw problem("INVALID_GAME_ANSWER","Đáp án đúng phải thuộc câu hỏi.");
            }
        }else{
            if(!content.questions().isEmpty()||complete&&content.pairs().size()<2)throw problem("INVALID_GAME_CONTENT","Trò ghép/lật thẻ cần 2–8 cặp, không dùng câu hỏi chọn hình.");
            var left=new HashSet<Face>();var right=new HashSet<Face>();
            for(var p:content.pairs()){
                unique(ids,p.id());face(teacher,p.left(),complete);face(teacher,p.right(),complete);
                if(complete&&(!left.add(normalized(p.left()))||!right.add(normalized(p.right()))))throw problem("DUPLICATE_GAME_PAIR","Mỗi cặp cần mặt thẻ riêng để bé phân biệt.");
                if(complete&&"MEMORY".equals(input.gameType())&&!normalized(p.left()).equals(normalized(p.right())))throw problem("INVALID_MEMORY_PAIR","Hai thẻ trong một cặp ghi nhớ cần cùng nội dung.");
            }
        }
    }
    private Face normalized(Face face){return new Face(clean(face.label()),face.imageFileId(),face.audioFileId());}
    private void unique(Set<UUID> ids,UUID id){if(id==null||!ids.add(id))throw problem("DUPLICATE_GAME_ID","ID câu hỏi, đáp án và cặp cần duy nhất.");}
    private void face(UUID actor,Face face,boolean complete){if(face==null){if(complete)throw problem("EMPTY_GAME_CARD","Bổ sung nội dung cho từng mặt thẻ.");return;}if(complete&&clean(face.label())==null)throw problem("EMPTY_GAME_CARD","Mỗi thẻ/đáp án cần tên mô tả ngắn.");file(actor,face.imageFileId(),"image/");file(actor,face.audioFileId(),"audio/");}
    private void file(UUID actor,UUID id,String kind){if(id==null)return;var file=files.owned(actor,id);if(!"READY".equals(file.getStatus())||!"LESSON_ASSET".equals(file.getPurpose())||!file.getMimeType().startsWith(kind))throw problem("INVALID_GAME_ASSET","Chọn ảnh/âm thanh học liệu đã sẵn sàng trong kho của cô.");}
    public static Set<UUID> assetIds(Map<String,Object> snapshot){var result=new HashSet<UUID>();collect(snapshot,result);return result;}
    private static void collect(Object value,Set<UUID> output){if(value instanceof Map<?,?> m){for(var e:m.entrySet()){if(Set.of("imageFileId","audioFileId","instructionAudioFileId").contains(e.getKey())&&e.getValue()!=null)output.add(UUID.fromString(e.getValue().toString()));else collect(e.getValue(),output);}}else if(value instanceof List<?> l)l.forEach(v->collect(v,output));}
}
