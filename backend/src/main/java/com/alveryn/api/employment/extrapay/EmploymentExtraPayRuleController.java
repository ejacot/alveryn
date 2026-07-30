package com.alveryn.api.employment.extrapay;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.employment.repository.EmploymentRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.DayOfWeek;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employments/{employmentId}/extra-pay-rules")
@RequiredArgsConstructor
public class EmploymentExtraPayRuleController {
  private final AuthenticatedUserAccessor userAccessor;
  private final EmploymentRepository employments;
  private final EmploymentExtraPayRuleRepository rules;

  @GetMapping
  @Transactional(readOnly = true)
  public ApiResponse<List<Response>> list(@PathVariable UUID employmentId) {
    requireEmployment(employmentId);
    return ApiResponse.of(rules.findAllByEmploymentIdOrderByWeekday(employmentId)
        .stream().map(Response::from).toList());
  }

  @PutMapping("/{weekday}")
  @Transactional
  public ApiResponse<Response> put(
      @PathVariable UUID employmentId,
      @PathVariable DayOfWeek weekday,
      @Valid @RequestBody Request request) {
    var employment = requireEmployment(employmentId);
    var rule = rules.findByEmploymentIdAndWeekday(employmentId, weekday)
        .orElseGet(() -> new EmploymentExtraPayRule(
            employment, weekday, request.percentage()));
    rule.changePercentage(request.percentage());
    return ApiResponse.of(Response.from(rules.save(rule)));
  }

  @DeleteMapping("/{weekday}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void delete(
      @PathVariable UUID employmentId, @PathVariable DayOfWeek weekday) {
    requireEmployment(employmentId);
    rules.findByEmploymentIdAndWeekday(employmentId, weekday)
        .ifPresent(rules::delete);
  }

  private com.alveryn.api.employment.entity.Employment requireEmployment(UUID id) {
    return employments.findByIdAndUserId(id, userAccessor.requireUserId())
        .orElseThrow(() -> new IllegalArgumentException("Employment was not found"));
  }

  public record Request(@NotNull @Positive @Max(1000) BigDecimal percentage) {}

  public record Response(UUID id, DayOfWeek weekday, BigDecimal percentage) {
    static Response from(EmploymentExtraPayRule rule) {
      return new Response(rule.getId(), rule.getWeekday(), rule.getPercentage());
    }
  }
}
