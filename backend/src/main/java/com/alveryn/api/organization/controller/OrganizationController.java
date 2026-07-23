package com.alveryn.api.organization.controller;

import com.alveryn.api.common.response.ApiResponse;
import com.alveryn.api.organization.dto.*;
import com.alveryn.api.organization.service.*;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import com.alveryn.api.employment.service.EmploymentService;
import com.alveryn.api.employment.dto.*;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {
  private final OrganizationService organizations;
  private final OrganizationInvitationService invitations;
  private final EmploymentService employments;

  @GetMapping public ApiResponse<List<OrganizationResponse>> list() {
    return ApiResponse.of(organizations.list());
  }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<OrganizationResponse> create(@Valid @RequestBody OrganizationRequest request) {
    return ApiResponse.of(organizations.create(request));
  }
  @PutMapping("/{id}")
  public ApiResponse<OrganizationResponse> update(@PathVariable UUID id,
      @Valid @RequestBody OrganizationRequest request) {
    return ApiResponse.of(organizations.update(id, request));
  }
  @GetMapping("/{id}/members")
  public ApiResponse<List<MemberResponse>> members(@PathVariable UUID id) {
    return ApiResponse.of(organizations.members(id));
  }
  @PutMapping("/{id}/members/{membershipId}/role")
  public ApiResponse<MemberResponse> role(@PathVariable UUID id, @PathVariable UUID membershipId,
      @Valid @RequestBody MemberRoleRequest request) {
    return ApiResponse.of(organizations.changeRole(id, membershipId, request));
  }
  @DeleteMapping("/{id}/members/{membershipId}")
  public ApiResponse<MemberResponse> suspend(@PathVariable UUID id, @PathVariable UUID membershipId) {
    return ApiResponse.of(organizations.suspend(id, membershipId));
  }
  @GetMapping("/{id}/invitations")
  public ApiResponse<List<InvitationResponse>> invitations(@PathVariable UUID id) {
    return ApiResponse.of(invitations.list(id));
  }
  @PostMapping("/{id}/invitations") @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<InvitationResponse> invite(@PathVariable UUID id,
      @Valid @RequestBody InvitationRequest request) {
    return ApiResponse.of(invitations.invite(id, request));
  }
  @DeleteMapping("/{id}/invitations/{invitationId}")
  public ApiResponse<InvitationResponse> revoke(@PathVariable UUID id, @PathVariable UUID invitationId) {
    return ApiResponse.of(invitations.revoke(id, invitationId));
  }
  @PostMapping("/invitations/accept")
  public ApiResponse<OrganizationResponse> accept(@Valid @RequestBody AcceptInvitationRequest request) {
    return ApiResponse.of(invitations.accept(request));
  }
  @GetMapping("/{id}/employments")
  public ApiResponse<List<EmploymentResponse>> employments(@PathVariable UUID id) {
    return ApiResponse.of(employments.listForOrganization(id));
  }
  @PostMapping("/{id}/members/{membershipId}/employments")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<EmploymentResponse> createEmployment(@PathVariable UUID id,
      @PathVariable UUID membershipId, @Valid @RequestBody EmploymentRequest request) {
    return ApiResponse.of(employments.createForMember(id, membershipId, request));
  }
}
