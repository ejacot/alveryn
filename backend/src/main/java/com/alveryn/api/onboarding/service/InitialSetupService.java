package com.alveryn.api.onboarding.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.employment.dto.EmploymentRequest;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.entity.TargetPeriod;
import com.alveryn.api.employment.entity.TrackingFocus;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.employment.service.EmploymentService;
import com.alveryn.api.onboarding.controller.TrackingSetupController;
import com.alveryn.api.onboarding.dto.InitialSetupRequest;
import com.alveryn.api.onboarding.dto.InitialSetupResponse;
import com.alveryn.api.salary.dto.HourlyRatePeriodRequest;
import com.alveryn.api.salary.service.HourlyRatePeriodService;
import com.alveryn.api.user.dto.UserPreferencesRequest;
import com.alveryn.api.user.dto.UserProfileRequest;
import com.alveryn.api.user.service.UserPreferencesService;
import com.alveryn.api.user.service.UserProfileService;
import com.alveryn.api.worktype.dto.CreateWorkTypeRequest;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.service.WorkTypeService;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InitialSetupService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final EmploymentRepository employments;
  private final UserProfileService profiles;
  private final UserPreferencesService preferences;
  private final EmploymentService employmentService;
  private final HourlyRatePeriodService hourlyRates;
  private final WorkTypeService workTypes;
  private final OnboardingService onboarding;

  @Transactional
  public InitialSetupResponse complete(InitialSetupRequest request) {
    var userId = authenticatedUserAccessor.requireUserId();
    if (employments.existsByUserIdAndActiveTrue(userId)) {
      throw new ConflictException("Initial setup is available only before the first employment is created");
    }
    validateConditionalFields(request);

    preferences.update(new UserPreferencesRequest(
        request.language(), request.timezone(), request.currency(), request.firstDayOfWeek(),
        request.dateFormat(), request.timeFormat(), request.theme(), request.defaultBreakMinutes(),
        request.preferredDailyMinutes(), request.paidSickLeave(), request.paidVacation()));
    profiles.update(new UserProfileRequest(
        request.firstName(), request.lastName(), null, null, null, null, null, null,
        null, null, null, null, null, null, null, null));

    boolean fixedSalary = request.compensationType() == CompensationType.FIXED_SALARY;
    boolean balanceEnabled = fixedSalary || request.hourBalanceEnabled();
    var employment = employmentService.create(new EmploymentRequest(
        request.employmentName(), null, request.compensationType(),
        fixedSalary ? TrackingFocus.TIME : TrackingFocus.EARNINGS,
        balanceEnabled, request.timerEnabled(), request.startDate(), request.startDate(), null,
        fixedSalary ? request.fixedSalaryAmount() : null, request.currency(),
        balanceEnabled ? request.targetMinutes() : null,
        balanceEnabled ? TargetPeriod.MONTHLY : null,
        balanceEnabled ? request.hourBalanceValidityMonths() : null, true, 0));

    if (request.compensationType() == CompensationType.HOURLY) {
      hourlyRates.create(new HourlyRatePeriodRequest(
          employment.id(), request.hourlyRate(), request.currency(), request.startDate(), null));
    }

    WorkTypeDefinition definition = workTypeDefinition(request);
    var workType = workTypes.create(new CreateWorkTypeRequest(
        request.workTypeName(), employment.id(), null, definition.calculationMethod(),
        definition.compensationMethod(), definition.unitLabel(), definition.unitSymbol(), null,
        definition.ratePerUnit(), definition.currency(), false, false, false, null, null,
        definition.defaultBreakMinutes(), 0));

    preferences.completeTrackingSetupVersion(TrackingSetupController.REQUIRED_VERSION);
    var status = onboarding.complete();
    return new InitialSetupResponse(employment.id(), workType.id(), status);
  }

  private void validateConditionalFields(InitialSetupRequest request) {
    if (request.compensationType() == CompensationType.HOURLY && request.hourlyRate() == null) {
      throw new IllegalArgumentException("hourlyRate is required for hourly work");
    }
    if (request.compensationType() == CompensationType.FIXED_SALARY
        && request.fixedSalaryAmount() == null) {
      throw new IllegalArgumentException("fixedSalaryAmount is required for fixed salary");
    }
    if ((request.compensationType() == CompensationType.FIXED_SALARY
        || request.hourBalanceEnabled())
        && (request.targetMinutes() == null || request.hourBalanceValidityMonths() == null)) {
      throw new IllegalArgumentException("targetMinutes and hourBalanceValidityMonths are required for hour balance");
    }
    if (request.compensationType() == CompensationType.PER_UNIT
        && (request.ratePerUnit() == null || request.unitLabel() == null
            || request.unitLabel().isBlank())) {
      throw new IllegalArgumentException("unitLabel and ratePerUnit are required for per-unit work");
    }
  }

  private WorkTypeDefinition workTypeDefinition(InitialSetupRequest request) {
    return switch (request.compensationType()) {
      case PER_UNIT -> new WorkTypeDefinition(
          CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT,
          request.unitLabel(), request.unitSymbol(), request.ratePerUnit(), request.currency(), null);
      case FIXED_AMOUNT -> new WorkTypeDefinition(
          CalculationMethod.FIXED_PRICE_BASED, CompensationMethod.HOURLY,
          null, null, null, null, null);
      case HOURLY, FIXED_SALARY -> new WorkTypeDefinition(
          CalculationMethod.TIME_BASED, CompensationMethod.HOURLY,
          null, null, null, null, request.defaultBreakMinutes());
    };
  }

  private record WorkTypeDefinition(
      CalculationMethod calculationMethod,
      CompensationMethod compensationMethod,
      String unitLabel,
      String unitSymbol,
      BigDecimal ratePerUnit,
      String currency,
      Integer defaultBreakMinutes) {}
}
