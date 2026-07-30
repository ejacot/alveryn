package com.alveryn.api.absence.service;

import com.alveryn.api.absence.dto.AbsenceTypeSettingRequest;
import com.alveryn.api.absence.dto.AbsenceTypeSettingResponse;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.repository.AbsenceTypeSettingRepository;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.util.InputSanitizer;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class AbsenceTypeSettingService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final AbsenceTypeSettingRepository repository;
  private final AbsenceRepository absences;
  private final UserAccountRepository users;

  @Transactional
  public List<AbsenceTypeSettingResponse> list(boolean activeOnly) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<AbsenceTypeSetting> result =
        activeOnly
            ? repository.findAllByUserIdAndActiveTrueOrderByDisplayOrderAscNameAsc(userId)
            : repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId);
    return result.stream().map(this::toResponse).toList();
  }

  @Transactional
  public AbsenceTypeSettingResponse create(@Valid AbsenceTypeSettingRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    String normalizedName = AbsenceTypeSetting.normalize(request.name());
    if (repository.existsByUserIdAndNormalizedName(userId, normalizedName)) {
      throw new ConflictException("Absence type already exists");
    }
    UserAccount user = users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    AbsenceTypeSetting setting =
        new AbsenceTypeSetting(
            user,
            InputSanitizer.requireTrimmed(request.name(), "name"),
            null,
            Boolean.TRUE.equals(request.paid()),
            request.paidMinutesPerDay() == null ? 0 : request.paidMinutesPerDay(),
            request.color(),
            request.displayOrder() == null ? nextDisplayOrder(userId) : request.displayOrder());
    return toResponse(repository.save(setting));
  }

  @Transactional
  public void ensurePersonalDefaults(
      boolean paidSickLeave,
      int sickLeavePaidMinutesPerDay,
      boolean paidVacation,
      int vacationPaidMinutesPerDay) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    UserAccount user = users.findById(userId)
        .orElseThrow(() -> new NotFoundException("UserAccount", userId));
    ensureDefault(
        user,
        AbsenceType.SICK_LEAVE,
        "Sick leave",
        paidSickLeave,
        sickLeavePaidMinutesPerDay,
        "#EF4444",
        0);
    ensureDefault(
        user,
        AbsenceType.VACATION,
        "Vacation",
        paidVacation,
        vacationPaidMinutesPerDay,
        "#10B981",
        1);
  }

  @Transactional
  public AbsenceTypeSettingResponse ensureImportType(AbsenceType type) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var existing = repository.findByUserIdAndCode(userId, type);
    if (existing.isPresent()) {
      AbsenceTypeSetting setting = existing.get();
      if (!setting.isActive()) {
        setting.update(
            setting.getName(), type, setting.isPaid(), setting.getPaidMinutesPerDay(),
            setting.getColor(), true, setting.getDisplayOrder());
        repository.save(setting);
      }
      return toResponse(setting);
    }
    UserAccount user = users.findById(userId)
        .orElseThrow(() -> new NotFoundException("UserAccount", userId));
    String name = switch (type) {
      case VACATION -> "Vacation";
      case SICK_LEAVE -> "Sick leave";
      case DAY_OFF -> "Day off";
      case PUBLIC_HOLIDAY -> "Public holiday";
    };
    var existingByName =
        repository.findByUserIdAndNormalizedName(userId, AbsenceTypeSetting.normalize(name));
    if (existingByName.isPresent()) {
      AbsenceTypeSetting setting = existingByName.get();
      setting.update(
          setting.getName(),
          type,
          setting.isPaid(),
          setting.getPaidMinutesPerDay(),
          setting.getColor(),
          true,
          setting.getDisplayOrder());
      return toResponse(repository.save(setting));
    }
    String color = switch (type) {
      case VACATION -> "#10B981";
      case SICK_LEAVE -> "#EF4444";
      case DAY_OFF -> "#737373";
      case PUBLIC_HOLIDAY -> "#F59E0B";
    };
    return toResponse(repository.save(new AbsenceTypeSetting(
        user, name, type, false, 0, color, nextDisplayOrder(userId))));
  }

  @Transactional
  public AbsenceTypeSettingResponse update(UUID id, @Valid AbsenceTypeSettingRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    AbsenceTypeSetting setting = findOwned(id, userId);
    String normalizedName = AbsenceTypeSetting.normalize(request.name());
    if (repository.existsByUserIdAndNormalizedNameAndIdNot(userId, normalizedName, id)) {
      throw new ConflictException("Absence type already exists");
    }
    setting.update(
        InputSanitizer.requireTrimmed(request.name(), "name"),
        setting.getCode(),
        Boolean.TRUE.equals(request.paid()),
        request.paidMinutesPerDay() == null ? 0 : request.paidMinutesPerDay(),
        request.color(),
        request.active() == null || request.active(),
        request.displayOrder() == null ? setting.getDisplayOrder() : request.displayOrder());
    return toResponse(repository.save(setting));
  }

  @Transactional
  public void deleteOrDeactivate(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    AbsenceTypeSetting setting = findOwned(id, userId);
    if (!absences.existsByAbsenceTypeSettingId(id)) {
      repository.delete(setting);
      return;
    }
    setting.update(
        setting.getName(),
        setting.getCode(),
        setting.isPaid(),
        setting.getPaidMinutesPerDay(),
        setting.getColor(),
        false,
        setting.getDisplayOrder());
    repository.save(setting);
  }

  private AbsenceTypeSetting findOwned(UUID id, UUID userId) {
    return repository.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("AbsenceType", id));
  }

  private int nextDisplayOrder(UUID userId) {
    return repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId).stream()
            .mapToInt(AbsenceTypeSetting::getDisplayOrder)
            .max()
            .orElse(-1)
        + 1;
  }

  private void ensureDefault(
      UserAccount user,
      AbsenceType code,
      String name,
      boolean paid,
      int paidMinutesPerDay,
      String color,
      int displayOrder) {
    repository.findByUserIdAndCode(user.getId(), code).ifPresentOrElse(
        existing -> existing.update(
            existing.getName(),
            code,
            paid,
            paid ? paidMinutesPerDay : 0,
            existing.getColor(),
            true,
            existing.getDisplayOrder()),
        () -> repository.save(new AbsenceTypeSetting(
            user,
            name,
            code,
            paid,
            paid ? paidMinutesPerDay : 0,
            color,
            displayOrder)));
  }

  public AbsenceTypeSettingResponse toResponse(AbsenceTypeSetting setting) {
    return new AbsenceTypeSettingResponse(
        setting.getId(),
        setting.getName(),
        setting.getCode(),
        setting.isPaid(),
        setting.getPaidMinutesPerDay(),
        setting.getColor(),
        setting.isActive(),
        setting.getDisplayOrder(),
        !absences.existsByAbsenceTypeSettingId(setting.getId()));
  }
}
