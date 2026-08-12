package com.alveryn.api.dataimport.service;

import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.dataimport.intelligence.ImportIntelligenceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Slf4j
public class PayrollDocumentAnalyzer {
  private static final int MAX_DOCUMENTS = 12;
  private static final int MAX_PAGES = 18;
  private static final long MAX_TOTAL_SIZE = 40L * 1024 * 1024;
  private static final long MAX_MONTHLY_SIZE = 15L * 1024 * 1024;
  private static final Semaphore MONTHLY_SCAN_SLOT = new Semaphore(1, true);

  private final ObjectMapper objectMapper;
  private final ImportIntelligenceService intelligence;
  private volatile String availableOcrLanguages;

  public ObjectNode analyze(List<MultipartFile> files, ArrayNode candidates) {
    ObjectNode result = objectMapper.createObjectNode();
    ArrayNode documents = result.putArray("documents");
    ArrayNode findings = result.putArray("findings");
    if (files == null || files.isEmpty()) {
      result.put("status", "NOT_PROVIDED");
      return result;
    }
    if (files.size() > MAX_DOCUMENTS) {
      throw new IllegalArgumentException("Upload at most 12 payroll documents");
    }
    long totalSize = files.stream().mapToLong(MultipartFile::getSize).sum();
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new IllegalArgumentException("Payroll documents are too large");
    }

