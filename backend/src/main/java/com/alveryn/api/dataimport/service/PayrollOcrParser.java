package com.alveryn.api.dataimport.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Conservative payroll parser used as independent evidence and as an offline fallback. */
final class PayrollOcrParser {
  private static final Pattern NUMBER = Pattern.compile(
      "(?<![\\p{L}\\d])[-+]?(?:\\d{1,3}(?:[ .,'’]\\d{3})+(?:[,.]\\d{1,4})?"
          + "|\\d+(?:[,.]\\d{1,4})?)(?![\\p{L}\\d])");
  private static final Pattern YEAR = Pattern.compile("\\b(20\\d{2})\\b");
  private static final Map<String, Integer> MONTHS = monthNames();

  private final ObjectMapper mapper;

  PayrollOcrParser(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  ObjectNode parse(String text, int requestedYear, int requestedMonth) {
    ObjectNode result = mapper.createObjectNode();
    ArrayNode linesNode = result.putArray("payrollLines");
    ArrayNode warnings = result.putArray("warnings");
    result.put("status", "FALLBACK");
    result.put("extractionMethod", "OCR_DETERMINISTIC");
    if (text == null || text.isBlank()) return result;

    String normalizedDocument = normalize(text);
    String currency = detectCurrency(text, normalizedDocument);
    String country = detectCountry(normalizedDocument, currency);
    String language = languageForCountry(country);
    Period period = detectPeriod(normalizedDocument);
    if (period == null) {
      result.put("year", requestedYear);
      result.put("month", requestedMonth);
      result.put("periodInferredFromCalendar", true);
      result.put("documentCompleteness", "FRAGMENT");
      warnings.add("PERIOD_INFERRED_FROM_CALENDAR");
    } else {
      result.put("year", period.year());
      result.put("month", period.month());
      result.put("documentCompleteness", "FULL_PAGE");
    }
    if (country == null) result.putNull("countryCode"); else result.put("countryCode", country);
    if (language == null) result.putNull("languageCode"); else result.put("languageCode", language);
    if (currency == null) {
      result.putNull("currency");
      warnings.add("CURRENCY_NOT_VISIBLE");
    } else result.put("currency", currency);

    List<Line> parsedLines = new ArrayList<>();
    BigDecimal printedGross = null;
    for (String rawLine : text.split("\\R")) {
      String clean = rawLine.replaceAll("\\s+", " ").trim();
      if (clean.length() < 3) continue;
      String normalized = normalize(clean);
      List<NumberToken> numbers = numbers(clean);
      if (isGrossLabel(normalized) && !numbers.isEmpty()) {
        printedGross = numbers.get(numbers.size() - 1).value();
        continue;
      }
      Line line = parseEarningLine(clean, normalized, numbers);
      if (line != null) parsedLines.add(line);
    }

    for (Line line : parsedLines) {
      ObjectNode node = linesNode.addObject();
      putNullable(node, "code", line.code());
      node.put("label", line.label());
      node.put("category", line.category());
      putNullable(node, "quantity", line.quantity());
      putNullable(node, "factor", line.factor());
      putNullable(node, "percentage", line.percentage());
      putNullable(node, "amount", line.amount());
      node.put("confidence", line.confidence());
      node.put("evidenceText", line.evidence());
    }
    applyTotals(result, parsedLines, printedGross);
    if (!parsedLines.isEmpty() || printedGross != null) {
      result.put("status", "COMPLETED");
      double confidence = printedGross != null && parsedLines.stream().anyMatch(Line::arithmeticValid)
          ? 0.88 : 0.72;
      result.put("confidence", confidence);
      result.put("requiresReview", confidence < 0.85 || printedGross == null);
    }
    return result;
  }

  private Line parseEarningLine(String raw, String normalized, List<NumberToken> numbers) {
    Category category = category(normalized);
    if (numbers.size() < 2 || category != Category.SURCHARGE && isDeduction(normalized)
        || isMetadata(normalized)) return null;
    if (category == Category.UNKNOWN && numbers.size() < 3) return null;
    boolean beginsWithCode = numbers.get(0).start() <= 4
        && numbers.get(0).raw().matches("\\d{1,4}");
    if (numbers.size() == 2 && beginsWithCode && category != Category.UNKNOWN) {
      String label = raw.substring(numbers.get(0).end(), numbers.get(1).start())
          .replaceAll("^[|:;., -]+|[|:;., -]+$", "").trim();
      return new Line(numbers.get(0).raw(), label, category.name(), numbers.get(1).value(),
          null, percentage(raw), null, 0.68, raw, false);
    }
    NumberToken amountToken = numbers.get(numbers.size() - 1);
    BigDecimal amount = amountToken.value();
    ArithmeticPair pair = arithmeticPair(numbers, amount);
    BigDecimal factor = pair == null ? numbers.size() >= 3
        ? numbers.get(numbers.size() - 2).value() : null : pair.factor().value();
    BigDecimal quantity = pair == null ? numbers.size() >= 3
        ? numbers.get(numbers.size() - 3).value() : null : pair.quantity().value();
    BigDecimal percentage = percentage(raw);
    if (factor != null && quantity != null) {
      BigDecimal product = quantity.multiply(factor);
      if (looksLikeLostDecimalPoint(amount, product)) {
        amount = product.stripTrailingZeros();
      } else if (product.subtract(amount).abs().compareTo(new BigDecimal("0.06")) > 0) {
        BigDecimal derived = factor.signum() == 0 ? null
            : amount.divide(factor, 4, RoundingMode.HALF_UP).stripTrailingZeros();
        if (derived != null && plausibleQuantity(derived)) quantity = derived;
      }
    }
    String code = numbers.get(0).start() <= 4 && numbers.get(0).raw().matches("\\d{1,4}")
        ? numbers.get(0).raw() : null;
    int labelEnd = quantity == null ? amountToken.start()
        : pair == null ? numbers.get(numbers.size() - 3).start() : pair.quantity().start();
    int labelStart = code == null ? 0 : numbers.get(0).end();
    String label = raw.substring(Math.min(labelStart, raw.length()), Math.max(labelStart, labelEnd))
        .replaceAll("^[|:;., -]+|[|:;., -]+$", "").trim();
    if (label.isBlank()) label = raw.substring(0, amountToken.start()).trim();
    boolean arithmeticValid = factor != null && quantity != null
        && quantity.multiply(factor).subtract(amount).abs().compareTo(new BigDecimal("0.06")) <= 0;
    double confidence = arithmeticValid ? 0.92 : category == Category.UNKNOWN ? 0.62 : 0.76;
    return new Line(code, label, category.name(), quantity, factor, percentage, amount,
        confidence, raw, arithmeticValid);
  }

  private boolean looksLikeLostDecimalPoint(BigDecimal scanned, BigDecimal calculated) {
    if (calculated.signum() == 0) return false;
    BigDecimal ratio = scanned.abs().divide(calculated.abs(), 4, RoundingMode.HALF_UP);
    return List.of("0.01", "0.1", "10", "100").stream()
        .map(BigDecimal::new)
        .anyMatch(candidate -> ratio.subtract(candidate).abs().compareTo(new BigDecimal("0.001")) <= 0);
  }

  private ArithmeticPair arithmeticPair(List<NumberToken> numbers, BigDecimal amount) {
    ArithmeticPair best = null;
    BigDecimal bestDifference = null;
    int last = numbers.size() - 1;
    int start = numbers.get(0).start() <= 4 && numbers.get(0).raw().matches("\\d{1,4}") ? 1 : 0;
    for (int quantityIndex = start; quantityIndex < last - 1; quantityIndex++) {
      for (int factorIndex = quantityIndex + 1; factorIndex < last; factorIndex++) {
        BigDecimal difference = numbers.get(quantityIndex).value()
            .multiply(numbers.get(factorIndex).value()).subtract(amount).abs();
        if (bestDifference == null || difference.compareTo(bestDifference) < 0
            || difference.compareTo(bestDifference) == 0
                && factorIndex - quantityIndex < best.factorIndex() - best.quantityIndex()) {
          bestDifference = difference;
          best = new ArithmeticPair(numbers.get(quantityIndex), numbers.get(factorIndex),
              quantityIndex, factorIndex);
        }
      }
    }
    return bestDifference != null && bestDifference.compareTo(new BigDecimal("0.06")) <= 0
        ? best : null;
  }

  private void applyTotals(ObjectNode result, List<Line> lines, BigDecimal printedGross) {
    Line regular = lines.stream().filter(line -> line.category().equals(Category.REGULAR_PAY.name()))
        .max((left, right) -> amountOrZero(left).compareTo(amountOrZero(right))).orElse(null);
    if (regular != null) {
      putNullable(result, "normalHours", regular.quantity());
      putNullable(result, "normalRate", regular.factor());
      putNullable(result, "normalAmount", regular.amount());
    }
    BigDecimal extraAmount = BigDecimal.ZERO;
    Map<String, BigDecimal> extraHours = new LinkedHashMap<>();
    boolean hasExtra = false;
    boolean hasExtraAmount = false;
    for (Line line : lines) {
      if (!line.category().equals(Category.SURCHARGE.name())) continue;
      hasExtra = true;
      if (line.amount() != null) {
        extraAmount = extraAmount.add(line.amount());
        hasExtraAmount = true;
      }
      if (line.quantity() != null) {
        extraHours.merge(surchargeGroup(normalize(line.label())), line.quantity(), BigDecimal::max);
      }
    }
    if (hasExtra) {
      if (hasExtraAmount) result.put("extraAmount", extraAmount);
      result.put("extraHours", extraHours.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }
    if (printedGross != null) result.put("grossAmount", printedGross);
    else if (lines.stream().anyMatch(line -> line.amount() != null)) result.put("grossAmount",
        lines.stream().map(Line::amount).filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add));
  }

  private BigDecimal amountOrZero(Line line) {
    return line.amount() == null ? BigDecimal.ZERO : line.amount();
  }

  private Category category(String text) {
    if (containsAny(text, "zuschlag", "nacht", "sonntag", "feiertag", "spor", "suplimentare",
        "noapte", "weekend", "overtime", "premium", "night", "sunday", "majoration",
        "nuit", "dimanche", "straordinario", "notturno")) return Category.SURCHARGE;
    if (containsAny(text, "urlaub", "krank", "vacation", "holiday", "absence", "concediu",
        "medical", "boala", "maladie", "conge", "ferie")) return Category.PAID_ABSENCE;
    if (containsAny(text, "lohn", "gehalt", "grundlohn", "salariu de baza", "ore lucrate",
        "regular pay", "basic pay", "base pay", "salaire de base", "salaire mensuel",
        "retribuzione ordinaria", "salario base")) return Category.REGULAR_PAY;
    return Category.UNKNOWN;
  }

  private boolean isDeduction(String text) {
    return containsAny(text, "steuer", "lohnsteuer", "kirchensteuer", "sozialversicherung",
        "impozit", "cas", "cass", "deducere", "deduction", "tax", "insurance",
        "cotisation", "retenue", "net pay", "netto", "salariu net");
  }

  private boolean isMetadata(String text) {
    return containsAny(text, "iban", "bic", "adresse", "address", "pers nr", "steuer id",
        "social security", "cnp", "employee id", "personal", "bank");
  }

  private boolean isGrossLabel(String text) {
    return containsAny(text, "gesamtbrutto", "total brut", "gross pay", "gross earnings",
        "salaire brut", "retribuzione lorda", "salario bruto");
  }

  private String detectCurrency(String raw, String text) {
    if (raw.contains("€") || text.matches(".*\\b(eur|euro)\\b.*")) return "EUR";
    if (raw.contains("£") || text.matches(".*\\b(gbp)\\b.*")) return "GBP";
    if (raw.contains("$") || text.matches(".*\\b(usd)\\b.*")) return "USD";
    if (text.matches(".*\\b(ron|lei|leu)\\b.*")) return "RON";
    if (text.matches(".*\\b(chf)\\b.*")) return "CHF";
    if (text.matches(".*\\b(pln|zloty)\\b.*")) return "PLN";
    return null;
  }

  private String detectCountry(String text, String currency) {
    if (containsAny(text, "lohnart", "gesamtbrutto", "steuerklasse", "sozialversicherung")) return "DE";
    if (containsAny(text, "fluturas", "salariu de baza", "contributie", "cnp")) return "RO";
    if (containsAny(text, "national insurance", "paye", "employee payslip")) return "GB";
    if (containsAny(text, "bulletin de paie", "salaire brut", "cotisation")) return "FR";
    if ("RON".equals(currency)) return "RO";
    return null;
  }

  private String languageForCountry(String country) {
    if (country == null) return null;
    return switch (country) { case "DE" -> "de"; case "RO" -> "ro"; case "GB" -> "en";
      case "FR" -> "fr"; default -> null; };
  }

  private Period detectPeriod(String text) {
    Matcher yearMatcher = YEAR.matcher(text);
    if (!yearMatcher.find()) return null;
    int year = Integer.parseInt(yearMatcher.group(1));
    for (Map.Entry<String, Integer> entry : MONTHS.entrySet()) {
      if (text.matches(".*\\b" + Pattern.quote(entry.getKey()) + "\\b.*")) {
        return new Period(year, entry.getValue());
      }
    }
    Matcher numeric = Pattern.compile("\\b(0?[1-9]|1[0-2])\\s*[/.-]\\s*" + year + "\\b")
        .matcher(text);
    return numeric.find() ? new Period(year, Integer.parseInt(numeric.group(1))) : null;
  }

  private List<NumberToken> numbers(String text) {
    List<NumberToken> result = new ArrayList<>();
    Matcher matcher = NUMBER.matcher(text);
    while (matcher.find()) {
      try { result.add(new NumberToken(matcher.group(), decimal(matcher.group()), matcher.start(), matcher.end())); }
      catch (NumberFormatException ignored) { }
    }
    return result;
  }

  private BigDecimal percentage(String raw) {
    Matcher matcher = Pattern.compile("(\\d{1,3}(?:[,.]\\d+)?)\\s*%").matcher(raw);
    if (!matcher.find()) return null;
    return decimal(matcher.group(1));
  }

  private BigDecimal decimal(String raw) {
    String value = raw.replace(" ", "").replace("'", "").replace("’", "");
    int comma = value.lastIndexOf(',');
    int dot = value.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      char decimal = comma > dot ? ',' : '.';
      value = value.replace(decimal == ',' ? "." : ",", "").replace(decimal, '.');
    } else if (comma >= 0) value = value.replace('.', ' ').replace(" ", "").replace(',', '.');
    else if (dot >= 0 && value.length() - dot - 1 == 3 && dot <= 3) {
      value = value.replace(".", "");
    }
    return new BigDecimal(value);
  }

