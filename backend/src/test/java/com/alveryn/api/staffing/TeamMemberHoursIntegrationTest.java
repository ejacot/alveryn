package com.alveryn.api.staffing;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.testsupport.IntegrationTestDatabaseCleaner;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class TeamMemberHoursIntegrationTest {
  @Autowired WebApplicationContext context; @Autowired JwtService jwt; @Autowired UserAccountRepository users; @Autowired JdbcTemplate jdbc;
  MockMvc mvc; UserAccount owner;
  @BeforeEach void setup() { mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build(); IntegrationTestDatabaseCleaner.cleanWorkspaceData(jdbc); owner=verified("hours-owner@example.com"); }

  @Test void reportsServerCalculatedNetHoursAndRejectsUnprivilegedOrInvalidReads() throws Exception {
    String org=create("/api/organizations", "{\"name\":\"Hours\",\"timezone\":\"Europe/Berlin\"}");
    String unit=create("/api/organizations/"+org+"/units", "{\"name\":\"Berlin\",\"type\":\"LOCATION\",\"checkInMode\":\"OPTIONAL\"}");
    String member=create("/api/organizations/"+org+"/members", "{\"firstName\":\"Ana\",\"lastName\":\"Worker\"}");
    UserAccount employee=verified("hours-employee@example.com");
    jdbc.update("update organization_memberships set membership_status='ACTIVE', user_id=? where id=?::uuid", employee.getId(), member);
    String type=create("/api/organizations/"+org+"/staffing/work-types", "{\"unitId\":\""+unit+"\",\"code\":\"NIGHT\",\"name\":\"Night\",\"color\":\"#10B981\",\"defaultStartTime\":\"22:00\",\"defaultEndTime\":\"02:00\",\"defaultBreakMinutes\":30}");
    String requirement=create("/api/organizations/"+org+"/staffing/requirements", "{\"unitId\":\""+unit+"\",\"workTypeId\":\""+type+"\",\"date\":\"2026-08-30\",\"startTime\":\"22:00\",\"endTime\":\"02:00\",\"requiredWorkers\":1}");
    String assignment=id(mvc.perform(post("/api/organizations/{org}/staffing/requirements/{requirement}/assignments",org,requirement).header(HttpHeaders.AUTHORIZATION,token(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"membershipId\":\""+member+"\"}")) .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "assignments[0].id");
    jdbc.update("insert into staffing_assignment_results(id,assignment_id,actual_start_time,actual_end_time,break_minutes,approval_status,reviewed_at,time_capture_source,created_at,updated_at) values(?,?::uuid,'22:00','02:00',30,'APPROVED',current_timestamp,'MANUAL',current_timestamp,current_timestamp)", UUID.randomUUID(), assignment);
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",org,member).param("from","2026-08-30").param("to","2026-08-31").header(HttpHeaders.AUTHORIZATION,token(owner)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.plannedMinutes").value(210)).andExpect(jsonPath("$.data.workedMinutes").value(210)).andExpect(jsonPath("$.data.days[0].correctedSessions").value(1)).andExpect(jsonPath("$.data.days[0].openSessions").value(0)).andExpect(jsonPath("$.data.weeks[0].workedMinutes").value(210)).andExpect(jsonPath("$.data.months[0].workedMinutes").value(210));
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",org,member).param("from","2026-08-31").param("to","2026-08-30").header(HttpHeaders.AUTHORIZATION,token(owner))).andExpect(status().isBadRequest());
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",org,member).param("from","2026-01-01").param("to","2027-01-03").header(HttpHeaders.AUTHORIZATION,token(owner))).andExpect(status().isBadRequest());
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",org,member).param("from","2026-08-30").param("to","2026-08-31").header(HttpHeaders.AUTHORIZATION,token(employee))).andExpect(status().isForbidden());
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",UUID.randomUUID(),member).param("from","2026-08-30").param("to","2026-08-31").header(HttpHeaders.AUTHORIZATION,token(owner))).andExpect(status().isNotFound());
  }

  @Test void scopesViewerToAuthorizedUnitAndRejectsInvitedOrInactiveActors() throws Exception {
    String org=create("/api/organizations", "{\"name\":\"Scoped\",\"timezone\":\"Europe/Berlin\"}");
    String unitA=create("/api/organizations/"+org+"/units", "{\"name\":\"A\",\"type\":\"LOCATION\",\"checkInMode\":\"OPTIONAL\"}");
    String unitB=create("/api/organizations/"+org+"/units", "{\"name\":\"B\",\"type\":\"LOCATION\",\"checkInMode\":\"OPTIONAL\"}");
    String target=create("/api/organizations/"+org+"/members", "{\"firstName\":\"B\",\"lastName\":\"Worker\"}");
    jdbc.update("update organization_memberships set membership_status='ACTIVE' where id=?::uuid",target);
    String type=create("/api/organizations/"+org+"/staffing/work-types", "{\"unitId\":\""+unitB+"\",\"code\":\"B\",\"name\":\"B\",\"color\":\"#10B981\",\"defaultStartTime\":\"09:00\",\"defaultEndTime\":\"17:00\",\"defaultBreakMinutes\":30}");
    String req=create("/api/organizations/"+org+"/staffing/requirements", "{\"unitId\":\""+unitB+"\",\"workTypeId\":\""+type+"\",\"date\":\"2026-08-10\",\"requiredWorkers\":1}");
    mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments",org,req).header(HttpHeaders.AUTHORIZATION,token(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"membershipId\":\""+target+"\"}")).andExpect(status().isCreated());
    UserAccount viewer=verified("unit-viewer@example.com"); String viewerMembership=create("/api/organizations/"+org+"/members", "{\"firstName\":\"Viewer\",\"lastName\":\"A\"}");
    jdbc.update("update organization_memberships set membership_status='ACTIVE', user_id=? where id=?::uuid",viewer.getId(),viewerMembership);
    UUID role=UUID.randomUUID(); jdbc.update("insert into organization_roles(id,organization_id,name,permissions,system_role,created_at,updated_at) values(?,?::uuid,'Hours',array['VIEW_TEAM_HOURS'],false,current_timestamp,current_timestamp)",role,org);
    jdbc.update("insert into organization_role_assignments(id,membership_id,role_id,unit_id,include_descendants,created_at,updated_at) values(?,?::uuid,?,?::uuid,true,current_timestamp,current_timestamp)",UUID.randomUUID(),viewerMembership,role,unitA);
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",org,target).param("from","2026-08-10").param("to","2026-08-10").header(HttpHeaders.AUTHORIZATION,token(viewer))).andExpect(status().isNotFound());
    jdbc.update("update organization_memberships set membership_status='INVITED' where id=?::uuid",viewerMembership);
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",org,target).param("from","2026-08-10").param("to","2026-08-10").header(HttpHeaders.AUTHORIZATION,token(viewer))).andExpect(status().isNotFound());
    jdbc.update("update organization_memberships set membership_status='SUSPENDED' where id=?::uuid",viewerMembership);
    mvc.perform(get("/api/organizations/{org}/staffing/members/{member}/hours",org,target).param("from","2026-08-10").param("to","2026-08-10").header(HttpHeaders.AUTHORIZATION,token(viewer))).andExpect(status().isNotFound());
  }

  private UserAccount verified(String email){var user=new UserAccount(email,"hash");user.verifyEmail();return users.saveAndFlush(user);}
  private String create(String path,String body)throws Exception{return id(mvc.perform(post(path).header(HttpHeaders.AUTHORIZATION,token(owner)).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),"id");}
  private String id(String body,String path){Object value=com.jayway.jsonpath.JsonPath.read(body,"$.data."+path);return String.valueOf(value);}
  private String token(UserAccount user){return "Bearer "+jwt.generateAccessToken(user);}
}
