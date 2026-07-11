package com.roomly.api.worktype.service;

import com.roomly.api.common.exception.*;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.worktype.dto.CreateWorkTypeRequest;
import com.roomly.api.worktype.dto.UpdateWorkTypeRequest;
import com.roomly.api.worktype.dto.WorkTypeDto;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.mapper.WorkTypeMapper;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class WorkTypeService {
  private final WorkTypeRepository repository;
  private final UserAccountRepository users;
  private final WorkTypeMapper mapper;

  @Transactional
  public WorkTypeDto create(UUID userId, @Valid CreateWorkTypeRequest dto) {
    var user =
        users.findById(userId).orElseThrow(() -> new NotFoundException("UserAccount", userId));
    var entity = new WorkType(user, dto.name(), dto.calculationMethod());
    if (repository.existsByUserIdAndNormalizedName(userId, entity.getNormalizedName()))
      throw new ConflictException("WorkType name already exists");
    apply(entity, dto);
    return mapper.toDto(repository.save(entity));
  }

  @Transactional
  public WorkTypeDto update(UUID userId, UUID id, @Valid UpdateWorkTypeRequest dto) {
    var entity = find(userId, id);
    entity.rename(dto.name());
    if (repository.existsByUserIdAndNormalizedNameAndIdNot(userId, entity.getNormalizedName(), id))
      throw new ConflictException("WorkType name already exists");
    apply(entity, dto);
    return mapper.toDto(entity);
  }

  @Transactional
  public void delete(UUID userId, UUID id) {
    find(userId, id).deactivate();
  }

  @Transactional(readOnly = true)
  public WorkTypeDto get(UUID userId, UUID id) {
    return mapper.toDto(find(userId, id));
  }

  @Transactional(readOnly = true)
  public List<WorkTypeDto> list(UUID userId) {
    return repository.findAllByUserIdAndActiveTrueOrderByDisplayOrder(userId).stream()
        .map(mapper::toDto)
        .toList();
  }

  private WorkType find(UUID userId, UUID id) {
    return repository
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("WorkType", id));
  }

  private void apply(WorkType e, CreateWorkTypeRequest d) {
    e.changeColor(d.color());
    e.changeIcon(d.icon());
    e.changeDefaultBreakMinutes(d.defaultBreakMinutes());
    e.changeDisplayOrder(d.displayOrder());
  }

  private void apply(WorkType e, UpdateWorkTypeRequest d) {
    e.changeColor(d.color());
    e.changeIcon(d.icon());
    e.changeDefaultBreakMinutes(d.defaultBreakMinutes());
    e.changeDisplayOrder(d.displayOrder());
    if (d.active()) e.activate();
    else e.deactivate();
  }
}