  private boolean plausibleQuantity(BigDecimal value) {
    return value.signum() >= 0 && value.compareTo(new BigDecimal("10000")) < 0;
  }

  private boolean containsAny(String text, String... terms) {
    for (String term : terms) if (text.contains(term)) return true;
    return false;
  }

  private String surchargeGroup(String text) {
    if (containsAny(text, "nacht", "night", "noapte", "nuit", "notturno")) return "NIGHT";
    if (containsAny(text, "sonntag", "sunday", "duminica", "dimanche")) return "SUNDAY";
    if (containsAny(text, "feiertag", "holiday", "sarbatoare", "festivo")) return "HOLIDAY";
    return text.replaceAll("\\b(steuerfrei|steuerpflichtig|scutit|impozabil|taxable|tax free)\\b", "")
        .replaceAll("\\s+", " ").trim();
  }

  private String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
        .toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
  }

  private void putNullable(ObjectNode node, String field, String value) {
    if (value == null) node.putNull(field); else node.put(field, value);
  }

  private void putNullable(ObjectNode node, String field, BigDecimal value) {
    if (value == null) node.putNull(field); else node.put(field, value);
  }

  private static Map<String, Integer> monthNames() {
    Map<String, Integer> months = new LinkedHashMap<>();
    String[][] names = {{"januar","january","ianuarie","janvier","gennaio","enero"},
        {"februar","february","februarie","fevrier","febbraio","febrero"},
        {"marz","march","martie","mars","marzo"}, {"april","aprilie","avril","aprile","abril"},
        {"mai","may","mai","maggio","mayo"}, {"juni","june","iunie","juin","giugno","junio"},
        {"juli","july","iulie","juillet","luglio","julio"}, {"august","august","août","agosto"},
        {"september","septembrie","septembre","settembre"}, {"oktober","october","octombrie","octobre","ottobre"},
        {"november","noiembrie","novembre"}, {"dezember","december","decembrie","decembre","dicembre","diciembre"}};
    for (int index = 0; index < names.length; index++) for (String name : names[index]) months.put(normalizeStatic(name), index + 1);
    return Map.copyOf(months);
  }

  private static String normalizeStatic(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
  }

  private enum Category { REGULAR_PAY, SURCHARGE, PAID_ABSENCE, UNKNOWN }
  private record Period(int year, int month) {}
  private record NumberToken(String raw, BigDecimal value, int start, int end) {}
  private record ArithmeticPair(NumberToken quantity, NumberToken factor,
      int quantityIndex, int factorIndex) {}
  private record Line(String code, String label, String category, BigDecimal quantity,
      BigDecimal factor, BigDecimal percentage, BigDecimal amount, double confidence,
      String evidence, boolean arithmeticValid) {}
}
