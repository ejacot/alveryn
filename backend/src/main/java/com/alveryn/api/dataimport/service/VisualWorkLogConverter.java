package com.alveryn.api.dataimport.service;

import com.alveryn.api.dataimport.intelligence.ImportIntelligenceService;
import com.fasterxml.jackson.databind.JsonNode;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
@RequiredArgsConstructor
public class VisualWorkLogConverter {
  private static final int MAX_PAGES = 12;
  private final ImportIntelligenceService intelligence;

  public byte[] convert(MultipartFile file) {
    try {
      JsonNode result = intelligence.analyzeWorkLogImages(toImages(file));
      return toWorkbook(result.path("rows"));
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException("Could not prepare the visual document", exception);
    }
  }

  private List<String> toImages(MultipartFile file) throws Exception {
    String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
    if (type.equals("application/pdf") || filename(file).endsWith(".pdf")) {
      try (PDDocument pdf = Loader.loadPDF(file.getBytes())) {
        if (pdf.getNumberOfPages() > MAX_PAGES) {
          throw new IllegalArgumentException("Upload at most 12 pages at once");
        }
        PDFRenderer renderer = new PDFRenderer(pdf);
        List<String> images = new ArrayList<>();
        for (int page = 0; page < pdf.getNumberOfPages(); page++) {
          images.add(asJpeg(renderer.renderImageWithDPI(page, 135, ImageType.RGB)));
        }
        return images;
      }
    }
    BufferedImage image = ImageIO.read(new java.io.ByteArrayInputStream(file.getBytes()));
    if (image == null) throw new IllegalArgumentException("The uploaded image is not readable");
    return List.of(asJpeg(image));
  }

  private String asJpeg(BufferedImage image) throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    ImageIO.write(image, "jpg", output);
    return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
  }

  private byte[] toWorkbook(JsonNode rows) throws Exception {
    LinkedHashSet<String> labels = new LinkedHashSet<>();
    rows.forEach(row -> row.path("activities").forEach(activity -> {
      String label = activity.path("label").asText("Hours").trim();
      labels.add(label.isBlank() ? "Hours" : label);
    }));
    if (rows.isEmpty()) throw new IllegalArgumentException("No dated work rows were found");

    try (XSSFWorkbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      Sheet sheet = workbook.createSheet("Imported document");
      List<String> columns = new ArrayList<>(labels);
      Row header = sheet.createRow(0);
      header.createCell(0).setCellValue("Date");
      for (int index = 0; index < columns.size(); index++) {
        header.createCell(index + 1).setCellValue(columns.get(index));
      }
      header.createCell(columns.size() + 1).setCellValue("Marker");
      header.createCell(columns.size() + 2).setCellValue("Notes");

      int rowIndex = 1;
      for (JsonNode source : rows) {
        Row target = sheet.createRow(rowIndex++);
        target.createCell(0).setCellValue(source.path("date").asText(""));
        source.path("activities").forEach(activity -> {
          String label = activity.path("label").asText("Hours").trim();
          int column = columns.indexOf(label.isBlank() ? "Hours" : label);
          if (column >= 0 && activity.path("value").isNumber()) {
            target.createCell(column + 1).setCellValue(activity.path("value").asDouble());
          }
        });
        target.createCell(columns.size() + 1).setCellValue(source.path("marker").asText(""));
        target.createCell(columns.size() + 2).setCellValue(source.path("notes").asText(""));
      }
      workbook.write(output);
      return output.toByteArray();
    }
  }

  private String filename(MultipartFile file) {
    return file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
  }
}
