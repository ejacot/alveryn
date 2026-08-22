package com.alveryn.api.testsupport;

import static org.assertj.core.api.Assertions.assertThat;

import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.repository.OrganizationRepository;
import com.alveryn.api.user.entity.EmploymentType;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class IntegrationTestDatabaseCleanerIntegrationTest {
  @Autowired JdbcTemplate jdbc;
  @Autowired UserAccountRepository users;
  @Autowired OrganizationRepository organizations;
  @Autowired EmploymentRepository employments;

  @BeforeEach
  void setUp() {
    IntegrationTestDatabaseCleaner.cleanWorkspaceData(jdbc);
  }

  @Test
  void cleansAnOrganizationThatIsReferencedByAnEmployment() {
    UserAccount user = users.saveAndFlush(new UserAccount("cleanup-regression@example.com", "hash"));
    Organization organization =
        organizations.saveAndFlush(new Organization(user, "Personal workspace", "Europe/Berlin"));
    Employment employment = new Employment(organization, user, "Main job");
    employment.configure(
        EmploymentType.FULL_TIME,
        CompensationType.HOURLY,
        LocalDate.of(2026, 1, 1),
        null,
        null,
        "EUR",
        null,
        null,
        true,
        0);
    employments.saveAndFlush(employment);

    IntegrationTestDatabaseCleaner.cleanWorkspaceData(jdbc);

    assertThat(employments.count()).isZero();
    assertThat(organizations.count()).isZero();
    assertThat(users.count()).isZero();
  }
}
