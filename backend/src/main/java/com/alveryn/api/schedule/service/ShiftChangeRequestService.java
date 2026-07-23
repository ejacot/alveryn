package com.alveryn.api.schedule.service;
import com.alveryn.api.common.exception.*;
import com.alveryn.api.organization.entity.MembershipRole;
import com.alveryn.api.organization.service.OrganizationAccessService;
import com.alveryn.api.schedule.dto.*;
import com.alveryn.api.schedule.entity.*;
import com.alveryn.api.schedule.repository.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class ShiftChangeRequestService {
  private final OrganizationAccessService access;
  private final ShiftAssignmentRepository assignments;
  private final ShiftChangeRequestRepository requests;

  @Transactional
  public ShiftChangeRequestResponse create(UUID organizationId, UUID assignmentId,
      ShiftChangeRequestPayload payload) {
    var member=access.requireMember(organizationId);
    var assignment=assignments.findByIdAndOrganizationId(assignmentId,organizationId)
        .filter(value->value.getWorker().getId().equals(member.getId()))
        .orElseThrow(()->new NotFoundException("ShiftAssignment",assignmentId));
    if (assignment.getShift().getStatus() == ShiftStatus.DRAFT)
      throw new NotFoundException("ShiftAssignment", assignmentId);
    if(requests.existsByAssignmentIdAndStatus(assignmentId,ShiftChangeRequestStatus.PENDING))
      throw new ConflictException("A request is already pending for this shift");
    OffsetDateTime start=null,end=null;
    if(payload.type()==ShiftChangeRequestType.TIME_CHANGE){
      if(payload.date()==null||payload.startTime()==null||payload.endTime()==null)
        throw new IllegalArgumentException("date, startTime and endTime are required");
      ZoneId zone=ZoneId.of(assignment.getShift().getTimezone());
      start=ZonedDateTime.of(payload.date(),payload.startTime(),zone).toOffsetDateTime();
      end=ZonedDateTime.of(payload.date(),payload.endTime(),zone).toOffsetDateTime();
      if(!end.isAfter(start)) throw new IllegalArgumentException("endTime must be after startTime");
      if(assignments.hasOverlapExcluding(member.getId(),assignmentId,start,end))
        throw new ConflictException("Employee already has an overlapping shift");
    }
    return response(requests.save(new ShiftChangeRequest(assignment,member,payload.type(),start,end,payload.reason())));
  }
  @Transactional(readOnly=true)
  public List<ShiftChangeRequestResponse> list(UUID organizationId) {
    var member=access.requireMember(organizationId);
    var values=requests.findOrganization(organizationId);
    if(member.getRole()==MembershipRole.EMPLOYEE)
      values=values.stream().filter(value->value.getRequestedBy().getId().equals(member.getId())).toList();
    return values.stream().map(this::response).toList();
  }
  @Transactional
  public ShiftChangeRequestResponse decide(UUID organizationId,UUID requestId,boolean approved){
    var manager=access.requireManager(organizationId);
    var request=requests.findOwned(requestId,organizationId)
        .orElseThrow(()->new NotFoundException("ShiftChangeRequest",requestId));
    request.decide(approved,manager,OffsetDateTime.now());
    if(approved){
      if(request.getType()==ShiftChangeRequestType.TIME_CHANGE)
      {
        if(assignments.hasOverlapExcluding(request.getAssignment().getWorker().getId(),
            request.getAssignment().getId(),request.getProposedStart(),request.getProposedEnd()))
          throw new ConflictException("Employee already has an overlapping shift");
        request.getAssignment().getShift().override(request.getProposedStart(),request.getProposedEnd());
      }
      else if(request.getType()==ShiftChangeRequestType.DROP||request.getType()==ShiftChangeRequestType.ABSENCE){
        request.getAssignment().cancel(); request.getAssignment().getShift().cancel();
      }
    }
    return response(request);
  }
  @Transactional
  public void cancel(UUID organizationId,UUID requestId){
    var member=access.requireMember(organizationId);
    var request=requests.findOwned(requestId,organizationId)
        .filter(value->value.getRequestedBy().getId().equals(member.getId()))
        .orElseThrow(()->new NotFoundException("ShiftChangeRequest",requestId));
    request.cancel();
  }
  private ShiftChangeRequestResponse response(ShiftChangeRequest value){
    var shift=value.getAssignment().getShift();
    return new ShiftChangeRequestResponse(value.getId(),value.getAssignment().getId(),
        value.getAssignment().getWorker().getUser().getEmail(),value.getType(),value.getStatus(),
        shift.getStartsAt(),shift.getEndsAt(),value.getProposedStart(),value.getProposedEnd(),
        value.getReason(),value.getDecidedAt());
  }
}
