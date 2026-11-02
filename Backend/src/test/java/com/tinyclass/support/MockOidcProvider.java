package com.tinyclass.support;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.*;
import tools.jackson.databind.json.JsonMapper;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/** Test-only provider. It is never included in the production JAR. */
public final class MockOidcProvider implements AutoCloseable {
    public enum Fault { NONE, CANCEL, STATE, NONCE, AUDIENCE, ISSUER, SIGNATURE, EXPIRED }
    public record Scenario(String subject, String email, boolean verified, String hd, String name, Fault fault) {
        public static Scenario trusted(String subject, String email) { return new Scenario(subject, email, true, null, "Synthetic Google parent", Fault.NONE); }
        public Scenario withFault(Fault value) { return new Scenario(subject, email, verified, hd, name, value); }
    }
    private record Grant(Map<String, String> request, Scenario scenario) {}
    private final HttpServer server;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final RSAKey key = new RSAKeyGenerator(2048).keyID("tinyclass-test-key").generate();
    private final RSAKey wrong = new RSAKeyGenerator(2048).keyID("tinyclass-test-key").generate();
    private final Map<String, Grant> codes = new ConcurrentHashMap<>();
    private final JsonMapper json = JsonMapper.builder().build();
    private final boolean interactive;
    private volatile Scenario scenario = Scenario.trusted("parent-subject", "qa-parent@gmail.com");
    public MockOidcProvider(int port, boolean interactive) throws Exception {
        this.interactive = interactive;
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.setExecutor(executor);
        server.createContext("/jwks", exchange -> respond(exchange, 200, new JWKSet(key.toPublicJWK()).toJSONObject()));
        server.createContext("/authorize", exchange -> safe(exchange, () -> authorize(exchange)));
        server.createContext("/token", exchange -> safe(exchange, () -> token(exchange)));
        server.start();
    }
    public String issuer() { return "http://127.0.0.1:" + server.getAddress().getPort(); }
    public void scenario(Scenario next) { scenario = next; }

