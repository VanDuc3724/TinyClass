package com.tinyclass.support;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.net.http.*;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public final class ApiBrowser implements AutoCloseable {
    private final HttpClient http = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
    private final JsonMapper json;
    private final String base;
    public ApiBrowser(String base, JsonMapper json) { this.base = base + "/api/v1"; this.json = json; }
    public Result get(String path) throws Exception { return send(HttpRequest.newBuilder(URI.create(base + path)).GET().build()); }
    public Result post(String path, Object body) throws Exception { return write("POST", path, body, true); }
    public Result patch(String path, Object body) throws Exception { return write("PATCH", path, body, true); }
    public HttpResponse<byte[]> binaryGet(String path, Map<String,String> headers) throws Exception {
        var request=HttpRequest.newBuilder(URI.create(base+path)).GET(); headers.forEach(request::header);
        return http.send(request.build(),HttpResponse.BodyHandlers.ofByteArray());
    }
    public Result multipart(String path,String name,String type,byte[] data,Map<String,String> fields,boolean csrf) throws Exception {
        String boundary="TinyClassTestBoundary";
        var out=new ByteArrayOutputStream();
        for(var field:fields.entrySet()) out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\""+field.getKey()+"\"\r\n\r\n"+field.getValue()+"\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\""+name+"\"\r\nContent-Type: "+type+"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(data); out.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
        var request=HttpRequest.newBuilder(URI.create(base+path)).header("Content-Type","multipart/form-data; boundary="+boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(out.toByteArray()));
        if(csrf) { var token=get("/auth/csrf").data(); request.header(token.path("headerName").stringValue(),token.path("token").stringValue()); }
        return send(request.build());
    }
    public HttpResponse<String> rawGet(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(path.startsWith("http") ? path : base + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    public Result write(String method, String path, Object body, boolean csrf) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (csrf) {
            var token = get("/auth/csrf").data();
            builder.header(token.path("headerName").stringValue(), token.path("token").stringValue());
        }
        return send(builder.build());
    }
    private Result send(HttpRequest request) throws Exception {
        var response = http.send(request, HttpResponse.BodyHandlers.ofString());
        return new Result(response.statusCode(), json.readTree(response.body()));
    }
    public record Result(int status, JsonNode body) { public JsonNode data() { return body.path("data"); } }
    @Override public void close() { http.close(); }
}
