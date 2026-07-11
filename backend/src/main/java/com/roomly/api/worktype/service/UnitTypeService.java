package com.roomly.api.worktype.service;

import com.roomly.api.common.exception.*;
import com.roomly.api.worktype.dto.UnitTypeDto;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.mapper.WorkTypeMapper;
import com.roomly.api.worktype.repository.*;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class UnitTypeService {
  private final UnitTypeRepository repository;
  private final WorkTypeRepository workTypes;
  private final WorkTypeMapper mapper;

  @Transactional
  public UnitTypeDto create(UUID userId, @Valid UnitTypeDto dto) {
    var wt =
        workTypes
            .findByIdAndUserId(dto.workTypeId(), userId)
            .orElseThrow(() -> new NotFoundException("WorkType", dto.workTypeId()));
    var e = new UnitType(wt, dto.name(), dto.unitsPerHour());
    if (repository.existsByWorkTypeIdAndNormalizedName(wt.getId(), e.getNormalizedName()))
      throw new ConflictException("UnitType name already exists");
    apply(e, dto);
    return mapper.toDto(repository.save(e));
  }

  @Transactional
  public UnitTypeDto update(UUID userId, UUID id, @Valid UnitTypeDto dto) {
    var e = find(userId, id);
    if (!e.getWorkType().getId().equals(dto.workTypeId()))
      throw new ValidationException("workType cannot be changed");
    e.rename(dto.name());
    if (repository.existsByWorkTypeIdAndNormalizedNameAndIdNot(
        dto.workTypeId(), e.getNormalizedName(), id))
      throw new ConflictException("UnitType name already exists");
    e.changeUnitsPerHour(dto.unitsPerHour());
    e.changeDisplayOrder(dto.displayOrder());
    if (dto.active()) e.activate();
    else e.deactivate();
    return mapper.toDto(e);
  }

  @Transactional
  public void delete(UUID userId, UUID id) {
    find(userId, id).deactivate();
  }

  @Transactional(readOnly = true)
  public UnitTypeDto get(UUID userId, UUID id) {
    return mapper.toDto(find(userId, id));
  }

  @Transactional(readOnly = true)
  public List<UnitTypeDto> list(UUID userId, UUID workTypeId) {
    workTypes
        .findByIdAndUserId(workTypeId, userId)
        .orElseThrow(() -> new NotFoundException("WorkType", workTypeId));
    return repository.findAllByWorkTypeIdAndActiveTrueOrderByDisplayOrder(workTypeId).stream()
        .map(mapper::toDto)
        .toList();
  }

  private UnitType find(UUID userId, UUID id) {
    return repository
        .findByIdAndWorkTypeUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("UnitType", id));
  }

  private void apply(UnitType e, UnitTypeDto d) {
    e.changeDisplayOrder(d.displayOrder());
    if (d.active()) e.activate();
    else e.deactivate();
  }
}
