package com.alveryn.api.worktype.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.common.util.InputSanitizer;
import com.alveryn.api.workentry.repository.UnitEntryItemRepository;
import com.alveryn.api.worktype.dto.UnitTypeRequest;
import com.alveryn.api.worktype.dto.UnitTypeResponse;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.UnitType;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.mapper.WorkTypeMapper;
import com.alveryn.api.worktype.repository.UnitTypeRepository;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
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
public class UnitTypeService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final UnitTypeRepository repository;
  private final WorkTypeRepository workTypes;
  private final UnitEntryItemRepository unitEntryItems;
  private final WorkTypeMapper mapper;

  @Transactional
  public UnitTypeResponse create(UUID workTypeId, @Valid UnitTypeRequest dto) {
    WorkType wt = findOwnedUnitBasedWorkType(workTypeId);
    var e = new UnitType(wt, dto.name(), dto.unitsPerHour());
    if (repository.existsByWorkTypeIdAndNormalizedName(wt.getId(), e.getNormalizedName()))
      throw new ConflictException("UnitType name already exists");
    applyCreateDefaults(e, wt.getId(), dto);
    return mapper.toUnitTypeResponse(repository.save(e));
  }

  @Transactional
  public UnitTypeResponse update(UUID workTypeId, UUID id, @Valid UnitTypeRequest dto) {
    findOwnedUnitBasedWorkType(workTypeId);
    var e = find(workTypeId, id);
    e.rename(dto.name());
    if (repository.existsByWorkTypeIdAndNormalizedNameAndIdNot(
        workTypeId, e.getNormalizedName(), id))
      throw new ConflictException("UnitType name already exists");
    e.changeUnitsPerHour(dto.unitsPerHour());
    if (dto.displayOrder() != null) {
      e.changeDisplayOrder(dto.displayOrder());
    }
    if (dto.active()) e.activate();
    else e.deactivate();
    return mapper.toUnitTypeResponse(e);
  }

  @Transactional
  public void delete(UUID workTypeId, UUID id) {
    findOwnedUnitBasedWorkType(workTypeId);
    find(workTypeId, id).deactivate();
  }

  @Transactional(readOnly = true)
  public UnitTypeResponse get(UUID workTypeId, UUID id) {
    findOwnedUnitBasedWorkType(workTypeId);
    return mapper.toUnitTypeResponse(find(workTypeId, id));
  }

  @Transactional(readOnly = true)
  public List<UnitTypeResponse> list(UUID workTypeId) {
    findOwnedUnitBasedWorkType(workTypeId);
    return repository.findAllByWorkTypeIdOrderByDisplayOrderAscNameAsc(workTypeId).stream()
        .map(mapper::toUnitTypeResponse)
        .toList();
  }

  private UnitType find(UUID workTypeId, UUID id) {
    return repository
        .findByIdAndWorkTypeIdAndWorkTypeUserId(
            id, workTypeId, authenticatedUserAccessor.requireUserId())
        .orElseThrow(() -> new NotFoundException("UnitType", id));
  }

  private void applyCreateDefaults(UnitType e, UUID workTypeId, UnitTypeRequest d) {
    e.changeDisplayOrder(
        d.displayOrder() != null
            ? d.displayOrder()
            : repository.findMaxDisplayOrderByWorkTypeId(workTypeId) + 1);
    if (d.active()) e.activate();
    else e.deactivate();
  }

  private WorkType findOwnedUnitBasedWorkType(UUID workTypeId) {
    WorkType workType =
        workTypes
            .findByIdAndUserId(workTypeId, authenticatedUserAccessor.requireUserId())
            .orElseThrow(() -> new NotFoundException("WorkType", workTypeId));
    if (workType.getCalculationMethod() != CalculationMethod.UNIT_BASED) {
      throw new ConflictException("Unit types are available only for UNIT_BASED work types");
    }
    return workType;
  }
}
