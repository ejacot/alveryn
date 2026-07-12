package com.roomly.api.worktype.service;

import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.common.exception.ConflictException;
import com.roomly.api.common.exception.NotFoundException;
import com.roomly.api.common.util.InputSanitizer;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.worktype.dto.CreateWorkTypeRequest;
import com.roomly.api.worktype.dto.UpdateWorkTypeRequest;
import com.roomly.api.worktype.dto.WorkTypeResponse;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.mapper.WorkTypeMapper;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.repository.UnitTypeRepository;
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
public class WorkTypeService {
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final WorkTypeRepository repository;
  private final WorkEntryRepository workEntries;
  private final UnitTypeRepository unitTypes;
  private final UserAccountRepository users;
  private final WorkTypeMapper mapper;

  @Transactional
  public WorkTypeResponse create(@Valid CreateWorkTypeRequest dto) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var user =
        users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    var entity = new WorkType(user, dto.name(), dto.calculationMethod());
    if (repository.existsByUserIdAndNormalizedName(userId, entity.getNormalizedName()))
      throw new ConflictException("WorkType name already exists");
    apply(entity, dto);
    return mapper.toWorkTypeResponse(repository.save(entity));
  }

  @Transactional
  public WorkTypeResponse update(UUID id, @Valid UpdateWorkTypeRequest dto) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var entity = find(userId, id);
    validateCalculationMethodChange(userId, entity, dto);
    entity.rename(dto.name());
    if (repository.existsByUserIdAndNormalizedNameAndIdNot(userId, entity.getNormalizedName(), id))
      throw new ConflictException("WorkType name already exists");
    apply(entity, dto);
    return mapper.toWorkTypeResponse(entity);
  }

  @Transactional
  public void delete(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    find(userId, id).deactivate();
  }

  @Transactional(readOnly = true)
  public WorkTypeResponse get(UUID id) {
    return mapper.toWorkTypeResponse(find(authenticatedUserAccessor.requireUserId(), id));
  }

  @Transactional(readOnly = true)
  public List<WorkTypeResponse> list() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    return repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId).stream()
        .map(mapper::toWorkTypeResponse)
        .toList();
  }

  private WorkType find(UUID userId, UUID id) {
    return repository
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("WorkType", id));
  }

  private void apply(WorkType e, CreateWorkTypeRequest d) {
    e.changeColor(d.color());
    e.changeIcon(InputSanitizer.trimToNull(d.icon()));
    e.changeDefaultBreakMinutes(d.defaultBreakMinutes());
    e.changeDisplayOrder(d.displayOrder());
  }

  private void apply(WorkType e, UpdateWorkTypeRequest d) {
    e.changeCalculationMethod(d.calculationMethod());
    e.changeColor(d.color());
    e.changeIcon(InputSanitizer.trimToNull(d.icon()));
    e.changeDefaultBreakMinutes(d.defaultBreakMinutes());
    e.changeDisplayOrder(d.displayOrder());
    if (d.active()) e.activate();
    else e.deactivate();
  }

  private void validateCalculationMethodChange(UUID userId, WorkType entity, UpdateWorkTypeRequest request) {
    if (entity.getCalculationMethod() == request.calculationMethod()) {
      return;
    }
    if (workEntries.existsByUserIdAndWorkTypeId(userId, entity.getId())) {
      throw new ConflictException(
          "calculationMethod cannot be changed after work entries exist; create a new work type instead");
    }
    if (request.calculationMethod() == com.roomly.api.worktype.entity.CalculationMethod.TIME_BASED
        && unitTypes.existsByWorkTypeId(entity.getId())) {
      throw new ConflictException(
          "calculationMethod cannot be changed to TIME_BASED while unit types exist");
    }
  }
}
