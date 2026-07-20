package com.alveryn.api.workproject.service;

import com.alveryn.api.address.repository.AddressRepository;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.*;
import com.alveryn.api.employment.service.EmploymentService;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workproject.dto.*;
import com.alveryn.api.workproject.entity.*;
import com.alveryn.api.workproject.repository.WorkProjectRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class WorkProjectService {
  private final WorkProjectRepository projects; private final WorkRecordRepository sessions;
  private final UserAccountRepository users; private final AddressRepository addresses;
  private final EmploymentService employments; private final AuthenticatedUserAccessor authenticated;
  @Transactional(readOnly=true) public List<WorkProjectResponse> list() { return projects.findAllByUserIdOrderByStartDateDescCreatedAtDesc(authenticated.requireUserId()).stream().map(this::response).toList(); }
  @Transactional(readOnly=true) public WorkProjectResponse get(UUID id) { return response(requireOwned(id)); }
  @Transactional public WorkProjectResponse create(WorkProjectRequest request) {
    UUID uid=authenticated.requireUserId(); var user=users.findById(uid).orElseThrow(() -> new NotFoundException("User",uid));
    var employment=employments.requireOwned(request.employmentId());
    var project=new WorkProject(user,employment,request.title(),request.startDate()); configure(project,request,uid); return response(projects.save(project));
  }
  @Transactional public WorkProjectResponse update(UUID id, WorkProjectRequest request) {
    var project=requireOwned(id); if (!project.getEmployment().getId().equals(request.employmentId())) throw new ValidationException("project employment cannot be changed");
    configure(project,request,authenticated.requireUserId()); return response(project);
  }
  @Transactional public void delete(UUID id) { var project=requireOwned(id); if (sessions.existsByProjectId(id)) throw new ValidationException("project with work sessions must be archived"); projects.delete(project); }
  public WorkProject requireOwned(UUID id) { UUID uid=authenticated.requireUserId(); return projects.findByIdAndUserId(id,uid).orElseThrow(() -> new NotFoundException("WorkProject",id)); }
  private void configure(WorkProject p,WorkProjectRequest r,UUID uid) { var address=r.addressId()==null?null:addresses.findByIdAndUserId(r.addressId(),uid).orElseThrow(() -> new NotFoundException("Address",r.addressId())); p.update(r.title(),r.description(),r.clientName(),r.reference(),r.startDate(),r.endDate(),r.status()==null?WorkProjectStatus.ACTIVE:r.status(),r.notes(),address); }
  private WorkProjectResponse response(WorkProject p) { return new WorkProjectResponse(p.getId(),p.getEmployment().getId(),p.getEmployment().getName(),p.getTitle(),p.getDescription(),p.getClientName(),p.getReference(),p.getStartDate(),p.getEndDate(),p.getStatus(),p.getNotes(),p.getAddress()==null?null:p.getAddress().getId(),sessions.countByProjectId(p.getId())); }
}
