package com.alveryn.api.common.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.springframework.data.domain.Page;

@Schema(description = "Stable paginated response payload")
public record PageResponse<T>(
    @Schema(description = "Current page content") List<T> content,
    @Schema(description = "Zero-based page index", example = "0") int page,
    @Schema(description = "Requested page size", example = "20") int size,
    @Schema(description = "Total number of elements", example = "42") long totalElements,
    @Schema(description = "Total number of pages", example = "3") int totalPages,
    @Schema(description = "Whether this is the first page", example = "true") boolean first,
    @Schema(description = "Whether this is the last page", example = "false") boolean last,
    @Schema(description = "Whether a next page exists", example = "true") boolean hasNext,
    @Schema(description = "Whether a previous page exists", example = "false") boolean hasPrevious,
    @Schema(description = "Number of elements in the current page", example = "20")
        int numberOfElements) {
  public static <T> PageResponse<T> from(Page<T> page) {
    return new PageResponse<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.isFirst(),
        page.isLast(),
        page.hasNext(),
        page.hasPrevious(),
        page.getNumberOfElements());
  }
}
