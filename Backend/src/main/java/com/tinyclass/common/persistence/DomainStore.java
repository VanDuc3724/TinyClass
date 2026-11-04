package com.tinyclass.common.persistence;

import com.tinyclass.common.api.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.json.JsonMapper;
import java.sql.*;
import java.util.*;

/** Explicit projections keep management fields out of family responses. All values use bound SQL parameters. */
@Repository
public class DomainStore {
    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final ApplicationEventPublisher events;
    public DomainStore(JdbcTemplate jdbc,JsonMapper json,ApplicationEventPublisher events) { this.jdbc=jdbc; this.json=json; this.events=events; }
    public List<Map<String,Object>> rows(String sql,Object... args) { return jdbc.query(sql,(rs,index)->row(rs),args); }
    public Map<String,Object> one(String sql,Object... args) { return rows(sql,args).stream().findFirst().orElseThrow(DomainStore::missing); }
    public int update(String sql,Object... args) { return jdbc.update(sql,args); }
    public long count(String sql,Object... args) { Long value=jdbc.queryForObject(sql,Long.class,args); return value==null?0:value; }
    public String json(Object value) { return json.writeValueAsString(value); }
    public void audit(UUID actor,String action,String type,UUID id,Map<String,Object> fields,String reason,String trace) {
        update("insert into audit_events(id,actor_id,action,entity_type,entity_id,changed_fields,reason,request_id) values(?,?,?,?,?,?::jsonb,?,?)",UUID.randomUUID(),actor,action,type,id,json(fields),reason,trace);
        events.publishEvent(new BusinessChange(actor,action,type,id));
    }
    public PageResponse<Map<String,Object>> page(List<Map<String,Object>> values,long total,int page,int size) {
        return new PageResponse<>(values,new PageResponse.Metadata(page,size,total,(int)((total+size-1)/size)));
    }
    public static void pagination(int page,int size) { if(page<0||size<1||size>100) throw problem("INVALID_PAGINATION","Phân trang chưa hợp lệ."); }
    public static String search(String q) {
        if(q!=null&&q.length()>150) throw problem("INVALID_SEARCH","Từ khóa tối đa 150 ký tự.");
        return "%"+Objects.toString(q,"").strip().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
    }
    public static void version(Map<String,Object> entity,Long expected) {
        if(expected==null||number(entity,"version")!=expected) throw conflict("VERSION_CONFLICT","Dữ liệu đã thay đổi; tải lại trước khi lưu.");
    }
    public static long number(Map<String,Object> row,String key) { Object value=row.get(key); return value instanceof Number n?n.longValue():0; }
    public static UUID id(Map<String,Object> row,String key) { Object value=row.get(key); return value instanceof UUID id?id:value==null?null:UUID.fromString(value.toString()); }
    public static String text(Map<String,Object> row,String key) { return Objects.toString(row.get(key),""); }
    public static String clean(String value) { return value==null||value.isBlank()?null:value.strip(); }
    public static ApiException missing() { return new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Không tìm thấy dữ liệu hoặc quyền truy cập đã thay đổi."); }
    public static ApiException problem(String code,String message) { return new ApiException(HttpStatus.BAD_REQUEST,code,message); }
    public static ApiException conflict(String code,String message) { return new ApiException(HttpStatus.CONFLICT,code,message); }
    private Map<String,Object> row(ResultSet rs) throws SQLException {
        var result=new LinkedHashMap<String,Object>(); var meta=rs.getMetaData();
        for(int i=1;i<=meta.getColumnCount();i++) {
            String name=meta.getColumnLabel(i); var key=new StringBuilder(); boolean upper=false;
            for(char c:name.toCharArray()) { if(c=='_') upper=true; else { key.append(upper?Character.toUpperCase(c):c); upper=false; } }
            Object value=rs.getObject(i);
            if(value instanceof Timestamp stamp) value=stamp.toInstant();
            else if(value instanceof java.sql.Date date) value=date.toLocalDate();
            else if(value!=null&&"jsonb".equals(meta.getColumnTypeName(i))) value=json.readValue(value.toString(),Object.class);
            result.put(key.toString(),value);
        }
        return result;
    }
}
