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
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.mapper.WorkTypeMapper;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import jakarta.validation.Valid;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
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
  private final WorkRecordLineRepository workRecordLines;
  private final UserAccountRepository users;
  private final UserPreferencesRepository preferences;
  private final WorkTypeMapper mapper;

  @Transactional
  public WorkTypeResponse create(@Valid CreateWorkTypeRequest dto) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var user =
        users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    CompensationMethod compensationMethod = resolveCompensationMethod(dto.compensationMethod());
    var entity = new WorkType(user, dto.name(), dto.calculationMethod(), compensationMethod);
    entity.changeParent(resolveParent(userId, dto.parentId()));
    if (existsByUserAndParentAndName(userId, entity.getParent(), entity.getNormalizedName()))
      throw workTypeNameExists();
    applyCreateDefaults(entity, userId, dto);
    WorkType saved = repository.save(entity);
    return toResponse(userId, saved);
  }

  @Transactional
  public WorkTypeResponse update(UUID id, @Valid UpdateWorkTypeRequest dto) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    var entity = find(userId, id);
    validateCalculationMethodChange(userId, entity, dto);
    entity.rename(dto.name());
    entity.changeParent(resolveParent(userId, dto.parentId()));
    if (existsByUserAndParentAndNameAndIdNot(userId, entity.getParent(), entity.getNormalizedName(), id))
      throw workTypeNameExists();
    applyUpdate(entity, dto);
    if (entity.isCompositeEnabled() && dto.extraPayEnabled() != null) {
      Set<UUID> descendants = familyIds(
          repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId), entity.getId());
      repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId).stream()
          .filter(workType -> !workType.getId().equals(entity.getId()))
          .filter(workType -> descendants.contains(workType.getId()))
          .forEach(workType -> workType.changeExtraPayEnabled(dto.extraPayEnabled()));
    }
    return toResponse(userId, entity);
  }

  @Transactional
  public void delete(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkType entity = find(userId, id);
    List<WorkType> workTypes = repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId);
    Set<UUID> familyIds = familyIds(workTypes, id);
    Set<UUID> usedIds = new HashSet<>(workRecordLines.findUsedWorkTypeIdsByUserId(userId));
    if (familyIds.stream().anyMatch(usedIds::contains)) {
      entity.deactivate();
      return;
    }
    workTypes.stream()
        .filter(workType -> !workType.getId().equals(id) && familyIds.contains(workType.getId()))
        .sorted((left, right) -> Integer.compare(depth(right), depth(left)))
        .forEach(repository::delete);
    repository.flush();
    repository.delete(entity);
  }

  @Transactional(readOnly = true)
  public WorkTypeResponse get(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    WorkType entity = find(userId, id);
    List<WorkType> workTypes = repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId);
    Set<UUID> usedIds = new HashSet<>(workRecordLines.findUsedWorkTypeIdsByUserId(userId));
    return toResponse(entity, isFamilyUnused(workTypes, usedIds, entity.getId()));
  }

  @Transactional(readOnly = true)
  public List<WorkTypeResponse> list() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkType> workTypes = repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId);
    Set<UUID> usedIds = new HashSet<>(workRecordLines.findUsedWorkTypeIdsByUserId(userId));
    return workTypes.stream()
        .map(entity -> toResponse(entity, isFamilyUnused(workTypes, usedIds, entity.getId())))
        .toList();
  }

  private WorkTypeResponse toResponse(UUID userId, WorkType entity) {
    List<WorkType> workTypes = repository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId);
    Set<UUID> usedIds = new HashSet<>(workRecordLines.findUsedWorkTypeIdsByUserId(userId));
    return toResponse(entity, isFamilyUnused(workTypes, usedIds, entity.getId()));
  }

  private WorkTypeResponse toResponse(WorkType entity, boolean deletable) {
    WorkTypeResponse response = mapper.toWorkTypeResponse(entity);
    return new WorkTypeResponse(
        response.id(),
        response.parentId(),
        response.name(),
        response.calculationMethod(),
        response.compensationMethod(),
        response.unitLabel(),
        response.unitSymbol(),
        response.unitsPerHour(),
        response.ratePerUnit(),
        response.currency(),
        response.teamworkEnabled(),
        response.extraPayEnabled(),
        response.compositeEnabled(),
        response.color(),
        response.icon(),
        response.defaultBreakMinutes(),
        response.displayOrder(),
        response.active(),
        deletable);
  }

  private boolean isFamilyUnused(List<WorkType> workTypes, Set<UUID> usedIds, UUID rootId) {
    return familyIds(workTypes, rootId).stream().noneMatch(usedIds::contains);
  }

  private Set<UUID> familyIds(List<WorkType> workTypes, UUID rootId) {
    Set<UUID> ids = new HashSet<>();
    ids.add(rootId);
    boolean changed;
    do {
      changed = false;
      for (WorkType workType : workTypes) {
        if (workType.getParent() != null
            && ids.contains(workType.getParent().getId())
            && ids.add(workType.getId())) {
          changed = true;
        }
      }
    } while (changed);
    return ids;
  }

  private int depth(WorkType workType) {
    int depth = 0;
    WorkType current = workType;
    while (current.getParent() != null) {
      depth++;
      current = current.getParent();
    }
    return depth;
  }

  private WorkType find(UUID userId, UUID id) {
    return repository
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("WorkType", id));
  }

  private WorkType resolveParent(UUID userId, UUID parentId) {
    if (parentId == null) {
      return null;
    }
    WorkType parent = find(userId, parentId);
    parent.changeCompositeEnabled(true);
    return parent;
  }

  private boolean existsByUserAndParentAndName(UUID userId, WorkType parent, String normalizedName) {
    return parent == null
        ? repository.existsByUserIdAndParentIsNullAndNormalizedName(userId, normalizedName)
        : repository.existsByUserIdAndParentIdAndNormalizedName(userId, parent.getId(), normalizedName);
  }

  private boolean existsByUserAndParentAndNameAndIdNot(
      UUID userId, WorkType parent, String normalizedName, UUID id) {
    return parent == null
        ? repository.existsByUserIdAndParentIsNullAndNormalizedNameAndIdNot(userId, normalizedName, id)
        : repository.existsByUserIdAndParentIdAndNormalizedNameAndIdNot(userId, parent.getId(), normalizedName, id);
  }

  private void applyCreateDefaults(WorkType e, UUID userId, CreateWorkTypeRequest d) {
    int displayOrder =
        d.displayOrder() != null ? d.displayOrder() : repository.findMaxDisplayOrderByUserId(userId) + 1;
    e.changeColor(d.color() != null ? d.color() : DEFAULT_COLORS[Math.floorMod(displayOrder, DEFAULT_COLORS.length)]);
    e.changeIcon(InputSanitizer.trimToNull(d.icon()));
    e.changeDefaultBreakMinutes(defaultBreakMinutes(userId, d.calculationMethod(), d.defaultBreakMinutes()));
    e.changeTeamworkEnabled(Boolean.TRUE.equals(d.teamworkEnabled()));
    if (d.extraPayEnabled() != null) {
      e.changeExtraPayEnabled(d.extraPayEnabled());
    }
    e.changeCompositeEnabled(Boolean.TRUE.equals(d.compositeEnabled()));
    e.configureUnit(InputSanitizer.trimToNull(d.unitLabel()), InputSanitizer.trimToNull(d.unitSymbol()));
    e.configureFormula(d.unitsPerHour(), d.ratePerUnit(), InputSanitizer.trimToNull(d.currency()));
    e.changeDisplayOrder(displayOrder);
  }

  private void applyUpdate(WorkType e, UpdateWorkTypeRequest d) {
    e.changeCalculationMethod(d.calculationMethod());
    e.changeCompensationMethod(resolveCompensationMethod(d.compensationMethod()));
    if (d.color() != null) {
      e.changeColor(d.color());
    }
    e.changeIcon(InputSanitizer.trimToNull(d.icon()));
    if (d.calculationMethod() == CalculationMethod.UNIT_BASED
        || d.calculationMethod() == CalculationMethod.UNITS_PER_HOUR_BASED
        || d.calculationMethod() == CalculationMethod.FIXED_PRICE_BASED) {
      e.changeDefaultBreakMinutes(null);
    } else if (d.defaultBreakMinutes() != null) {
      e.changeDefaultBreakMinutes(d.defaultBreakMinutes());
    }
    e.changeTeamworkEnabled(Boolean.TRUE.equals(d.teamworkEnabled()));
    if (d.extraPayEnabled() != null) {
      e.changeExtraPayEnabled(d.extraPayEnabled());
    }
    e.changeCompositeEnabled(Boolean.TRUE.equals(d.compositeEnabled()));
    e.configureUnit(InputSanitizer.trimToNull(d.unitLabel()), InputSanitizer.trimToNull(d.unitSymbol()));
    e.configureFormula(d.unitsPerHour(), d.ratePerUnit(), InputSanitizer.trimToNull(d.currency()));
    if (d.displayOrder() != null) {
      e.changeDisplayOrder(d.displayOrder());
    }
    if (d.active() == null || d.active()) e.activate();
    else e.deactivate();
  }

  private Integer defaultBreakMinutes(UUID userId, CalculationMethod calculationMethod, Integer requested) {
    if (calculationMethod == CalculationMethod.UNIT_BASED
        || calculationMethod == CalculationMethod.UNITS_PER_HOUR_BASED
        || calculationMethod == CalculationMethod.FIXED_PRICE_BASED) {
      return null;
    }
    if (requested != null) {
      return requested;
    }
    return preferences.findByUserId(userId).map(pref -> pref.getDefaultBreakMinutes()).orElse(30);
  }

  private CompensationMethod resolveCompensationMethod(CompensationMethod value) {
    return value == null ? CompensationMethod.HOURLY : value;
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
    if (hasHistoricalUsage(userId, entity.getId())) {
      throw new ConflictException(
          "calculationMethod cannot be changed after work records exist; create a new work type instead");
    }
  }

  private boolean hasHistoricalUsage(UUID userId, UUID workTypeId) {
    return workRecordLines.existsByWorkRecordUserIdAndWorkTypeId(userId, workTypeId);
  }
}