    private void authorize(HttpExchange exchange) throws Exception {
        var values = parameters(exchange.getRequestURI().getRawQuery());
        var callback = URI.create(values.getOrDefault("redirect_uri", ""));
        if (!"tinyclass-test-client".equals(values.get("client_id")) || !"127.0.0.1".equals(callback.getHost())
                || !"/api/v1/auth/google/callback".equals(callback.getPath())) { respond(exchange, 400, Map.of("error", "invalid_request")); return; }
        if (interactive && !values.containsKey("account")) {
            var html = new StringBuilder("<!doctype html><html lang='vi'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>OIDC thử nghiệm</title><body style='font:16px system-ui;max-width:550px;margin:70px auto;padding:25px;background:#f4f7ef;color:#285b4e'><h1>Máy chủ OIDC thử nghiệm</h1><p>Đây là máy chủ giả lập local, không phải Google. Không nhập thông tin tài khoản thật.</p><form action='/authorize'>");
            for (var entry : values.entrySet()) html.append("<input type='hidden' name='").append(escape(entry.getKey())).append("' value='").append(escape(entry.getValue())).append("'>");
            html.append("<label>Chọn tài khoản thử nghiệm <select name='account' style='display:block;margin:20px 0;padding:12px'><option value='teacher'>Giáo viên — ui-teacher@example.test</option><option value='parent'>Phụ huynh — qa-parent@gmail.com</option><option value='external'>Email ngoài — external-parent@example.test</option><option value='wrong'>Tài khoản khác</option><option value='cancel'>Hủy đăng nhập</option></select></label><button style='padding:12px 20px'>Tiếp tục với tài khoản thử nghiệm</button></form></body></html>");
            byte[] body = html.toString().getBytes(StandardCharsets.UTF_8); exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length); try (var out = exchange.getResponseBody()) { out.write(body); } return;
        }
        var chosen = interactive ? switch (values.getOrDefault("account", "")) {
            case "teacher" -> new Scenario("teacher-subject", "ui-teacher@example.test", true, null, "Synthetic teacher", Fault.NONE);
            case "parent" -> Scenario.trusted("parent-subject", "qa-parent@gmail.com");
            case "external" -> new Scenario("external-subject", "external-parent@example.test", true, null, "Synthetic external parent", Fault.NONE);
            case "cancel" -> scenario.withFault(Fault.CANCEL);
            default -> Scenario.trusted("wrong-subject", "wrong-account@gmail.com");
        } : scenario;
        String state = chosen.fault() == Fault.STATE ? "wrong-state" : values.get("state");
        String query;
        if (chosen.fault() == Fault.CANCEL) query = "error=access_denied&state=" + encode(state);
        else {
            String code = UUID.randomUUID().toString(); codes.put(code, new Grant(values, chosen));
            query = "code=" + encode(code) + "&state=" + encode(state);
        }
        exchange.getResponseHeaders().set("Location", callback + "?" + query); exchange.sendResponseHeaders(302, -1); exchange.close();
    }
    private void token(HttpExchange exchange) throws Exception {
        var input = parameters(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        String expected = "Basic " + Base64.getEncoder().encodeToString("tinyclass-test-client:synthetic-test-client-secret".getBytes(StandardCharsets.UTF_8));
        if (!expected.equals(exchange.getRequestHeaders().getFirst("Authorization"))) { respond(exchange, 401, Map.of("error", "invalid_client")); return; }
        var grant = codes.remove(input.get("code"));
        if (grant == null || !Objects.equals(grant.request().get("redirect_uri"), input.get("redirect_uri"))) { respond(exchange, 400, Map.of("error", "invalid_grant")); return; }
        String verifier = input.getOrDefault("code_verifier", "");
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        if (verifier.isEmpty() || !challenge.equals(grant.request().get("code_challenge"))) { respond(exchange, 400, Map.of("error", "invalid_grant")); return; }
        var scenario = grant.scenario(); var fault = scenario.fault(); var now = Instant.now();
        var claims = new JWTClaimsSet.Builder().issuer(fault == Fault.ISSUER ? "https://incorrect-issuer.invalid" : issuer())
                .subject(scenario.subject()).audience(fault == Fault.AUDIENCE ? "incorrect-client" : "tinyclass-test-client")
                .issueTime(Date.from(fault == Fault.EXPIRED ? now.minusSeconds(1200) : now))
                .expirationTime(Date.from(fault == Fault.EXPIRED ? now.minusSeconds(600) : now.plusSeconds(300)))
                .claim("nonce", fault == Fault.NONCE ? "incorrect-nonce" : grant.request().get("nonce"))
                .claim("email", scenario.email()).claim("email_verified", scenario.verified())
                .claim("role", "TEACHER"); // An untrusted role claim must never become an application role.
        if (scenario.name() != null) claims.claim("name", scenario.name());
        if (scenario.hd() != null) claims.claim("hd", scenario.hd());
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims.build());
        jwt.sign(new RSASSASigner(fault == Fault.SIGNATURE ? wrong : key));
        respond(exchange, 200, Map.of("access_token", "synthetic-access-token-not-for-drive", "token_type", "Bearer",
                "expires_in", 300, "scope", "openid email profile", "id_token", jwt.serialize()));
    }
    private void respond(HttpExchange exchange, int status, Object value) throws IOException {
        byte[] body = json.writeValueAsBytes(value); exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, body.length); try (var out = exchange.getResponseBody()) { out.write(body); }
    }
    @FunctionalInterface private interface Work { void run() throws Exception; }
    private void safe(HttpExchange exchange, Work action) throws IOException { try { action.run(); } catch (Exception ignored) { respond(exchange, 500, Map.of("error", "server_error")); } }
    private Map<String, String> parameters(String encoded) {
        var result = new HashMap<String, String>();
        if (encoded != null) for (var item : encoded.split("&")) { var parts = item.split("=", 2); result.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8), parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : ""); }
        return result;
    }
    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private String escape(String value) { return value.replace("&", "&amp;").replace("'", "&#39;").replace("<", "&lt;").replace(">", "&gt;"); }
    @Override public void close() { server.stop(0); executor.shutdownNow(); }
}
