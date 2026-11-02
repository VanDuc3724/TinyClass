package com.tinyclass.common.api;

import com.tinyclass.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

public record ApiError(String code, String message, List<FieldErrorDetail> fieldErrors, String traceId) {
    public ApiError {
        fieldErrors = List.copyOf(fieldErrors);
    }

    public static ApiError of(String code, String message, HttpServletRequest request) {
        return new ApiError(code, message, List.of(),
                (String) request.getAttribute(RequestIdFilter.ATTRIBUTE));
    }
}