    int pageCount = 0;
    boolean usedVision = false;
    try {
      for (MultipartFile file : files) {
        validate(file);
        byte[] bytes = file.getBytes();
        try (PDDocument pdf = Loader.loadPDF(bytes)) {
          pageCount += pdf.getNumberOfPages();
          if (pageCount > MAX_PAGES) {
            throw new IllegalArgumentException("Upload at most 18 payroll pages at once");
          }
          String text = new PDFTextStripper().getText(pdf).trim();
          ObjectNode document = documents.addObject()
              .put("filename", safeFilename(file.getOriginalFilename()))
              .put("pages", pdf.getNumberOfPages())
              .put("source", text.length() >= 80 ? "DIGITAL_TEXT" : "VISION");
          ObjectNode evidence;
          if (text.length() >= 80) {
            evidence = intelligence.analyzePayrollText(text, candidates);
          } else {
            usedVision = true;
            evidence = analyzeRenderedPages(pdf, candidates);
          }
          evidence.path("findings").forEach(findings::add);
          document.put("status", evidence.path("status").asText("FALLBACK"));
        }
      }
      result.put("status", findings.isEmpty() ? "REVIEW_NEEDED" : "COMPLETED");
      result.put("usedVision", usedVision);
      result.put("pageCount", pageCount);
      return result;
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not read the payroll PDF", exception);
    }
  }

  public ObjectNode analyzeMonthly(MultipartFile file, int year, int month) {
    boolean acquired = false;
    try {
      acquired = MONTHLY_SCAN_SLOT.tryAcquire(5, TimeUnit.SECONDS);
      if (!acquired) {
        throw new ValidationException(
            "Another payroll document is being scanned. Try again in a moment",
            "PAYROLL_SCAN_BUSY");
      }
      return analyzeMonthlyInScanSlot(file, year, month);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new ValidationException(
          "Payroll scanning was interrupted. Try again", "PAYROLL_SCAN_INTERRUPTED");
    } finally {
      if (acquired) MONTHLY_SCAN_SLOT.release();
    }
  }

  private ObjectNode analyzeMonthlyInScanSlot(MultipartFile file, int year, int month) {
    String contentType = validateMonthly(file);
    if (file.getSize() > MAX_MONTHLY_SIZE) {
      throw new IllegalArgumentException("Payroll document exceeds the 15 MB limit");
    }
    try {
      List<String> images;
      List<String> ocrTexts;
      if (contentType.equals("application/pdf")) {
        try (PDDocument pdf = Loader.loadPDF(file.getBytes())) {
          if (pdf.getNumberOfPages() > MAX_PAGES) {
            throw new IllegalArgumentException("Payroll document contains too many pages");
          }
          // A single-page upload is already an explicit choice for the active Calendar
          // month. Scanned PDFs often have no searchable text, so analyze that page and
          // let the vision result validate (or infer) the printed period.
          Integer pageIndex = pdf.getNumberOfPages() == 1 ? 0 : findMonthlyPage(pdf, year, month);
          if (pageIndex == null) {
            pageIndex = monthlyPageFromFilename(
                safeFilename(file.getOriginalFilename()), month, pdf.getNumberOfPages());
          }
          if (pageIndex == null) {
            throw new ValidationException(
                "Could not identify the requested month in this PDF. "
                    + "Upload a photo or PDF containing only that month's page",
                "PAYROLL_MONTH_NOT_FOUND");
          }
          log.info("Payroll reconciliation selected PDF page {} of {} for {}-{} ({})",
              pageIndex + 1, pdf.getNumberOfPages(), year, month,
              safeFilename(file.getOriginalFilename()));
          images = List.of(renderPage(pdf, pageIndex, 180));
          String nativeText = extractPageText(pdf, pageIndex);
          String ocrText = extractPageTextWithOcr(pdf, pageIndex);
          ocrTexts = List.of(combineTextEvidence(nativeText, ocrText));
        }
      } else {
        byte[] sourceBytes = file.getBytes();
        boolean directlySupported = Set.of(
            "image/jpeg", "image/png", "image/webp").contains(contentType);
        boolean lowMemoryMode = Boolean.parseBoolean(
            System.getenv().getOrDefault("PAYROLL_LOW_MEMORY_MODE", "false"));
        // A 512 MB service cannot safely hold the request while also spawning ImageMagick and
        // multilingual Tesseract. Modern vision models read ordinary camera formats directly;
        // retain conversion for HEIC/RAW and richer OCR evidence on larger instances.
        byte[] imageBytes = lowMemoryMode && directlySupported
            ? sourceBytes : normalizePayrollImage(sourceBytes, contentType);
        if (!(lowMemoryMode && directlySupported)) contentType = "image/jpeg";
        images = List.of("data:" + contentType + ";base64,"
            + Base64.getEncoder().encodeToString(imageBytes));
        ocrTexts = lowMemoryMode && directlySupported
            ? List.of("") : List.of(extractImageTextWithOcr(imageBytes));
      }
      ObjectNode result = intelligence.analyzeMonthlyPayrollImages(
          images, ocrTexts, year, month);
      ObjectNode deterministic = new PayrollOcrParser(objectMapper)
          .parse(String.join("\n", ocrTexts), year, month);
      if (!hasPayrollValues(result) && hasPayrollValues(deterministic)) {
        result = deterministic;
      } else if (hasPayrollValues(result)) {
        mergeMissingEvidence(result, deterministic);
      }
      log.info(
          "Payroll reconciliation result status={}, period={}-{}, sourcePage={}, "
              + "normalHoursPresent={}, absenceHoursPresent={}, extraHoursPresent={}, "
              + "grossPresent={}",
          result.path("status").asText("UNKNOWN"),
          result.path("year").isNumber() ? result.path("year").asText() : "null",
          result.path("month").isNumber() ? result.path("month").asText() : "null",
          result.path("sourcePage").asText("null"),
          result.path("normalHours").isNumber(),
          result.path("absenceHours").isNumber(),
          result.path("extraHours").isNumber(),
          result.path("grossAmount").isNumber());
      if ("FALLBACK".equals(result.path("status").asText())
          || "DISABLED".equals(result.path("status").asText())) {
        throw new ValidationException(
            "No payroll values could be read. Try a clearer photo of the relevant table",
            "PAYROLL_DOCUMENT_UNREADABLE");
      }
      result.put("filename", safeFilename(file.getOriginalFilename()));
      result.put("localOcrUsed", ocrTexts.stream().anyMatch(text -> !text.isBlank()));
      return result;
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not read the payroll PDF", exception);
    }
  }

  private boolean hasPayrollValues(ObjectNode result) {
    return result.path("normalHours").isNumber() || result.path("normalAmount").isNumber()
        || result.path("absenceAmount").isNumber() || result.path("extraAmount").isNumber()
        || result.path("grossAmount").isNumber() || !result.path("payrollLines").isEmpty();
  }

  private void mergeMissingEvidence(ObjectNode result, ObjectNode deterministic) {
    for (String field : List.of("countryCode", "languageCode", "currency",
        "documentCompleteness", "normalHours", "normalRate", "normalAmount",
        "absenceLabel", "absenceDays", "absenceHours", "absenceRate", "absenceAmount",
        "extraHours", "extraAmount", "grossAmount")) {
      if ((result.path(field).isMissingNode() || result.path(field).isNull())
          && !deterministic.path(field).isMissingNode() && !deterministic.path(field).isNull()) {
        result.set(field, deterministic.path(field));
      }
    }
    if (!result.path("payrollLines").isArray() || result.path("payrollLines").isEmpty()) {
      result.set("payrollLines", deterministic.path("payrollLines"));
    }
    if (!result.path("warnings").isArray()) result.putArray("warnings");
    result.put("ocrEvidenceAvailable", hasPayrollValues(deterministic));
  }

  private ObjectNode analyzeRenderedPages(PDDocument pdf, ArrayNode candidates) throws Exception {
    ObjectNode combined = objectMapper.createObjectNode();
    ArrayNode findings = combined.putArray("findings");
    combined.put("status", "COMPLETED");
    for (int page = 0; page < pdf.getNumberOfPages(); page++) {
      // Keep only one rendered page in memory and one Base64 image in each Groq request.
      // This stays safely below Groq's request-size limit and Render's instance memory limit.
      ObjectNode evidence =
          intelligence.analyzePayrollImages(List.of(renderPage(pdf, page, 125)), candidates);
      evidence.path("findings").forEach(findings::add);
      if (!"COMPLETED".equals(evidence.path("status").asText())) {
        combined.put("status", "FALLBACK");
      }
    }
    return combined;
  }

  private String renderPage(PDDocument pdf, int page, int dpi) throws Exception {
    BufferedImage image =
        new PDFRenderer(pdf).renderImageWithDPI(page, dpi, ImageType.GRAY);
    var output = new ByteArrayOutputStream();
    ImageIO.write(image, "jpeg", output);
    return "data:image/jpeg;base64,"
        + Base64.getEncoder().encodeToString(output.toByteArray());
  }

  private byte[] normalizePayrollImage(byte[] source, String sourceContentType) {
    Path input = null;
    Path output = null;
    try {
      if ("image/x-adobe-dng".equals(sourceContentType)) {
        byte[] preview = extractLargestEmbeddedJpeg(source);
        if (preview != null) {
          log.info("Using {} byte embedded JPEG preview from Apple ProRAW payroll photo",
              preview.length);
          source = preview;
          sourceContentType = "image/jpeg";
        }
      }
      String suffix = switch (sourceContentType) {
        case "image/x-adobe-dng" -> ".dng";
        case "image/heic" -> ".heic";
        case "image/heif" -> ".heif";
        case "image/png" -> ".png";
        case "image/webp" -> ".webp";
        default -> ".jpg";
      };
      input = Files.createTempFile("alveryn-payroll-source-", suffix);
      output = Files.createTempFile("alveryn-payroll-normalized-", ".jpg");
      Files.write(input, source);
      String diagnostic = runImageConversion(input, output);
      if (Files.size(output) == 0) {
        throw new IllegalArgumentException(
            "This RAW photo could not be converted. Choose a JPEG image or take a screenshot");
      }
      byte[] normalized = Files.readAllBytes(output);
      log.info("Normalized payroll image from {} bytes to {} bytes", source.length, normalized.length);
      return normalized;
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException(
          "This photo could not be prepared for analysis. Choose a JPEG image or screenshot",
          exception);
    } finally {
      for (Path temporary : new Path[] {input, output}) {
        if (temporary == null) continue;
        try {
          Files.deleteIfExists(temporary);
        } catch (Exception ignored) {
          // Temporary image files are best-effort cleanup.
        }
      }
    }
  }

  private byte[] extractLargestEmbeddedJpeg(byte[] source) {
    int bestStart = -1;
    int bestEnd = -1;
    for (int start = 0; start + 3 < source.length; start++) {
      if ((source[start] & 0xff) != 0xff
          || (source[start + 1] & 0xff) != 0xd8
          || (source[start + 2] & 0xff) != 0xff) {
        continue;
      }
      for (int end = start + 3; end + 1 < source.length; end++) {
        if ((source[end] & 0xff) == 0xff && (source[end + 1] & 0xff) == 0xd9) {
          if (end + 2 - start > bestEnd - bestStart) {
            bestStart = start;
            bestEnd = end + 2;
          }
          break;
        }
      }
    }
    if (bestStart < 0 || bestEnd - bestStart < 10_000) return null;
    return java.util.Arrays.copyOfRange(source, bestStart, bestEnd);
  }

  private String runImageConversion(Path input, Path output) throws Exception {
    String imageMagick = isCommandAvailable("magick") ? "magick"
        : isCommandAvailable("convert") ? "convert" : null;
    String diagnostic = "ImageMagick is not installed";
    if (imageMagick != null) {
      Process process = new ProcessBuilder(
          imageMagick,
          "-limit", "thread", "1",
          "-limit", "memory", "64MiB",
          "-limit", "map", "96MiB",
          "-limit", "disk", "512MiB",
          input.toString(),
          "-auto-orient", "-colorspace", "Gray", "-deskew", "40%",
          "-contrast-stretch", "0.5%x0.5%", "-resize", "1700x1700>",
          "-sharpen", "0x1", "-strip", "-quality", "90", output.toString())
          .redirectErrorStream(true)
          .start();
      boolean finished = process.waitFor(Duration.ofSeconds(40).toMillis(), TimeUnit.MILLISECONDS);
      if (!finished) {
        process.destroyForcibly();
        throw new IllegalArgumentException("Payroll photo conversion timed out");
      }
      diagnostic =
          new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
      if (process.exitValue() == 0 && Files.size(output) > 0) return diagnostic;
    }

    log.warn("ImageMagick payroll conversion failed, trying ffmpeg: {}", diagnostic);
    if (!isCommandAvailable("ffmpeg")) return diagnostic + "\nFFmpeg is not installed";
    Files.write(output, new byte[0]);
    Process fallback = new ProcessBuilder(
        "ffmpeg", "-y", "-threads", "1", "-i", input.toString(), "-vf",
        "scale=1700:1700:force_original_aspect_ratio=decrease,format=gray,unsharp=5:5:0.8",
        "-frames:v", "1", "-q:v", "3", output.toString())
        .redirectErrorStream(true)
        .start();
    boolean fallbackFinished =
        fallback.waitFor(Duration.ofSeconds(40).toMillis(), TimeUnit.MILLISECONDS);
    if (!fallbackFinished) {
      fallback.destroyForcibly();
      throw new IllegalArgumentException("Payroll photo conversion timed out");
    }
    String fallbackDiagnostic =
        new String(fallback.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
    if (fallback.exitValue() != 0 || Files.size(output) == 0) {
      log.warn("FFmpeg payroll conversion also failed: {}", fallbackDiagnostic);
    }
    return diagnostic + "\n" + fallbackDiagnostic;
  }

  private Integer findMonthlyPage(PDDocument pdf, int year, int month) throws Exception {
    PDFTextStripper stripper = new PDFTextStripper();
    for (int page = 0; page < pdf.getNumberOfPages(); page++) {
      stripper.setStartPage(page + 1);
      stripper.setEndPage(page + 1);
      String nativeText = stripper.getText(pdf);
      if (containsRequestedPeriod(nativeText, year, month)) return page;
    }
    if (!isCommandAvailable("tesseract")) return null;
    for (int page = 0; page < pdf.getNumberOfPages(); page++) {
      String ocrText = extractPageTextWithOcr(pdf, page);
      if (containsRequestedPeriod(ocrText, year, month)) return page;
    }
    return null;
  }

  private boolean containsRequestedPeriod(String text, int year, int month) {
    if (text == null || text.isBlank()) return false;
    String normalized = text.toLowerCase(Locale.ROOT)
        .replace('ä', 'a')
        .replaceAll("\\s+", " ");
    String yearText = String.valueOf(year);
    String shortYear = String.format("%02d", year % 100);
    String numericMonth = String.format("%02d", month);
    boolean numericPeriod = Pattern.compile(
        "(?<!\\d)" + numericMonth + "\\s*[/.-]\\s*(" + yearText + "|" + shortYear + ")(?!\\d)")
        .matcher(normalized).find()
        || Pattern.compile(
            "(?<!\\d)(" + yearText + "|" + shortYear + ")\\s*[/.-]\\s*"
                + numericMonth + "(?!\\d)")
        .matcher(normalized).find();
    if (numericPeriod) return true;
    String monthPattern = switch (month) {
      case 1 -> "jan(?:uar|uary)?";
      case 2 -> "feb(?:ruar|ruary)?";
      case 3 -> "mar(?:z|ch)?|maerz";
      case 4 -> "apr(?:il)?";
      case 5 -> "mai|may";
      case 6 -> "jun(?:i|e)?|iun(?:ie)?";
      case 7 -> "jul(?:i|y)?|iul(?:ie)?";
      case 8 -> "aug(?:ust)?";
      case 9 -> "sep(?:t(?:ember)?)?";
      case 10 -> "oct(?:ober)?|okt(?:ober)?";
      case 11 -> "nov(?:ember)?";
      case 12 -> "dec(?:ember)?|dez(?:ember)?";
      default -> "(?!)";
    };
    return Pattern.compile("\\b(?:" + monthPattern + ")\\b.{0,30}\\b(?:"
        + yearText + "|" + shortYear + ")\\b").matcher(normalized).find();
  }

  private String extractPageTextWithOcr(PDDocument pdf, int page) {
    Path imageFile = null;
    try {
      imageFile = Files.createTempFile("alveryn-payroll-page-", ".png");
      BufferedImage image =
          new PDFRenderer(pdf).renderImageWithDPI(page, 170, ImageType.GRAY);
      ImageIO.write(image, "png", imageFile.toFile());
      return runTesseract(imageFile);
    } catch (Exception ignored) {
      return "";
    } finally {
      if (imageFile != null) {
        try {
          Files.deleteIfExists(imageFile);
        } catch (Exception ignored) {
          // Temporary OCR files are best-effort cleanup.
        }
      }
    }
  }

  private String extractImageTextWithOcr(byte[] image) {
    Path imageFile = null;
    try {
      if (!isCommandAvailable("tesseract")) return "";
      imageFile = Files.createTempFile("alveryn-payroll-photo-", ".jpg");
      Files.write(imageFile, image);
      return runTesseract(imageFile);
    } catch (Exception exception) {
      log.warn("Payroll photo OCR unavailable: {}", exception.getMessage());
      return "";
    } finally {
      if (imageFile != null) {
        try {
          Files.deleteIfExists(imageFile);
        } catch (Exception ignored) {
          // Temporary OCR files are best-effort cleanup.
        }
      }
    }
  }

  private String runTesseract(Path imageFile) throws Exception {
    String languages = availableTesseractLanguages();
    if (languages.isBlank()) return "";
    StringBuilder combined = new StringBuilder();
    // Tesseract loads every requested trained-data model into native memory. Running locales
    // separately keeps the peak bounded on a 512 MB instance while retaining multilingual
    // evidence. The vision model reconciles duplicate readings afterwards.
    for (String language : languages.split("\\+")) {
      String output = runTesseractLanguage(imageFile, language);
      if (!output.isBlank()) {
        if (!combined.isEmpty()) combined.append("\n\n");
        combined.append("OCR ").append(language).append(":\n").append(output);
      }
    }
    return combined.toString();
  }

  private String runTesseractLanguage(Path imageFile, String language) throws Exception {
    ProcessBuilder builder = new ProcessBuilder(
        "tesseract", imageFile.toString(), "stdout", "-l", language,
        "--oem", "1", "--psm", "6", "-c", "preserve_interword_spaces=1")
        .redirectErrorStream(true);
    builder.environment().put("OMP_THREAD_LIMIT", "1");
    Process process = builder.start();
    boolean finished = process.waitFor(Duration.ofSeconds(25).toMillis(), TimeUnit.MILLISECONDS);
    if (!finished) {
      process.destroyForcibly();
      return "";
    }
    String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    return process.exitValue() == 0 ? output : "";
  }

  private String availableTesseractLanguages() {
    if (availableOcrLanguages != null) return availableOcrLanguages;
    if (!isCommandAvailable("tesseract")) return availableOcrLanguages = "";
    try {
      Process process = new ProcessBuilder("tesseract", "--list-langs")
          .redirectErrorStream(true).start();
      if (!process.waitFor(5, TimeUnit.SECONDS) || process.exitValue() != 0) {
        return availableOcrLanguages = "";
      }
      Set<String> installed = Set.of(
          new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8)
              .split("\\s+"));
      String configured = System.getenv("PAYROLL_OCR_LANGUAGES");
      List<String> requested = configured == null || configured.isBlank()
          ? List.of("eng", "deu", "ron", "fra")
          : Pattern.compile("[+,\\s]+").splitAsStream(configured)
              .filter(language -> !language.isBlank()).toList();
      // Loading every trained model into one Tesseract process can exhaust a 512 MB service.
      // The vision model still reads any language; this bounded OCR pass supplies independent
      // digit and label evidence for the product's primary locales. Other installed models can
      // be enabled through PAYROLL_OCR_LANGUAGES on larger instances.
      availableOcrLanguages = requested.stream()
          .filter(installed::contains).distinct()
          .reduce((left, right) -> left + "+" + right)
          .orElse("");
      log.info("Payroll OCR languages enabled: {}", availableOcrLanguages);
      return availableOcrLanguages;
    } catch (Exception exception) {
      return availableOcrLanguages = "";
    }
  }

  private String extractPageText(PDDocument pdf, int page) throws Exception {
    PDFTextStripper stripper = new PDFTextStripper();
    stripper.setStartPage(page + 1);
    stripper.setEndPage(page + 1);
    return stripper.getText(pdf).trim();
  }

  private String combineTextEvidence(String nativeText, String ocrText) {
    if (nativeText == null || nativeText.isBlank()) return ocrText == null ? "" : ocrText;
    if (ocrText == null || ocrText.isBlank()) return nativeText;
    return "DIGITAL TEXT:\n" + nativeText + "\nOCR TEXT:\n" + ocrText;
  }

  private boolean isCommandAvailable(String command) {
    try {
      Process process = new ProcessBuilder(command, "--version")
          .redirectErrorStream(true)
          .start();
      return process.waitFor(3, TimeUnit.SECONDS) && process.exitValue() == 0;
    } catch (Exception ignored) {
      return false;
    }
  }

  private Integer monthlyPageFromFilename(String filename, int requestedMonth, int pages) {
    String normalized = filename.toLowerCase(Locale.ROOT)
        .replace('ä', 'a')
        .replaceAll("[^a-z0-9]+", " ");
    Map<String, Integer> monthNames = Map.ofEntries(
        Map.entry("jan", 1), Map.entry("januar", 1), Map.entry("january", 1),
        Map.entry("feb", 2), Map.entry("februar", 2), Map.entry("february", 2),
        Map.entry("mar", 3), Map.entry("marz", 3), Map.entry("march", 3),
        Map.entry("apr", 4), Map.entry("april", 4),
        Map.entry("mai", 5), Map.entry("may", 5),
        Map.entry("iun", 6), Map.entry("jun", 6), Map.entry("juni", 6), Map.entry("june", 6),
        Map.entry("iul", 7), Map.entry("jul", 7), Map.entry("juli", 7), Map.entry("july", 7),
        Map.entry("aug", 8), Map.entry("august", 8),
        Map.entry("sep", 9), Map.entry("sept", 9), Map.entry("september", 9),
        Map.entry("oct", 10), Map.entry("okt", 10), Map.entry("october", 10),
        Map.entry("nov", 11), Map.entry("november", 11),
        Map.entry("dec", 12), Map.entry("dez", 12), Map.entry("december", 12));
    Integer firstMonth = null;
    for (String token : normalized.split("\\s+")) {
      Integer detected = monthNames.get(token);
      if (detected != null) {
        firstMonth = detected;
        break;
      }
    }
    if (firstMonth == null) return null;
    int page = requestedMonth - firstMonth;
    return page >= 0 && page < pages ? page : null;
  }

  private void validate(MultipartFile file) {
    String name = safeFilename(file.getOriginalFilename()).toLowerCase();
    if (file.isEmpty() || !name.endsWith(".pdf")) {
      throw new IllegalArgumentException("Payroll documents must be non-empty PDF files");
    }
  }

  private String validateMonthly(MultipartFile file) {
    String contentType = PayrollDocumentMediaType.detect(file);
    if (contentType == null) {
      throw new IllegalArgumentException(
          "Payroll must be a non-empty PDF, JPG, PNG, WEBP, HEIC, or HEIF file");
    }
    return contentType;
  }

  private String safeFilename(String name) {
    if (name == null || name.isBlank()) return "payroll.pdf";
    return java.nio.file.Paths.get(name).getFileName().toString();
  }
}
