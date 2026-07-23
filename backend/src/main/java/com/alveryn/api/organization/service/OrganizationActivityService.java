package com.alveryn.api.organization.service;
import com.alveryn.api.common.exception.*;
import com.alveryn.api.organization.dto.*;
import com.alveryn.api.organization.entity.OrganizationActivity;
import com.alveryn.api.organization.repository.OrganizationActivityRepository;
import java.text.Normalizer;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class OrganizationActivityService {
  private final OrganizationActivityRepository activities;
  private final OrganizationAccessService access;
  @Transactional(readOnly=true) public List<OrganizationActivityResponse> list(UUID organizationId) {
    access.requireMember(organizationId);
    return activities.findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(organizationId).stream().map(this::response).toList();
  }
  @Transactional public OrganizationActivityResponse create(UUID organizationId, OrganizationActivityRequest request) {
    var manager = access.requireManager(organizationId);
    String normalized = normalize(request.name());
    if (activities.existsByOrganizationIdAndNormalizedName(organizationId, normalized))
      throw new ConflictException("Activity name already exists");
    int order = request.displayOrder() == null
        ? activities.findAllByOrganizationIdOrderByDisplayOrderAscNameAsc(organizationId).size()
        : request.displayOrder();
    var entity = new OrganizationActivity(manager.getOrganization(), request.name(),
        Objects.requireNonNullElse(request.color(), "#87C95A"),
        Objects.requireNonNullElse(request.defaultBreakMinutes(), 0), order);
    return response(activities.save(entity));
  }
  @Transactional public OrganizationActivityResponse update(UUID organizationId, UUID id,
      OrganizationActivityRequest request) {
    access.requireManager(organizationId);
    var entity = require(organizationId, id);
    if (activities.existsByOrganizationIdAndNormalizedNameAndIdNot(organizationId, normalize(request.name()), id))
      throw new ConflictException("Activity name already exists");
    entity.update(request.name(), Objects.requireNonNullElse(request.color(), entity.getColor()),
        Objects.requireNonNullElse(request.defaultBreakMinutes(), entity.getDefaultBreakMinutes()),
        Objects.requireNonNullElse(request.active(), entity.isActive()),
        Objects.requireNonNullElse(request.displayOrder(), entity.getDisplayOrder()));
    return response(entity);
  }
  public OrganizationActivity requireActive(UUID organizationId, UUID id) {
    var value = require(organizationId, id);
    if (!value.isActive()) throw new IllegalArgumentException("activity is inactive");
    return value;
  }
  private OrganizationActivity require(UUID organizationId, UUID id) {
    return activities.findByIdAndOrganizationId(id, organizationId)
        .orElseThrow(() -> new NotFoundException("OrganizationActivity", id));
  }
  private String normalize(String value) {
    return Normalizer.normalize(value.trim(), Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
  }
  private OrganizationActivityResponse response(OrganizationActivity value) {
    return new OrganizationActivityResponse(value.getId(), value.getOrganization().getId(), value.getName(),
        value.getColor(), value.getDefaultBreakMinutes(), value.isActive(), value.getDisplayOrder());
  }
}
