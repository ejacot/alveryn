package com.alveryn.api.dataimport.service;

import java.io.IOException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
final class PayrollDocumentMediaType {
  private static final Set<String> SUPPORTED = Set.of(
      "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif");

  private PayrollDocumentMediaType() {}

  static String detect(MultipartFile file) {
    if (file == null || file.isEmpty()) return null;
    byte[] header;
    try {
      header = file.getInputStream().readNBytes(64);
      String magicType = detectFromHeader(header);
      if (magicType != null) return magicType;
    } catch (IOException exception) {
      throw new IllegalArgumentException("Could not read payroll document", exception);
    }

    String declared = normalize(file.getContentType());
    if (SUPPORTED.contains(declared)) return declared;
    if (declared.startsWith("image/")) {
      log.warn("Accepting payroll image with non-standard MIME type: {}", declared);
      return declared;
    }

    String name = file.getOriginalFilename() == null
        ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".heic")) return "image/heic";
    if (name.endsWith(".heif")) return "image/heif";
    log.warn(
        "Unsupported payroll upload: filename={}, contentType={}, size={}, header={}",
        file.getOriginalFilename(), file.getContentType(), file.getSize(),
        HexFormat.of().formatHex(header, 0, Math.min(header.length, 24)));
    return null;
  }

  private static String detectFromHeader(byte[] bytes) {
    if (startsWith(bytes, new int[] {0x25, 0x50, 0x44, 0x46, 0x2d})) {
      return "application/pdf";
    }
    if (startsWith(bytes, new int[] {0xff, 0xd8, 0xff})) return "image/jpeg";
    if (startsWith(bytes, new int[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})) {
      return "image/png";
    }
    if (bytes.length >= 12
        && asciiEquals(bytes, 0, "RIFF") && asciiEquals(bytes, 8, "WEBP")) {
      return "image/webp";
    }
    if (bytes.length >= 12 && asciiEquals(bytes, 4, "ftyp")) {
      String brands = new String(bytes, 8, bytes.length - 8,
          java.nio.charset.StandardCharsets.US_ASCII).toLowerCase(Locale.ROOT);
      if (brands.contains("heic") || brands.contains("heix")
          || brands.contains("hevc") || brands.contains("hevx")) {
        return "image/heic";
      }
      if (brands.contains("mif1") || brands.contains("msf1") || brands.contains("heif")) {
        return "image/heif";
      }
    }
    return null;
  }

  private static boolean startsWith(byte[] bytes, int[] signature) {
    if (bytes.length < signature.length) return false;
    for (int index = 0; index < signature.length; index++) {
      if ((bytes[index] & 0xff) != signature[index]) return false;
    }
    return true;
  }

  private static boolean asciiEquals(byte[] bytes, int offset, String expected) {
    if (bytes.length < offset + expected.length()) return false;
    for (int index = 0; index < expected.length(); index++) {
      if (bytes[offset + index] != (byte) expected.charAt(index)) return false;
    }
    return true;
  }

  private static String normalize(String value) {
    if (value == null) return "";
    String normalized = value.toLowerCase(Locale.ROOT).split(";", 2)[0].trim();
    return "image/jpg".equals(normalized) ? "image/jpeg" : normalized;
  }
}
