package com.alveryn.api.worktype.service;

import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.util.InputSanitizer;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import com.alveryn.api.worktype.dto.CreateWorkTypeRequest;
import com.alveryn.api.worktype.dto.UpdateWorkTypeRequest;
import com.alveryn.api.worktype.dto.WorkTypeResponse;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.mapper.WorkTypeMapper;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.workentry.repository.WorkEntryRepository;
import com.alveryn.api.worktype.repository.UnitTypeRepository;
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
  public static final String WORK_TYPE_NAME_EXISTS = "WORK_TYPE_NAME_EXISTS";

  private static final String[] DEFAULT_COLORS = {
    "#87C95A", "#60A5FA", "#F59E0B", "#F472B6", "#A78BFA", "#2DD4BF", "#FB7185"
  };

  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final WorkTypeRepository repository;
  private final WorkEntryRepository workEntries;
  private final UnitTypeRepository unitTypes;
  private final UserAccountRepository users;
  private final UserPreferencesRepository preferences;
  private final WorkTypeMapper mapper;

  @Transactional
  public WorkTypeResponse create(@Valid CreateWorkTypeRequest dto) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var user =
        users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    var entity = new WorkType(user, dto.name(), dto.calculationMethod());
    if (repository.existsByUserIdAndNormalizedName(userId, entity.getNormalizedName()))
      throw workTypeNameExists();
    applyCreateDefaults(entity, userId, dto);
    return mapper.toWorkTypeResponse(repository.save(entity));
  }

  @Transactional
  public WorkTypeResponse update(UUID id, @Valid UpdateWorkTypeRequest dto) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var entity = find(userId, id);
    validateCalculationMethodChange(userId, entity, dto);
    entity.rename(dto.name());
    if (repository.existsByUserIdAndNormalizedNameAndIdNot(userId, entity.getNormalizedName(), id))
      throw workTypeNameExists();
    applyUpdate(entity, dto);
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

  private void applyCreateDefaults(WorkType e, UUID userId, CreateWorkTypeRequest d) {
    int displayOrder =
        d.displayOrder() != null ? d.displayOrder() : repository.findMaxDisplayOrderByUserId(userId) + 1;
    e.changeColor(d.color() != null ? d.color() : DEFAULT_COLORS[Math.floorMod(displayOrder, DEFAULT_COLORS.length)]);
    e.changeIcon(InputSanitizer.trimToNull(d.icon()));
    e.changeDefaultBreakMinutes(defaultBreakMinutes(userId, d.calculationMethod(), d.defaultBreakMinutes()));
    e.changeDisplayOrder(displayOrder);
  }

  private void applyUpdate(WorkType e, UpdateWorkTypeRequest d) {
    e.changeCalculationMethod(d.calculationMethod());
    if (d.color() != null) {
      e.changeColor(d.color());
    }
    e.changeIcon(InputSanitizer.trimToNull(d.icon()));
    if (d.calculationMethod() == CalculationMethod.UNIT_BASED) {
      e.changeDefaultBreakMinutes(null);
    } else if (d.defaultBreakMinutes() != null) {
      e.changeDefaultBreakMinutes(d.defaultBreakMinutes());
    }
    if (d.displayOrder() != null) {
      e.changeDisplayOrder(d.displayOrder());
    }
    if (d.active()) e.activate();
    else e.deactivate();
  }

  private Integer defaultBreakMinutes(UUID userId, CalculationMethod calculationMethod, Integer requested) {
    if (calculationMethod == CalculationMethod.UNIT_BASED) {
      return null;
    }
    if (requested != null) {
      return requested;
    }
    return preferences.findByUserId(userId).map(pref -> pref.getDefaultBreakMinutes()).orElse(30);
  }

  private ConflictException workTypeNameExists() {
    return new ConflictException(
        "Work type name already exists",
        WORK_TYPE_NAME_EXISTS,
        List.of("name: Work type name already exists"));
  }

  private void validateCalculationMethodChange(UUID userId, WorkType entity, UpdateWorkTypeRequest request) {
    if (entity.getCalculationMethod() == request.calculationMethod()) {
      return;
    }
    if (workEntries.existsByUserIdAndWorkTypeId(userId, entity.getId())) {
      throw new ConflictException(
          "calculationMethod cannot be changed after work entries exist; create a new work type instead");
    }
    if (request.calculationMethod() == com.alveryn.api.worktype.entity.CalculationMethod.TIME_BASED
        && unitTypes.existsByWorkTypeId(entity.getId())) {
      throw new ConflictException(
          "calculationMethod cannot be changed to TIME_BASED while unit types exist");
    }
  }
}
