package com.alveryn.api.workproject.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.workproject.dto.*;
import com.alveryn.api.workproject.service.WorkProjectService;
import com.alveryn.api.workrecord.dto.*;
import com.alveryn.api.workrecord.service.WorkRecordService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/work-projects") @RequiredArgsConstructor
public class WorkProjectController {
  private final WorkProjectService projects; private final WorkRecordService sessions;
  @GetMapping public ApiResponse<List<WorkProjectResponse>> list(){return ApiResponse.of(projects.list());}
  @GetMapping("/{id}") public ApiResponse<WorkProjectResponse> get(@PathVariable UUID id){return ApiResponse.of(projects.get(id));}
  @PostMapping @ResponseStatus(HttpStatus.CREATED) public ApiResponse<WorkProjectResponse> create(@Valid @RequestBody WorkProjectRequest r){return ApiResponse.of(projects.create(r));}
  @PutMapping("/{id}") public ApiResponse<WorkProjectResponse> update(@PathVariable UUID id,@Valid @RequestBody WorkProjectRequest r){return ApiResponse.of(projects.update(id,r));}
  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable UUID id){projects.delete(id);}
  @PostMapping("/{id}/sessions") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<WorkRecordResponse> addSession(@PathVariable UUID id,@Valid @RequestBody WorkRecordRequest r){return ApiResponse.of(sessions.createForProject(projects.requireOwned(id),r));}
}
