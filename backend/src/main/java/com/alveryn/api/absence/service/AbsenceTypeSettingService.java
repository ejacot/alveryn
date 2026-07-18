package com.alveryn.api.absence.service;

import com.alveryn.api.absence.dto.AbsenceTypeSettingRequest;
import com.alveryn.api.absence.dto.AbsenceTypeSettingResponse;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import com.alveryn.api.absence.repository.AbsenceTypeSettingRepository;
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
  public AbsenceTypeSettingResponse update(UUID id, @Valid AbsenceTypeSettingRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    AbsenceTypeSetting setting = findOwned(id, userId);
    String normalizedName = AbsenceTypeSetting.normalize(request.name());
    if (repository.existsByUserIdAndNormalizedNameAndIdNot(userId, normalizedName, id)) {
      throw new ConflictException("Absence type already exists");
    }
    setting.update(
        InputSanitizer.requireTrimmed(request.name(), "name"),
        null,
        Boolean.TRUE.equals(request.paid()),
        request.paidMinutesPerDay() == null ? 0 : request.paidMinutesPerDay(),
        request.color(),
        request.active() == null || request.active(),
        request.displayOrder() == null ? setting.getDisplayOrder() : request.displayOrder());
    return toResponse(repository.save(setting));
  }

  @Transactional
  public void deactivate(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    AbsenceTypeSetting setting = findOwned(id, userId);
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

  public AbsenceTypeSettingResponse toResponse(AbsenceTypeSetting setting) {
    return new AbsenceTypeSettingResponse(
        setting.getId(),
        setting.getName(),
        setting.getCode(),
        setting.isPaid(),
        setting.getPaidMinutesPerDay(),
        setting.getColor(),
        setting.isActive(),
        setting.getDisplayOrder());
  }
}
