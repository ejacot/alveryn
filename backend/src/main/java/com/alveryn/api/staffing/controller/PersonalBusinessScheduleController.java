package com.alveryn.api.staffing.controller;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.staffing.dto.StaffingDtos.*;
import com.alveryn.api.staffing.service.StaffingPlannerService;
import java.time.LocalDate;
import java.util.List;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/my/business-schedule") @RequiredArgsConstructor
public class PersonalBusinessScheduleController {
  private final StaffingPlannerService service;
  @GetMapping public ApiResponse<List<PersonalScheduleResponse>> schedule(@RequestParam LocalDate from,@RequestParam LocalDate to){return ApiResponse.of(service.personalSchedule(from,to));}
  @PutMapping("/assignments/{assignmentId}/result") public ApiResponse<AssignmentResultResponse> saveResult(@PathVariable java.util.UUID assignmentId,@Valid @RequestBody ResultRequest request){return ApiResponse.of(service.saveMyResult(assignmentId,request));}
  @PostMapping("/assignments/{assignmentId}/check-in") public ApiResponse<AssignmentResultResponse> checkIn(@PathVariable java.util.UUID assignmentId){return ApiResponse.of(service.checkIn(assignmentId));}
  @PostMapping("/assignments/{assignmentId}/check-out") public ApiResponse<AssignmentResultResponse> checkOut(@PathVariable java.util.UUID assignmentId){return ApiResponse.of(service.checkOut(assignmentId));}
  @GetMapping("/absence-requests") public ApiResponse<List<AbsenceRequestResponse>> absenceRequests(){return ApiResponse.of(service.myAbsenceRequests());}
  @PostMapping("/absence-requests") public ApiResponse<AbsenceRequestResponse> requestAbsence(@Valid @RequestBody AbsenceRequestCreate request){return ApiResponse.of(service.createMyAbsenceRequest(request));}
}
