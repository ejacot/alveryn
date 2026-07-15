package com.alveryn.api.salary.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.util.InputSanitizer;
import com.alveryn.api.salary.dto.HourlyRatePeriodRequest;
import com.alveryn.api.salary.dto.HourlyRatePeriodResponse;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.salary.mapper.HourlyRatePeriodMapper;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
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
public class HourlyRatePeriodService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final HourlyRatePeriodRepository repository;
  private final UserAccountRepository users;
  private final HourlyRatePeriodMapper mapper;

  @Transactional
  public HourlyRatePeriodResponse create(@Valid HourlyRatePeriodRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    if (overlaps(userId, request.validFrom(), request.validTo()))
      throw new ConflictException("Hourly rate periods overlap");
    var user =
        users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    return mapper.toResponse(
        repository.save(
            new HourlyRatePeriod(
                user,
                request.hourlyRate(),
                InputSanitizer.normalizeCurrency(request.currency()),
                request.validFrom(),
                request.validTo())));
  }

  @Transactional
  public HourlyRatePeriodResponse update(UUID id, @Valid HourlyRatePeriodRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var e = find(userId, id);
    if (overlapsExcept(userId, request.validFrom(), request.validTo(), id))
      throw new ConflictException("Hourly rate periods overlap");
    e.update(
        request.hourlyRate(),
        InputSanitizer.normalizeCurrency(request.currency()),
        request.validFrom(),
        request.validTo());
    return mapper.toResponse(e);
  }

  @Transactional
  public void delete(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    repository.delete(find(userId, id));
  }

  @Transactional(readOnly = true)
  public HourlyRatePeriodResponse get(UUID id) {
    return mapper.toResponse(find(authenticatedUserAccessor.requireUserId(), id));
  }

  @Transactional(readOnly = true)
  public List<HourlyRatePeriodResponse> list() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    return repository.findAllByUserIdOrderByValidFromDesc(userId).stream()
        .map(mapper::toResponse)
        .toList();
  }

  private HourlyRatePeriod find(UUID userId, UUID id) {
    return repository
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("HourlyRatePeriod", id));
  }

  private boolean overlaps(UUID userId, java.time.LocalDate from, java.time.LocalDate to) {
    return to == null
        ? repository.existsOverlappingOpenEnded(userId, from)
        : repository.existsOverlappingClosed(userId, from, to);
  }

  private boolean overlapsExcept(
      UUID userId, java.time.LocalDate from, java.time.LocalDate to, UUID id) {
    return to == null
        ? repository.existsOverlappingOpenEndedExcluding(userId, from, id)
        : repository.existsOverlappingClosedExcluding(userId, from, to, id);
  }
}
