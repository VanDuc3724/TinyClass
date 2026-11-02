package com.tinyclass.common.api;

import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> handleUploadSize(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiError.of("FILE_TOO_LARGE", "Tệp vượt quá giới hạn upload.", request));
    }

    @ExceptionHandler({org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.bind.MissingServletRequestParameterException.class})
    ResponseEntity<ApiError> handleMissingPart(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiError.of("INVALID_UPLOAD", "Thiếu tệp hoặc thông tin upload.", request));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> handleInvalidParameter(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiError.of("INVALID_PARAMETER", "Tham số chưa hợp lệ.", request));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleDataConflict(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(
                "DATA_CONFLICT", "Dữ liệu đã tồn tại hoặc vừa thay đổi. Vui lòng tải lại.", request));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApiException(ApiException exception, HttpServletRequest request) {
        return ResponseEntity.status(exception.status())
                .body(ApiError.of(exception.code(), exception.getMessage(), request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception,
                                            HttpServletRequest request) {
        var fields = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldErrorDetail(error.getField(), error.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR", "Dữ liệu chưa hợp lệ.", fields,
                (String) request.getAttribute(RequestIdFilter.ATTRIBUTE)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleInvalidJson(HttpServletRequest request) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("INVALID_JSON", "Nội dung JSON chưa hợp lệ.", request));
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ResponseEntity<ApiError> handleVersionConflict(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(
                "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu.", request));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> handleNotFound(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of("RESOURCE_NOT_FOUND", "Không tìm thấy tài nguyên.", request));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unhandled request failure, requestId={}",
                request.getAttribute(RequestIdFilter.ATTRIBUTE), exception);
        return ResponseEntity.internalServerError().body(ApiError.of(
                "INTERNAL_ERROR", "Hệ thống tạm thời gặp sự cố. Vui lòng thử lại.", request));
    }
}
