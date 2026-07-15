package com.alveryn.api.imports.parser;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class MonthNameResolver {
  private final Map<String, Integer> monthNames = new HashMap<>();

  public MonthNameResolver() {
    register(1, "january", "januar", "ianuarie", "jan");
    register(2, "february", "februar", "februarie", "feb");
    register(3, "march", "marz", "maerz", "martie", "mar", "mär");
    register(4, "april", "aprilie", "apr");
    register(5, "may", "mai");
    register(6, "june", "juni", "iunie", "jun");
    register(7, "july", "juli", "iulie", "jul");
    register(8, "august", "aug");
    register(9, "september", "septembrie", "sep", "sept");
    register(10, "october", "oktober", "octombrie", "oct", "okt");
    register(11, "november", "noiembrie", "nov");
    register(12, "december", "dezember", "decembrie", "dec", "dez");
  }

  public Integer resolve(String sheetName) {
    return monthNames.get(normalize(sheetName));
  }

  public String normalize(String value) {
    if (value == null) {
      return "";
    }
    String normalized =
        value.replaceAll("_x[0-9A-Fa-f]{4}_", " ");
    normalized =
        Normalizer.normalize(normalized, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replaceAll("[^\\p{Alnum}]+", "")
            .toLowerCase(Locale.ROOT);
    return normalized.trim();
  }

  private void register(int month, String... aliases) {
    for (String alias : aliases) {
      monthNames.put(normalize(alias), month);
    }
  }
}
