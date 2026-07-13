package com.roomly.api.imports;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.JwtService;
import com.roomly.api.imports.entity.ExcelImportBatchStatus;
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
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class ExcelImportIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired ObjectMapper objectMapper;
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
  void previewDoesNotPersistAndConfirmCreatesData() throws Exception {
    UserAccount user = createVerifiedUser("preview@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    MvcResult previewResult =
        mockMvc
            .perform(
                multipart("/api/imports/excel/schedule/preview")
                    .file(workbookFile("Mariana 2025.xlsx", createWorkbookBytes("09:00-17:30", "Liste+CH")))
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.detectedYear").value(2025))
            .andExpect(jsonPath("$.data.totals.workEntries").value(1))
            .andExpect(jsonPath("$.data.totals.absences").value(1))
            .andExpect(jsonPath("$.data.canImport").value(true))
            .andReturn();

    assertThat(workEntries.findAll()).isEmpty();
    assertThat(absences.findAll()).isEmpty();
    assertThat(workTypes.findAll()).isEmpty();
    assertThat(importBatches.findAll()).hasSize(1);
    assertThat(importBatches.findAll().getFirst().getStatus()).isEqualTo(ExcelImportBatchStatus.PREVIEWED);

    String previewToken = objectMapper.readTree(previewResult.getResponse().getContentAsString()).at("/data/previewToken").asText();

    mockMvc
        .perform(
            post("/api/imports/excel/schedule/confirm")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(Map.of("previewToken", previewToken))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.detectedYear").value(2025))
        .andExpect(jsonPath("$.data.importedEntries").value(1))
        .andExpect(jsonPath("$.data.importedAbsences").value(1));

    assertThat(workEntries.findAll()).hasSize(1);
    assertThat(workEntries.findAll().getFirst().getCalculatedMinutes()).isEqualByComparingTo("510.000000000000000");
    assertThat(workEntries.findAll().getFirst().getImportBatch()).isNotNull();
    assertThat(timeEntryDetails.findAll()).hasSize(1);
    assertThat(absences.findAll()).hasSize(1);
    assertThat(absences.findAll().getFirst().getImportBatch()).isNotNull();
    assertThat(workTypes.findAll()).hasSize(1);
    assertThat(importBatches.findAll().getFirst().getStatus()).isEqualTo(ExcelImportBatchStatus.COMPLETED);
  }

  @Test
  void previewMarksSemanticDuplicateForModifiedBinaryCopy() throws Exception {
    UserAccount user = createVerifiedUser("duplicate@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    String previewToken = previewToken(user, createWorkbookBytes("09:00-17:30", "Liste+CH"));
    confirm(user, previewToken);

    mockMvc
        .perform(
            multipart("/api/imports/excel/schedule/preview")
                .file(workbookFile("Mariana 2025 copy.xlsx", createWorkbookBytes("09:00-17:30", "Liste+CH")))
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.canImport").value(false))
        .andExpect(jsonPath("$.data.duplicateCandidates[0].type").value("WORK_ENTRY"));
  }

  @Test
  void previewBlocksChangedImportedRowConflict() throws Exception {
    UserAccount user = createVerifiedUser("changed@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    String previewToken = previewToken(user, createWorkbookBytes("09:00-17:30", "Liste+CH"));
    confirm(user, previewToken);

    mockMvc
        .perform(
            multipart("/api/imports/excel/schedule/preview")
                .file(workbookFile("Mariana 2025 revised.xlsx", createWorkbookBytes("10:00-18:00", "Liste+CH")))
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.canImport").value(false))
        .andExpect(jsonPath("$.data.conflicts[0].code").value("EXCEL_IMPORT_CONFLICT"));
  }

  @Test
  void historyAndUndoWorkPerBatch() throws Exception {
    UserAccount user = createVerifiedUser("undo@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    String previewToken = previewToken(user, createWorkbookBytes("09:00-17:30", "Liste+CH"));
    confirm(user, previewToken);
    var batch = importBatches.findAll().getFirst();

    mockMvc
        .perform(get("/api/imports/excel/schedule").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].status").value("COMPLETED"));

    mockMvc
        .perform(post("/api/imports/excel/schedule/{batchId}/undo", batch.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("UNDONE"));

    assertThat(workEntries.findAll()).isEmpty();
    assertThat(absences.findAll()).isEmpty();
    assertThat(importBatches.findAll().getFirst().getStatus()).isEqualTo(ExcelImportBatchStatus.UNDONE);
  }

  @Test
  void previewRejectsWorkbookWithoutSupportedSheets() throws Exception {
    UserAccount user = createVerifiedUser("ignored@example.com");

    mockMvc
        .perform(
            multipart("/api/imports/excel/schedule/preview")
                .file(workbookFile("Mariana 2025.xlsx", workbookWithSingleSheet("Overview")))
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("EXCEL_NO_SUPPORTED_SHEETS"));
  }

  private String previewToken(UserAccount user, byte[] workbookBytes) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                multipart("/api/imports/excel/schedule/preview")
                    .file(workbookFile("Mariana 2025.xlsx", workbookBytes))
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).at("/data/previewToken").asText();
  }

  private void confirm(UserAccount user, String previewToken) throws Exception {
    mockMvc
        .perform(
            post("/api/imports/excel/schedule/confirm")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(Map.of("previewToken", previewToken))))
        .andExpect(status().isCreated());
  }

  private MockMultipartFile workbookFile(String fileName, byte[] bytes) {
    return new MockMultipartFile(
        "file",
        fileName,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes);
  }

  private byte[] createWorkbookBytes(String shiftRange, String noteText) throws Exception {
    try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Januar");
      var header = sheet.createRow(0);
      header.createCell(5).setCellValue("CH");
      header.createCell(10).setCellValue("Frei");
      header.createCell(1).setCellValue("2025");

      var secondHeader = sheet.createRow(1);
      secondHeader.createCell(1).setCellValue("Normal");

      var workRow = sheet.createRow(2);
      workRow.createCell(0).setCellValue(1);
      workRow.createCell(5).setCellValue(8);
      workRow.createCell(16).setCellValue(shiftRange);
      workRow.createCell(17).setCellValue(noteText);

      var absenceRow = sheet.createRow(3);
      absenceRow.createCell(0).setCellValue(2);
      absenceRow.createCell(10).setCellValue("U");

      workbook.write(output);
      return output.toByteArray();
    }
  }

  private byte[] workbookWithSingleSheet(String sheetName) throws Exception {
    try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      workbook.createSheet(sheetName);
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
