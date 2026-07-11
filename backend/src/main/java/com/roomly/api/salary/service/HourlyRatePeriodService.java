package com.roomly.api.salary.service;

import com.roomly.api.common.exception.*;
import com.roomly.api.salary.dto.HourlyRatePeriodDto;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import com.roomly.api.salary.mapper.HourlyRatePeriodMapper;
import com.roomly.api.salary.repository.HourlyRatePeriodRepository;
import com.roomly.api.user.repository.UserAccountRepository;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class HourlyRatePeriodService {
  private final HourlyRatePeriodRepository repository;
  private final UserAccountRepository users;
  private final HourlyRatePeriodMapper mapper;

  @Transactional
  public HourlyRatePeriodDto create(UUID userId, @Valid HourlyRatePeriodDto dto) {
    if (overlaps(userId, dto.validFrom(), dto.validTo()))
      throw new ConflictException("Hourly rate periods overlap");
    var user =
        users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    return mapper.toDto(
        repository.save(
            new HourlyRatePeriod(
                user, dto.hourlyRate(), dto.currency(), dto.validFrom(), dto.validTo())));
  }

  @Transactional
  public HourlyRatePeriodDto update(UUID userId, UUID id, @Valid HourlyRatePeriodDto dto) {
    var e = find(userId, id);
    if (overlapsExcept(userId, dto.validFrom(), dto.validTo(), id))
      throw new ConflictException("Hourly rate periods overlap");
    e.update(dto.hourlyRate(), dto.currency(), dto.validFrom(), dto.validTo());
    return mapper.toDto(e);
  }

  @Transactional
  public void delete(UUID userId, UUID id) {
    repository.delete(find(userId, id));
  }

  @Transactional(readOnly = true)
  public HourlyRatePeriodDto get(UUID userId, UUID id) {
    return mapper.toDto(find(userId, id));
  }

  @Transactional(readOnly = true)
  public List<HourlyRatePeriodDto> list(UUID userId) {
    return repository.findAllByUserIdOrderByValidFromDesc(userId).stream()
        .map(mapper::toDto)
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
