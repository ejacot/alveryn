package com.roomly.api.workentry.controller;

import com.roomly.api.workentry.dto.WorkEntryRequest;
import com.roomly.api.workentry.dto.WorkEntryResponse;
import com.roomly.api.workentry.service.WorkEntryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;

@Validated
@RestController
@RequestMapping("/api/work-entries")
@RequiredArgsConstructor
public class WorkEntryController {
  private final WorkEntryService workEntryService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public WorkEntryResponse create(@Valid @RequestBody WorkEntryRequest request) {
    return workEntryService.create(request);
  }

  @GetMapping
  public Page<WorkEntryResponse> list(
      @RequestParam(required = false) @Min(1900) Integer year,
      @RequestParam(required = false) @Min(1) @Max(12) Integer month,
      @RequestParam(required = false) UUID workTypeId,
      @PageableDefault(size = 20) Pageable pageable) {
    return workEntryService.list(year, month, workTypeId, pageable);
  }

  @GetMapping("/{id}")
  public WorkEntryResponse get(@PathVariable UUID id) {
    return workEntryService.get(id);
  }

  @PutMapping("/{id}")
  public WorkEntryResponse update(@PathVariable UUID id, @Valid @RequestBody WorkEntryRequest request) {
    return workEntryService.update(id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    workEntryService.delete(id);
  }
}
