package com.tinyclass.common.api;

import org.springframework.data.domain.Page;

import java.util.List;

public record PageResponse<T>(List<T> data, Metadata meta) {
    public PageResponse {
        data = List.copyOf(data);
    }

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(page.getContent(), new Metadata(
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    public record Metadata(int page, int size, long totalElements, int totalPages) {
    }
}
