package com.roomly.api.imports;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.springframework.dao.DataIntegrityViolationException;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.jdbc.core.JdbcTemplate;
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
  @Autowired JdbcTemplate jdbcTemplate;

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
  void concurrentConfirmClaimsPreviewOnlyOnce() throws Exception {
    UserAccount user = createVerifiedUser("concurrent@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    String previewToken = previewToken(user, createWorkbookBytes("09:00-17:30", "Liste+CH"));
    Callable<Integer> confirmCall = () -> confirmStatus(user, previewToken);

    try (var executor = Executors.newFixedThreadPool(2)) {
      var results = executor.invokeAll(List.of(confirmCall, confirmCall));
      executor.shutdown();
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

      assertThat(results).extracting(result -> result.get()).containsExactlyInAnyOrder(201, 409);
    }

    assertThat(importBatches.findAll()).hasSize(1);
    assertThat(importBatches.findAll().getFirst().getStatus()).isEqualTo(ExcelImportBatchStatus.COMPLETED);
    assertThat(workEntries.findAll()).hasSize(1);
    assertThat(absences.findAll()).hasSize(1);
    assertThat(workTypes.findAll()).hasSize(1);

    assertThat(confirmStatus(user, previewToken)).isEqualTo(409);
  }

  @Test
  void confirmRejectsExpiredPreviewAndForeignToken() throws Exception {
    UserAccount owner = createVerifiedUser("owner@example.com");
    UserAccount other = createVerifiedUser("other@example.com");
    createRate(owner, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);
    createRate(other, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    String previewToken = previewToken(owner, createWorkbookBytes("09:00-17:30", "Liste+CH"));
    assertThat(confirmStatus(other, previewToken)).isEqualTo(409);

    jdbcTemplate.update("update excel_import_batches set preview_expires_at = now() - interval '1 minute'");
    assertThat(confirmStatus(owner, previewToken)).isEqualTo(409);
    assertThat(workEntries.findAll()).isEmpty();
    assertThat(absences.findAll()).isEmpty();
  }

  @Test
  void databaseRejectsDuplicateImportedWorkEntrySourceKey() throws Exception {
    UserAccount user = createVerifiedUser("unique-source@example.com");
    createRate(user, "20.00", "EUR", LocalDate.of(2025, 1, 1), null);

    String previewToken = previewToken(user, createWorkbookBytes("09:00-17:30", "Liste+CH"));
    confirm(user, previewToken);

    var existing = workEntries.findAll().getFirst();
    var workType = workTypes.findById(existing.getWorkType().getId()).orElseThrow();
    var duplicate =
        new WorkEntry(
            user,
            workType,
            LocalDate.of(2025, 1, 3),
            new BigDecimal("20.00"),
            "EUR",
            60);
    duplicate.markImported(
        importBatches.findAll().getFirst(),
        existing.getImportSourceKey(),
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

    assertThatThrownBy(() -> workEntries.saveAndFlush(duplicate))
        .isInstanceOf(DataIntegrityViolationException.class);
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

  private int confirmStatus(UserAccount user, String previewToken) throws Exception {
    return mockMvc
        .perform(
            post("/api/imports/excel/schedule/confirm")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(Map.of("previewToken", previewToken))))
        .andReturn()
        .getResponse()
        .getStatus();
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
