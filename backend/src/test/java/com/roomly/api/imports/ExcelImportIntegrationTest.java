package com.roomly.api.imports;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.JwtService;
import com.roomly.api.imports.repository.ExcelImportBatchRepository;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import com.roomly.api.salary.repository.HourlyRatePeriodRepository;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class ExcelImportIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeRepository workTypes;
  @Autowired WorkEntryRepository workEntries;
  @Autowired TimeEntryDetailsRepository timeEntryDetails;
  @Autowired AbsenceRepository absences;
  @Autowired HourlyRatePeriodRepository hourlyRates;
  @Autowired ExcelImportBatchRepository importBatches;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    timeEntryDetails.deleteAll();
    workEntries.deleteAll();
    absences.deleteAll();
    workTypes.deleteAll();
    hourlyRates.deleteAll();
    importBatches.deleteAll();
    users.deleteAll();
  }

  @Test
  void importsWorkbookIntoWorkEntriesAndAbsences() throws Exception {
    UserAccount user = createVerifiedUser("import@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    MockMultipartFile workbook =
        new MockMultipartFile(
            "file",
            "Mariana 2025.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            createWorkbookBytes());

    mockMvc
        .perform(
            multipart("/api/imports/excel/schedule")
                .file(workbook)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.MULTIPART_FORM_DATA))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.detectedYear").value(2025))
        .andExpect(jsonPath("$.data.workTypeName").value("Imported Shift"))
        .andExpect(jsonPath("$.data.importedEntries").value(1))
        .andExpect(jsonPath("$.data.importedAbsences").value(1))
        .andExpect(jsonPath("$.data.createdWorkTypes").value(1));

    assertThat(workEntries.findAll()).hasSize(1);
    assertThat(workEntries.findAll().getFirst().getCalculatedMinutes())
        .isEqualByComparingTo("510.000000000000000");
    assertThat(workEntries.findAll().getFirst().getNotes()).contains("Breakdown: CH=8");
    assertThat(timeEntryDetails.findAll()).hasSize(1);
    assertThat(absences.findAll()).hasSize(1);
    assertThat(importBatches.findAll()).hasSize(1);
  }

  @Test
  void rejectsReimportingTheSameWorkbookHash() throws Exception {
    UserAccount user = createVerifiedUser("repeat@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);
    byte[] workbookBytes = createWorkbookBytes();

    MockMultipartFile workbook =
        new MockMultipartFile(
            "file",
            "Mariana 2025.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            workbookBytes);

    mockMvc
        .perform(
            multipart("/api/imports/excel/schedule")
                .file(workbook)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            multipart("/api/imports/excel/schedule")
                .file(
                    new MockMultipartFile(
                        "file",
                        "Mariana 2025.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        workbookBytes))
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isConflict());
  }

  private byte[] createWorkbookBytes() throws Exception {
    try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Januar");
      var header = sheet.createRow(0);
      header.createCell(5).setCellValue("CH");
      header.createCell(10).setCellValue("Frei");

      var secondHeader = sheet.createRow(1);
      secondHeader.createCell(1).setCellValue("Normal");

      var workRow = sheet.createRow(2);
      workRow.createCell(0).setCellValue(1);
      workRow.createCell(5).setCellValue(8);
      workRow.createCell(16).setCellValue("09:00-17:30");
      workRow.createCell(17).setCellValue("Liste+CH");

      var absenceRow = sheet.createRow(3);
      absenceRow.createCell(0).setCellValue(2);
      absenceRow.createCell(10).setCellValue("U");

      workbook.write(output);
      return output.toByteArray();
    }
  }

  private UserAccount createVerifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private HourlyRatePeriod createRate(
      UserAccount user, String rate, String currency, LocalDate validFrom, LocalDate validTo) {
    return hourlyRates.saveAndFlush(
        new HourlyRatePeriod(user, new BigDecimal(rate), currency, validFrom, validTo));
  }

  private String bearerToken(UserAccount user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }
}
