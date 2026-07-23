package com.alveryn.api.organization.repository;

import com.alveryn.api.organization.entity.OrganizationInvitation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationInvitationRepository extends JpaRepository<OrganizationInvitation, UUID> {
  Optional<OrganizationInvitation> findByTokenHash(String tokenHash);
  List<OrganizationInvitation> findAllByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
  boolean existsByOrganizationIdAndNormalizedEmailAndAcceptedAtIsNullAndRevokedAtIsNull(UUID organizationId, String email);
}
