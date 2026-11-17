package com.tinyclass.games;

import java.util.*;
import static com.tinyclass.common.persistence.DomainStore.*;

/** Only the server owns the solution and hidden faces. Public views contain playable cards, never answer keys. */
public final class GameEngine {
    private GameEngine() {}
    public static Map<String,Object> fresh(Map<String,Object> snapshot){
        var state=new LinkedHashMap<String,Object>();state.put("moves",0);state.put("wrong",0);state.put("hints",0);state.put("position",0);
        state.put("solved",new ArrayList<String>());state.put("hintKeys",new ArrayList<String>());state.put("open",new ArrayList<String>());
        var content=object(snapshot,"content");
        if("CHOICE".equals(snapshot.get("gameType"))){var orders=new ArrayList<List<String>>();for(var q:objects(content,"questions")){var ids=new ArrayList<>(objects(q,"options").stream().map(o->text(o,"id")).toList());Collections.shuffle(ids);orders.add(ids);}state.put("orders",orders);}
        else{var left=new ArrayList<Map<String,Object>>();var right=new ArrayList<Map<String,Object>>();var cards=new ArrayList<Map<String,Object>>();for(var p:objects(content,"pairs")){left.add(card(p,"left"));right.add(card(p,"right"));cards.add(card(p,"left"));cards.add(card(p,"right"));}Collections.shuffle(left);Collections.shuffle(right);Collections.shuffle(cards);state.put("left",left);state.put("right",right);state.put("cards",cards);}
        return state;
    }
    private static Map<String,Object> card(Map<String,Object> pair,String side){var c=new LinkedHashMap<String,Object>(object(pair,side));c.put("id",UUID.randomUUID().toString());c.put("pairId",text(pair,"id"));return c;}
    public static int total(Map<String,Object> snapshot){return objects(object(snapshot,"content"),"CHOICE".equals(snapshot.get("gameType"))?"questions":"pairs").size();}
    public static boolean finished(Map<String,Object> snapshot,Map<String,Object> state){return strings(state,"solved").size()==total(snapshot);}
    public static int stars(Map<String,Object> snapshot,Map<String,Object> state){if(!finished(snapshot,state))return 0;return number(state,"wrong")==0&&number(state,"hints")==0?3:number(state,"wrong")<=total(snapshot)&&number(state,"hints")<=1?2:1;}
    public static void move(Map<String,Object> snapshot,Map<String,Object> state,GameDtos.Move input){
        if(finished(snapshot,state))throw conflict("GAME_FINISHED","Lượt này đã hoàn thành. Chọn chơi lại để mở lượt mới.");
        String type=text(snapshot,"gameType");var content=object(snapshot,"content");
        state.remove("feedback");
        if("HINT".equals(input.action())){
            String key="CHOICE".equals(type)?"question-"+number(state,"position"):"board";
            if(!strings(state,"hintKeys").contains(key)){strings(state,"hintKeys").add(key);increment(state,"hints");}
            String hint="CHOICE".equals(type)?clean(text(objects(content,"questions").get((int)number(state,"position")),"hint")):null;
            if(hint==null)hint="MEMORY".equals(type)?"Con thử nhớ vị trí hai hình giống nhau nhé.":"MATCH".equals(type)?"Con quan sát từng thẻ và tìm người bạn phù hợp nhé.":"Con nghe lại câu hỏi và quan sát từng hình nhé.";
            state.put("hintText",hint);return;
        }
        if(number(state,"moves")>=1000)throw conflict("GAME_MOVE_LIMIT","Lượt chơi đã dài. Gia đình có thể bắt đầu lượt mới.");
        state.remove("hintText");
        switch(type){
            case "CHOICE"->{
                if(!"ANSWER".equals(input.action())||input.optionId()==null)throw invalid();
                var question=objects(content,"questions").get((int)number(state,"position"));
                String chosen=input.optionId().toString();if(objects(question,"options").stream().noneMatch(o->chosen.equals(text(o,"id"))))throw invalid();
                increment(state,"moves");if(chosen.equals(text(question,"correctOptionId"))){strings(state,"solved").add(text(question,"id"));increment(state,"position");state.put("feedback","CORRECT");}else{increment(state,"wrong");state.put("feedback","TRY_AGAIN");}
            }
            case "MATCH"->{
                if(!"MATCH".equals(input.action())||input.leftId()==null||input.rightId()==null)throw invalid();
                var left=find(objects(state,"left"),input.leftId());var right=find(objects(state,"right"),input.rightId());
                if(strings(state,"solved").contains(text(left,"pairId"))||strings(state,"solved").contains(text(right,"pairId")))throw invalid();
                increment(state,"moves");if(text(left,"pairId").equals(text(right,"pairId"))){strings(state,"solved").add(text(left,"pairId"));state.put("feedback","CORRECT");}else{increment(state,"wrong");state.put("feedback","TRY_AGAIN");}
            }
            case "MEMORY"->{
                if(!"FLIP".equals(input.action())||input.cardId()==null)throw invalid();
                var chosen=find(objects(state,"cards"),input.cardId());var open=strings(state,"open");
                if(open.size()==2)open.clear();
                if(open.contains(input.cardId().toString())||strings(state,"solved").contains(text(chosen,"pairId")))throw invalid();
                open.add(input.cardId().toString());increment(state,"moves");
                if(open.size()==2){var first=find(objects(state,"cards"),UUID.fromString(open.getFirst()));if(text(first,"pairId").equals(text(chosen,"pairId"))){strings(state,"solved").add(text(chosen,"pairId"));open.clear();state.put("feedback","CORRECT");}else{increment(state,"wrong");state.put("feedback","TRY_AGAIN");}}
            }
            default->throw invalid();
        }
    }
    public static Map<String,Object> view(Map<String,Object> snapshot,Map<String,Object> state){
        var result=new LinkedHashMap<String,Object>();String type=text(snapshot,"gameType");result.put("gameType",type);result.put("title",snapshot.get("title"));result.put("instructions",snapshot.get("instructions"));
        result.put("instructionAudioFileId",object(snapshot,"content").get("instructionAudioFileId"));result.put("totalSteps",total(snapshot));result.put("correctCount",strings(state,"solved").size());result.put("wrongCount",number(state,"wrong"));result.put("moveCount",number(state,"moves"));result.put("hintCount",number(state,"hints"));result.put("stars",stars(snapshot,state));result.put("feedback",state.get("feedback"));result.put("hintText",state.get("hintText"));
        if("CHOICE".equals(type)){
            if(!finished(snapshot,state)){int position=(int)number(state,"position");var q=objects(object(snapshot,"content"),"questions").get(position);var publicQ=new LinkedHashMap<String,Object>();for(String key:List.of("id","prompt","imageFileId","audioFileId"))publicQ.put(key,q.get(key));var options=new ArrayList<Map<String,Object>>();var order=(List<?>)list(state,"orders").get(position);for(Object optionId:order)options.add(publicFace(objects(q,"options").stream().filter(o->optionId.toString().equals(text(o,"id"))).findFirst().orElseThrow()));publicQ.put("options",options);result.put("question",publicQ);result.put("questionNumber",position+1);}
        }else if("MATCH".equals(type)){
            for(String side:List.of("left","right"))result.put(side,objects(state,side).stream().map(card->{var c=publicFace(card);c.put("matched",strings(state,"solved").contains(text(card,"pairId")));return c;}).toList());
        }else{
            result.put("cards",objects(state,"cards").stream().map(card->{boolean matched=strings(state,"solved").contains(text(card,"pairId")),visible=matched||strings(state,"open").contains(text(card,"id"));var c=new LinkedHashMap<String,Object>();c.put("id",card.get("id"));c.put("matched",matched);c.put("revealed",visible);if(visible)c.put("face",publicFace(card));return c;}).toList());
            result.put("mismatch",strings(state,"open").size()==2);
        }
        return result;
    }
    private static Map<String,Object> publicFace(Map<String,Object> card){var result=new LinkedHashMap<String,Object>();for(String key:List.of("id","label","imageFileId","audioFileId"))result.put(key,card.get(key));return result;}
    private static Map<String,Object> find(List<Map<String,Object>> cards,UUID id){return cards.stream().filter(c->id.toString().equals(text(c,"id"))).findFirst().orElseThrow(GameEngine::invalid);}
    private static com.tinyclass.common.api.ApiException invalid(){return problem("INVALID_GAME_MOVE","Lựa chọn chưa phù hợp với lượt chơi hiện tại.");}
    private static void increment(Map<String,Object> state,String key){state.put(key,number(state,key)+1);}
    @SuppressWarnings("unchecked")public static Map<String,Object> object(Map<String,Object> map,String key){return (Map<String,Object>)map.get(key);}
    @SuppressWarnings("unchecked")public static List<Map<String,Object>> objects(Map<String,Object> map,String key){return (List<Map<String,Object>>)map.get(key);}
    @SuppressWarnings("unchecked")private static List<String> strings(Map<String,Object> map,String key){return (List<String>)map.get(key);}
    @SuppressWarnings("unchecked")private static List<Object> list(Map<String,Object> map,String key){return (List<Object>)map.get(key);}
}
