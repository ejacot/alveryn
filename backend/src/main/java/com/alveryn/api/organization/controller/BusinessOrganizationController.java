package com.alveryn.api.organization.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.organization.dto.*;
import com.alveryn.api.organization.service.BusinessOrganizationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class BusinessOrganizationController {
  private final BusinessOrganizationService service;

  @GetMapping
  public ApiResponse<List<OrganizationResponse>> list() { return ApiResponse.of(service.list()); }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<OrganizationResponse> create(
      @Valid @RequestBody CreateBusinessOrganizationRequest request) {
    return ApiResponse.of(service.create(request));
  }

  @GetMapping("/{organizationId}/access")
  public ApiResponse<OrganizationAccessResponse> access(@PathVariable UUID organizationId) {
    return ApiResponse.of(service.access(organizationId));
  }

  @GetMapping("/{organizationId}/units")
  public ApiResponse<List<OrganizationUnitResponse>> listUnits(@PathVariable UUID organizationId) {
    return ApiResponse.of(service.listUnits(organizationId));
  }

  @PostMapping("/{organizationId}/units")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<OrganizationUnitResponse> createUnit(@PathVariable UUID organizationId,
      @Valid @RequestBody CreateOrganizationUnitRequest request) {
    return ApiResponse.of(service.createUnit(organizationId, request));
  }
  @PutMapping("/{organizationId}/units/{unitId}")
  public ApiResponse<OrganizationUnitResponse> updateUnit(@PathVariable UUID organizationId,
      @PathVariable UUID unitId, @Valid @RequestBody CreateOrganizationUnitRequest request) {
    return ApiResponse.of(service.updateUnit(organizationId, unitId, request));
  }
  @DeleteMapping("/{organizationId}/units/{unitId}")
  public ApiResponse<OrganizationUnitResponse> deactivateUnit(@PathVariable UUID organizationId,
      @PathVariable UUID unitId) {
    return ApiResponse.of(service.deactivateUnit(organizationId, unitId));
  }
  @PostMapping("/{organizationId}/units/{unitId}/reactivate")
  public ApiResponse<OrganizationUnitResponse> reactivateUnit(@PathVariable UUID organizationId,
      @PathVariable UUID unitId) {
    return ApiResponse.of(service.reactivateUnit(organizationId, unitId));
  }

  @GetMapping("/{organizationId}/members")
  public ApiResponse<List<OrganizationMemberResponse>> listMembers(@PathVariable UUID organizationId) {
    return ApiResponse.of(service.listMembers(organizationId));
  }

  @PostMapping("/{organizationId}/members")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<OrganizationMemberResponse> createMember(@PathVariable UUID organizationId,
      @Valid @RequestBody CreateOrganizationMemberRequest request) {
    return ApiResponse.of(service.createMember(organizationId, request));
  }
  @PutMapping("/{organizationId}/members/{membershipId}")
  public ApiResponse<OrganizationMemberResponse> updateMember(@PathVariable UUID organizationId,
      @PathVariable UUID membershipId,
      @Valid @RequestBody UpdateOrganizationMemberRequest request) {
    return ApiResponse.of(service.updateMember(organizationId, membershipId, request));
  }
  @PostMapping("/{organizationId}/members/{membershipId}/resend-invitation") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void resendInvitation(@PathVariable UUID organizationId,@PathVariable UUID membershipId,@Valid @RequestBody ResendBusinessInvitationRequest request){service.resendInvitation(organizationId,membershipId,request.language());}
  @DeleteMapping("/{organizationId}/members/{membershipId}")
  public ApiResponse<OrganizationMemberResponse> suspendMember(@PathVariable UUID organizationId,
      @PathVariable UUID membershipId) { return ApiResponse.of(service.suspendMember(organizationId, membershipId)); }
  @PostMapping("/{organizationId}/members/{membershipId}/reactivate")
  public ApiResponse<OrganizationMemberResponse> reactivateMember(@PathVariable UUID organizationId,
      @PathVariable UUID membershipId) { return ApiResponse.of(service.reactivateMember(organizationId, membershipId)); }

  @GetMapping("/{organizationId}/roles")
  public ApiResponse<List<OrganizationRoleResponse>> listRoles(@PathVariable UUID organizationId) {
    return ApiResponse.of(service.listRoles(organizationId));
  }

  @PostMapping("/{organizationId}/roles")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<OrganizationRoleResponse> createRole(@PathVariable UUID organizationId,
      @Valid @RequestBody CreateOrganizationRoleRequest request) {
    return ApiResponse.of(service.createRole(organizationId, request));
  }
  @PutMapping("/{organizationId}/roles/{roleId}")
  public ApiResponse<OrganizationRoleResponse> updateRole(@PathVariable UUID organizationId,
      @PathVariable UUID roleId, @Valid @RequestBody CreateOrganizationRoleRequest request) {
    return ApiResponse.of(service.updateRole(organizationId, roleId, request));
  }
  @DeleteMapping("/{organizationId}/roles/{roleId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteRole(@PathVariable UUID organizationId, @PathVariable UUID roleId) {
    service.deleteRole(organizationId, roleId);
  }

  @GetMapping("/{organizationId}/role-assignments")
  public ApiResponse<List<OrganizationRoleAssignmentResponse>> listRoleAssignments(
      @PathVariable UUID organizationId) {
    return ApiResponse.of(service.listRoleAssignments(organizationId));
  }

  @PostMapping("/{organizationId}/role-assignments")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<OrganizationRoleAssignmentResponse> assignRole(@PathVariable UUID organizationId,
      @Valid @RequestBody AssignOrganizationRoleRequest request) {
    return ApiResponse.of(service.assignRole(organizationId, request));
  }
  @DeleteMapping("/{organizationId}/role-assignments/{assignmentId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void removeRoleAssignment(@PathVariable UUID organizationId,
      @PathVariable UUID assignmentId) {
    service.removeRoleAssignment(organizationId, assignmentId);
  }
}
