package com.tinyclass.storage;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.storage.FileDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController @RequestMapping("/api/v1")
public class FileController {
    private final FileService service;
    public FileController(FileService service) { this.service=service; }
    @GetMapping("/storage-connections")
    ApiResponse<List<ConnectionView>> connections(@AuthenticationPrincipal UserPrincipal user) { return ApiResponse.of(service.connections(user.id())); }
    @GetMapping("/files")
    PageResponse<FileView> list(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) String q,
            @RequestParam(required=false) String purpose,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return service.list(user.id(),q,purpose,page,size);
    }
    @PostMapping(value="/files",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    ApiResponse<FileView> upload(@AuthenticationPrincipal UserPrincipal user,@RequestPart MultipartFile file,
            @RequestParam(required=false) UUID storageConnectionId,@RequestParam(defaultValue="LESSON_ASSET") String purpose,
            @RequestParam(defaultValue="false") boolean learnerDownloadAllowed,HttpServletRequest request) {
        return ApiResponse.of(service.upload(user.id(),file,storageConnectionId,purpose,learnerDownloadAllowed,(String)request.getAttribute(RequestIdFilter.ATTRIBUTE)));
    }
    @GetMapping("/files/{id}") ApiResponse<FileView> detail(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id) { return ApiResponse.of(service.detail(user.id(),id)); }
    @PatchMapping("/files/{id}/policy") ApiResponse<FileView> policy(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,
            @Valid @RequestBody PolicyInput input,HttpServletRequest request) { return ApiResponse.of(service.policy(user.id(),id,input,(String)request.getAttribute(RequestIdFilter.ATTRIBUTE))); }
    @GetMapping("/files/{id}/{action:content|download}")
    ResponseEntity<Resource> bytes(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@PathVariable String action) {
        return response(service.content(user.id(),id),"download".equals(action));
    }
    public static ResponseEntity<Resource> response(FileService.Content content,boolean download) {
        var disposition=(download?ContentDisposition.attachment():ContentDisposition.inline()).filename(content.name(),StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(content.mime())).contentLength(content.size())
                .header(HttpHeaders.CONTENT_DISPOSITION,disposition.toString()).header(HttpHeaders.CACHE_CONTROL,"private, no-store")
                .header("X-Content-Type-Options","nosniff").header(HttpHeaders.ACCEPT_RANGES,"bytes")
                .header("Content-Security-Policy","sandbox; default-src 'none'; style-src 'unsafe-inline'").body(content.resource());
    }
}
