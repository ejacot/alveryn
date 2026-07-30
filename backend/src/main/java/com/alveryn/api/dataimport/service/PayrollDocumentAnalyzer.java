package com.alveryn.api.dataimport.service;

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
import java.util.concurrent.TimeUnit;
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

  private final ObjectMapper objectMapper;
  private final ImportIntelligenceService intelligence;

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
    String contentType = validateMonthly(file);
    if (file.getSize() > MAX_MONTHLY_SIZE) {
      throw new IllegalArgumentException("Payroll document exceeds the 15 MB limit");
    }
    try {
      List<String> images;
      if (contentType.equals("application/pdf")) {
        try (PDDocument pdf = Loader.loadPDF(file.getBytes())) {
          if (pdf.getNumberOfPages() > MAX_PAGES) {
            throw new IllegalArgumentException("Payroll document contains too many pages");
          }
          Integer pageIndex = findMonthlyPage(pdf, year, month);
          if (pageIndex == null) {
            pageIndex = monthlyPageFromFilename(
                safeFilename(file.getOriginalFilename()), month, pdf.getNumberOfPages());
          }
          if (pageIndex == null) {
            throw new IllegalArgumentException(
                "Could not identify the requested month in this PDF. "
                    + "Upload a photo or PDF containing only that month's page");
          }
          log.info("Payroll reconciliation selected PDF page {} of {} for {}-{} ({})",
              pageIndex + 1, pdf.getNumberOfPages(), year, month,
              safeFilename(file.getOriginalFilename()));
          images = List.of(renderPage(pdf, pageIndex, 135));
        }
      } else {
        byte[] imageBytes = file.getBytes();
        if (!List.of("image/jpeg", "image/png", "image/webp").contains(contentType)
            || imageBytes.length > 2L * 1024 * 1024) {
          imageBytes = normalizePayrollImage(imageBytes, contentType);
          contentType = "image/jpeg";
        }
        images = List.of("data:" + contentType + ";base64,"
            + Base64.getEncoder().encodeToString(imageBytes));
      }
      ObjectNode result = intelligence.analyzeMonthlyPayrollImages(images, year, month);
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
        throw new IllegalArgumentException(
            "The payroll image could not be read. Try a clearer photo with the full page visible");
      }
      result.put("filename", safeFilename(file.getOriginalFilename()));
      return result;
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not read the payroll PDF", exception);
    }
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
    Process process = new ProcessBuilder(
        "magick", input.toString(),
        "-auto-orient", "-resize", "2200x2200>", "-strip",
        "-quality", "88", output.toString())
        .redirectErrorStream(true)
        .start();
    boolean finished = process.waitFor(Duration.ofSeconds(40).toMillis(), TimeUnit.MILLISECONDS);
    if (!finished) {
      process.destroyForcibly();
      throw new IllegalArgumentException("Payroll photo conversion timed out");
    }
    String diagnostic =
        new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
    if (process.exitValue() == 0 && Files.size(output) > 0) return diagnostic;

    log.warn("ImageMagick payroll conversion failed, trying ffmpeg: {}", diagnostic);
    Files.write(output, new byte[0]);
    Process fallback = new ProcessBuilder(
        "ffmpeg", "-y", "-i", input.toString(), "-vf",
        "scale='min(2200,iw)':'min(2200,ih)':force_original_aspect_ratio=decrease",
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
      Process process = new ProcessBuilder(
          "tesseract", imageFile.toString(), "stdout", "-l", "deu+eng", "--psm", "6")
          .redirectErrorStream(true)
          .start();
      boolean finished = process.waitFor(Duration.ofSeconds(20).toMillis(), TimeUnit.MILLISECONDS);
      if (!finished) {
        process.destroyForcibly();
        return "";
      }
      String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
      return process.exitValue() == 0 ? output : "";
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
