package com.roomly.api.statistics.service;

import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.statistics.dto.StatisticsAdvancedComparisonResponse;
import com.roomly.api.statistics.dto.ForecastMode;
import com.roomly.api.statistics.dto.ForecastUnavailableReason;
import com.roomly.api.statistics.dto.HighlightType;
import com.roomly.api.statistics.dto.InsightSeverity;
import com.roomly.api.statistics.dto.InsightType;
import com.roomly.api.statistics.dto.ProductivityGrouping;
import com.roomly.api.statistics.dto.ProductivityMetric;
import com.roomly.api.statistics.dto.StatisticsComparisonAlignment;
import com.roomly.api.statistics.dto.StatisticsComparisonDifferenceResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonRequest;
import com.roomly.api.statistics.dto.ComparisonDirection;
import com.roomly.api.statistics.dto.MoneyAmountResponse;
import com.roomly.api.statistics.dto.StatisticsConfidence;
import com.roomly.api.statistics.dto.StatisticsComparisonResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonSeriesPointResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonSeriesResponse;
import com.roomly.api.statistics.dto.StatisticsDrilldownResponse;
import com.roomly.api.statistics.dto.StatisticsFilters;
import com.roomly.api.statistics.dto.StatisticsForecastItemResponse;
import com.roomly.api.statistics.dto.StatisticsForecastResponse;
import com.roomly.api.statistics.dto.StatisticsGranularity;
import com.roomly.api.statistics.dto.StatisticsHighlightResponse;
import com.roomly.api.statistics.dto.StatisticsHighlightsResponse;
import com.roomly.api.statistics.dto.StatisticsHeatmapDayResponse;
import com.roomly.api.statistics.dto.StatisticsHeatmapResponse;
import com.roomly.api.statistics.dto.StatisticsInsightResponse;
import com.roomly.api.statistics.dto.StatisticsInsightsResponse;
import com.roomly.api.statistics.dto.StatisticsMetric;
import com.roomly.api.statistics.dto.StatisticsOverviewResponse;
import com.roomly.api.statistics.dto.StatisticsPercentageBasis;
import com.roomly.api.statistics.dto.StatisticsPeriodRequest;
import com.roomly.api.statistics.dto.StatisticsPeriodTotalsResponse;
import com.roomly.api.statistics.dto.StatisticsProductivityPointResponse;
import com.roomly.api.statistics.dto.StatisticsProductivityResponse;
import com.roomly.api.statistics.dto.StatisticsProductivityUnitTypeResponse;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesPointResponse;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesResponse;
import com.roomly.api.statistics.dto.StatisticsWorkTypeResponse;
import com.roomly.api.statistics.model.StatisticsErrorCode;
import com.roomly.api.statistics.repository.StatisticsRepository;
import com.roomly.api.workentry.entity.UnitEntryItem;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.UnitEntryItemRepository;
import com.roomly.api.worktype.entity.CalculationMethod;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StatisticsService {
  private static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;
  private static final int SCALE = 15;
  private static final int MAX_RANGE_DAYS = 3660;
  private static final int MAX_HEATMAP_DAYS = 366;

  private final StatisticsRepository statisticsRepository;
  private final TimeEntryDetailsRepository timeEntryDetailsRepository;
  private final UnitEntryItemRepository unitEntryItemRepository;
  private final AbsenceRepository absenceRepository;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;
  private final Clock clock;

  @Transactional(readOnly = true)
  public StatisticsOverviewResponse overview(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> currentEntries = findEntries(userId, filters);
    Period previousPeriod = previousPeriod(filters.from(), filters.to());
    List<WorkEntry> previousEntries =
        findEntries(userId, filters, previousPeriod.from(), previousPeriod.to());

    long entries = currentEntries.size();
    StatisticsPeriodTotalsResponse totals = totals(filters.from(), filters.to(), currentEntries);

    return new StatisticsOverviewResponse(
        totals.grossByCurrency(),
        totals.workedMinutes(),
        totals.workedDays(),
        entries,
        totals.averageMinutesPerWorkedDay(),
        comparison(currentEntries, previousEntries));
  }

  @Transactional(readOnly = true)
  public StatisticsTimeSeriesResponse timeSeries(StatisticsFilters filters, StatisticsMetric metric) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    StatisticsGranularity granularity = resolveGranularity(filters.from(), filters.to());
    Map<BucketCurrencyKey, BigDecimal> grouped = new LinkedHashMap<>();
    Map<BucketCurrencyKey, Set<LocalDate>> workedDays = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      Bucket bucket = bucketFor(entry.getWorkDate(), granularity, filters.to());
      String currency = metric == StatisticsMetric.GROSS ? entry.getCurrencySnapshot() : null;
      BucketCurrencyKey key = new BucketCurrencyKey(bucket.start(), bucket.end(), currency);
      if (metric == StatisticsMetric.WORKED_DAYS) {
        workedDays.computeIfAbsent(key, ignored -> new LinkedHashSet<>()).add(entry.getWorkDate());
      } else {
        grouped.merge(key, metricValue(entry, metric), BigDecimal::add);
      }
    }
    List<StatisticsTimeSeriesPointResponse> points = new ArrayList<>();
    for (Bucket bucket : completeBuckets(filters.from(), filters.to(), granularity)) {
      if (metric == StatisticsMetric.GROSS) {
        List<String> currencies = currenciesFor(entries);
        if (currencies.isEmpty()) {
          points.add(point(bucket, BigDecimal.ZERO.setScale(SCALE), metric, null));
        } else {
          for (String currency : currencies) {
            points.add(point(bucket, grouped.getOrDefault(new BucketCurrencyKey(bucket.start(), bucket.end(), currency), BigDecimal.ZERO.setScale(SCALE)), metric, currency));
          }
        }
      } else {
        BucketCurrencyKey key = new BucketCurrencyKey(bucket.start(), bucket.end(), null);
        BigDecimal value =
            metric == StatisticsMetric.WORKED_DAYS
                ? BigDecimal.valueOf(workedDays.getOrDefault(key, Set.of()).size()).setScale(SCALE)
                : grouped.getOrDefault(key, BigDecimal.ZERO.setScale(SCALE));
        points.add(point(bucket, value, metric, null));
      }
    }
    return new StatisticsTimeSeriesResponse(granularity, metric, points);
  }

  @Transactional(readOnly = true)
  public List<StatisticsWorkTypeResponse> workTypes(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    return workTypeBreakdown(entries);
  }

  @Transactional(readOnly = true)
  public StatisticsAdvancedComparisonResponse comparison(StatisticsComparisonRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    validateComparisonRequest(request);
    StatisticsFilters filtersA =
        new StatisticsFilters(
            request.periodA().from(), request.periodA().to(), request.workTypeIds(), request.calculationMethods());
    StatisticsFilters filtersB =
        new StatisticsFilters(
            request.periodB().from(), request.periodB().to(), request.workTypeIds(), request.calculationMethods());
    List<WorkEntry> entriesA = findEntries(userId, filtersA);
    List<WorkEntry> entriesB = findEntries(userId, filtersB);
    StatisticsPeriodTotalsResponse totalsA = totals(filtersA.from(), filtersA.to(), entriesA);
    StatisticsPeriodTotalsResponse totalsB = totals(filtersB.from(), filtersB.to(), entriesB);
    return new StatisticsAdvancedComparisonResponse(
        request.metric(),
        totalsA,
        totalsB,
        comparisonDifferences(entriesA, entriesB, totalsA, totalsB, request.metric()),
        comparisonSeries(filtersA, filtersB, entriesA, entriesB, request.metric()));
  }

  @Transactional(readOnly = true)
  public StatisticsHeatmapResponse heatmap(StatisticsFilters filters, StatisticsMetric metric, String currency) {
    validateRange(filters.from(), filters.to());
    long days = ChronoUnit.DAYS.between(filters.from(), filters.to()) + 1;
    if (days > MAX_HEATMAP_DAYS) {
      throw new ValidationException(
          "heatmap range is too large", StatisticsErrorCode.STATISTICS_HEATMAP_RANGE_TOO_LARGE.name());
    }
    if (!List.of(StatisticsMetric.WORKED_HOURS, StatisticsMetric.WORKED_MINUTES, StatisticsMetric.ENTRIES, StatisticsMetric.GROSS).contains(metric)) {
      throw new ValidationException(
          "unsupported heatmap metric", StatisticsErrorCode.STATISTICS_UNSUPPORTED_HEATMAP_METRIC.name());
    }
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    List<String> currencies = currenciesFor(entries);
    String normalizedCurrency = normalizeCurrency(currency);
    if (metric == StatisticsMetric.GROSS) {
      if (normalizedCurrency != null && !currencies.contains(normalizedCurrency)) {
        throw new ValidationException(
            "currency is not present in heatmap result", StatisticsErrorCode.STATISTICS_INVALID_HEATMAP_CURRENCY.name());
      }
      if (normalizedCurrency == null && currencies.size() > 1) {
        throw new ValidationException(
            "gross heatmap requires a single currency result",
            StatisticsErrorCode.STATISTICS_GROSS_REQUIRES_CURRENCY_SELECTION.name());
      }
      if (normalizedCurrency == null && currencies.size() == 1) {
        normalizedCurrency = currencies.getFirst();
      }
    }
    Map<LocalDate, List<WorkEntry>> entriesByDate = entriesByDate(entries);
    Set<LocalDate> absenceDates = absenceDates(userId, filters.from(), filters.to());
    String selectedCurrency = normalizedCurrency;
    List<StatisticsHeatmapDayResponse> heatmapDays = new ArrayList<>();
    BigDecimal max = BigDecimal.ZERO.setScale(SCALE);
    for (LocalDate date = filters.from(); !date.isAfter(filters.to()); date = date.plusDays(1)) {
      List<WorkEntry> dayEntries = entriesByDate.getOrDefault(date, List.of());
      List<WorkEntry> valueEntries =
          metric == StatisticsMetric.GROSS && selectedCurrency != null
              ? dayEntries.stream().filter(entry -> entry.getCurrencySnapshot().equals(selectedCurrency)).toList()
              : dayEntries;
      BigDecimal value = aggregateMetric(valueEntries, metric).setScale(SCALE, RoundingMode.HALF_UP);
      max = max.max(value);
      heatmapDays.add(
          new StatisticsHeatmapDayResponse(
              date,
              value,
              sumMinutes(dayEntries),
              dayEntries.size(),
              grossByCurrency(dayEntries),
              absenceDates.contains(date)));
    }
    return new StatisticsHeatmapResponse(
        metric,
        metric == StatisticsMetric.GROSS ? selectedCurrency : null,
        BigDecimal.ZERO.setScale(SCALE),
        max,
        heatmapDays);
  }

  private String normalizeCurrency(String currency) {
    if (currency == null || currency.isBlank()) {
      return null;
    }
    String normalized = currency.trim().toUpperCase(Locale.ROOT);
    if (!normalized.matches("[A-Z]{3}")) {
      throw new ValidationException(
          "invalid heatmap currency", StatisticsErrorCode.STATISTICS_INVALID_HEATMAP_CURRENCY.name());
    }
    return normalized;
  }

  @Transactional(readOnly = true)
  public StatisticsDrilldownResponse drilldown(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    return new StatisticsDrilldownResponse(
        filters.from(), filters.to(), totals(filters.from(), filters.to(), entries), workTypeBreakdown(entries));
  }

  @Transactional(readOnly = true)
  public StatisticsForecastResponse forecast(StatisticsFilters filters, ForecastMode mode, String currency) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    validateRange(filters.from(), filters.to());
    ForecastMode resolvedMode = mode == null ? ForecastMode.WORKDAY_PACE : mode;
    LocalDate today = LocalDate.now(clock);
    LocalDate asOf = today.isBefore(filters.from()) ? filters.from().minusDays(1) : today.isAfter(filters.to()) ? filters.to() : today;
    LocalDate queryTo = asOf.isBefore(filters.from()) ? filters.from() : asOf;
    List<WorkEntry> entries = findEntries(userId, filters, filters.from(), queryTo);
    String selectedCurrency = normalizeCurrency(currency);
    List<String> currencies = currenciesFor(entries);
    if (selectedCurrency != null) {
      currencies = currencies.contains(selectedCurrency) ? List.of(selectedCurrency) : List.of();
    }
    List<StatisticsForecastItemResponse> forecasts = new ArrayList<>();
    for (String itemCurrency : currencies) {
      forecasts.add(forecastForCurrency(userId, filters, resolvedMode, today, asOf, entries, itemCurrency));
    }
    if (forecasts.isEmpty()) {
      forecasts.add(
          new StatisticsForecastItemResponse(
              selectedCurrency,
              BigDecimal.ZERO.setScale(SCALE),
              BigDecimal.ZERO.setScale(SCALE),
              BigDecimal.ZERO.setScale(SCALE),
              BigDecimal.ZERO.setScale(SCALE),
              0,
              0,
              0,
              BigDecimal.ZERO.setScale(SCALE),
              BigDecimal.ZERO.setScale(SCALE),
              false,
              resolvedMode.name(),
              0,
              null,
              null,
              0,
              0,
              BigDecimal.ZERO.setScale(SCALE),
              BigDecimal.ZERO.setScale(SCALE),
              StatisticsConfidence.LOW,
              false,
              ForecastUnavailableReason.NO_GROSS_DATA));
    }
    return new StatisticsForecastResponse(filters.from(), filters.to(), asOf, resolvedMode, forecasts);
  }

  @Transactional(readOnly = true)
  public StatisticsProductivityResponse productivity(
      StatisticsFilters filters,
      Collection<UUID> unitTypeIds,
      ProductivityMetric metric,
      ProductivityGrouping grouping) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    StatisticsFilters unitFilters =
        new StatisticsFilters(filters.from(), filters.to(), filters.workTypeIds(), List.of(CalculationMethod.UNIT_BASED));
    List<WorkEntry> entries = findEntries(userId, unitFilters);
    List<UnitEntryItem> items = unitItems(entries, unitTypeIds);
    ProductivityMetric resolvedMetric = metric == null ? ProductivityMetric.TOTAL_UNITS : metric;
    ProductivityGrouping resolvedGrouping = grouping == null ? ProductivityGrouping.TOTAL : grouping;
    validateProductivityGrouping(resolvedGrouping);
    StatisticsGranularity granularity = productivityGranularity(filters.from(), filters.to(), resolvedGrouping);
    ProductivityTotals totals = productivityTotals(items);
    List<StatisticsProductivityUnitTypeResponse> unitTypes = productivityUnitTypes(items, totals.totalUnits());
    List<StatisticsProductivityPointResponse> points =
        productivityPoints(filters.from(), filters.to(), granularity, resolvedGrouping, entries, items, resolvedMetric);
    return new StatisticsProductivityResponse(
        totals.totalUnits(),
        totals.equivalentMinutes(),
        null,
        totals.configuredUnitsPerHour(),
        null,
        null,
        false,
        !items.isEmpty(),
        false,
        0,
        unitTypes,
        resolvedGrouping,
        granularity,
        resolvedMetric,
        points);
  }

  @Transactional(readOnly = true)
  public StatisticsHighlightsResponse highlights(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    return new StatisticsHighlightsResponse(highlightItems(entries));
  }

  @Transactional(readOnly = true)
  public StatisticsInsightsResponse insights(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> currentEntries = findEntries(userId, filters);
    Period previous = previousPeriod(filters.from(), filters.to());
    List<WorkEntry> previousEntries = findEntries(userId, filters, previous.from(), previous.to());
    List<StatisticsInsightResponse> insights = new ArrayList<>();
    if (distinctWorkedDays(currentEntries) >= 3 && distinctWorkedDays(previousEntries) >= 3) {
      addChangeInsight(insights, InsightType.HOURS_CHANGE, null, sumMinutes(currentEntries), sumMinutes(previousEntries), BigDecimal.valueOf(60));
      addWorkedDaysInsight(insights, currentEntries, previousEntries);
    }
    addBestWeekdayInsight(insights, currentEntries);
    addMostUsedWorkTypeInsight(insights, currentEntries);
    Streaks streaks = streaks(currentEntries);
    if (streaks.currentLength() > 1) {
      insights.add(
          new StatisticsInsightResponse(
              InsightType.STREAK,
              ComparisonDirection.UP,
              null,
              BigDecimal.valueOf(streaks.currentLength()).setScale(SCALE),
              null,
              null,
              null,
              InsightSeverity.POSITIVE,
              streaks.currentLength() >= 5 ? StatisticsConfidence.HIGH : StatisticsConfidence.MEDIUM));
    }
    return new StatisticsInsightsResponse(
        insights.stream()
            .sorted(Comparator.comparingInt(this::insightScore).reversed())
            .limit(5)
            .toList());
  }

  private StatisticsForecastItemResponse forecastForCurrency(
      UUID userId,
      StatisticsFilters filters,
      ForecastMode mode,
      LocalDate today,
      LocalDate asOf,
      List<WorkEntry> entries,
      String currency) {
    List<WorkEntry> currencyEntries =
        entries.stream().filter(entry -> entry.getCurrencySnapshot().equals(currency)).toList();
    BigDecimal actual = grossByCurrency(currencyEntries).stream()
        .filter(amount -> amount.currency().equals(currency))
        .findFirst()
        .map(MoneyAmountResponse::amount)
        .orElse(BigDecimal.ZERO.setScale(SCALE));
    int workedDays = distinctWorkedDays(currencyEntries);
    int entryCount = currencyEntries.size();
    boolean todayHasEntry = currencyEntries.stream().anyMatch(entry -> entry.getWorkDate().equals(today));
    boolean todayIncluded = !today.isBefore(filters.from()) && !today.isAfter(filters.to()) && todayHasEntry;
    LocalDate elapsedTo = todayIncluded ? asOf : asOf.minusDays(1);
    if (today.isAfter(filters.to())) {
      elapsedTo = filters.to();
    }
    List<LocalDate> elapsedDates = eligibleDates(userId, filters.from(), elapsedTo, currencyEntries, mode);
    List<LocalDate> totalDates = eligibleDates(userId, filters.from(), filters.to(), currencyEntries, mode);
    int elapsedEligibleDays = elapsedDates.size();
    int totalEligibleDays = totalDates.size();
    int remainingEligibleDays = Math.max(0, totalEligibleDays - elapsedEligibleDays);
    BigDecimal observedWorkFrequency =
        elapsedEligibleDays == 0
            ? BigDecimal.ZERO.setScale(SCALE)
            : BigDecimal.valueOf(workedDays)
                .divide(BigDecimal.valueOf(elapsedEligibleDays), MATH_CONTEXT)
                .min(BigDecimal.ONE)
                .setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal expectedRemainingWorkedDays =
        observedWorkFrequency
            .multiply(BigDecimal.valueOf(remainingEligibleDays), MATH_CONTEXT)
            .setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal average = workedDays == 0
        ? BigDecimal.ZERO.setScale(SCALE)
        : actual.divide(BigDecimal.valueOf(workedDays), MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);

    if (today.isBefore(filters.from())) {
      return unavailable(currency, actual, workedDays, elapsedEligibleDays, remainingEligibleDays, observedWorkFrequency, expectedRemainingWorkedDays, todayIncluded, mode.name(), entryCount, average, ForecastUnavailableReason.FUTURE_PERIOD);
    }
    if (today.isAfter(filters.to())) {
      return unavailable(currency, actual, workedDays, elapsedEligibleDays, remainingEligibleDays, observedWorkFrequency, expectedRemainingWorkedDays, todayIncluded, mode.name(), entryCount, average, ForecastUnavailableReason.COMPLETED_PERIOD);
    }
    if (workedDays < 3 && entryCount < 5) {
      return unavailable(currency, actual, workedDays, elapsedEligibleDays, remainingEligibleDays, observedWorkFrequency, expectedRemainingWorkedDays, todayIncluded, mode.name(), entryCount, average, ForecastUnavailableReason.INSUFFICIENT_DATA);
    }
    LocalDate recentWindowStart = asOf.minusDays(13).isBefore(filters.from()) ? filters.from() : asOf.minusDays(13);
    LocalDate recentWindowEnd = asOf;
    List<WorkEntry> recentEntries = entriesInRange(currencyEntries, recentWindowStart, recentWindowEnd);
    List<LocalDate> recentEligibleDates = eligibleDates(userId, recentWindowStart, recentWindowEnd, currencyEntries, mode);
    int recentWorkedDays = distinctWorkedDays(recentEntries);
    BigDecimal recentWorkFrequency =
        recentEligibleDates.isEmpty()
            ? BigDecimal.ZERO.setScale(SCALE)
            : BigDecimal.valueOf(recentWorkedDays)
                .divide(BigDecimal.valueOf(recentEligibleDates.size()), MATH_CONTEXT)
                .min(BigDecimal.ONE)
                .setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal paceBase =
        mode == ForecastMode.RECENT_PACE
            ? recentEligibleDates.isEmpty()
                ? BigDecimal.ZERO.setScale(SCALE)
                : grossByCurrency(recentEntries).stream()
                    .filter(amount -> amount.currency().equals(currency))
                    .findFirst()
                    .map(MoneyAmountResponse::amount)
                    .orElse(BigDecimal.ZERO.setScale(SCALE))
                    .divide(BigDecimal.valueOf(recentEligibleDates.size()), MATH_CONTEXT)
                    .setScale(SCALE, RoundingMode.HALF_UP)
            : elapsedEligibleDays == 0
                ? BigDecimal.ZERO.setScale(SCALE)
                : actual.divide(BigDecimal.valueOf(elapsedEligibleDays), MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal projected = actual.add(paceBase.multiply(BigDecimal.valueOf(remainingEligibleDays), MATH_CONTEXT)).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal stdDev = dailyGrossStdDev(currencyEntries, currency, mode == ForecastMode.RECENT_PACE ? recentEligibleDates : elapsedDates);
    BigDecimal range = stdDev.multiply(BigDecimal.valueOf(Math.sqrt(Math.max(remainingEligibleDays, 1))), MATH_CONTEXT)
        .setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal lower = projected.subtract(range).max(BigDecimal.ZERO).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal upper = projected.add(range).setScale(SCALE, RoundingMode.HALF_UP);
    return new StatisticsForecastItemResponse(
        currency,
        actual,
        projected,
        lower,
        upper,
        workedDays,
        elapsedEligibleDays,
        remainingEligibleDays,
        observedWorkFrequency,
        expectedRemainingWorkedDays,
        todayIncluded,
        mode == ForecastMode.RECENT_PACE ? "RECENT_ELIGIBLE_DAY_PACE" : mode == ForecastMode.WORKDAY_PACE ? "OBSERVED_WORKDAY_FREQUENCY" : "CALENDAR_DAY_PACE",
        entryCount,
        mode == ForecastMode.RECENT_PACE ? recentWindowStart : null,
        mode == ForecastMode.RECENT_PACE ? recentWindowEnd : null,
        mode == ForecastMode.RECENT_PACE ? recentEligibleDates.size() : 0,
        mode == ForecastMode.RECENT_PACE ? recentWorkedDays : 0,
        mode == ForecastMode.RECENT_PACE ? recentWorkFrequency : BigDecimal.ZERO.setScale(SCALE),
        average,
        forecastConfidence(filters, workedDays, stdDev, average, today),
        true,
        null);
  }

  private StatisticsForecastItemResponse unavailable(
      String currency,
      BigDecimal actual,
      int workedDays,
      int elapsedEligibleDays,
      int remainingEligibleDays,
      BigDecimal observedWorkFrequency,
      BigDecimal expectedRemainingWorkedDays,
      boolean todayIncluded,
      String calculationBasis,
      int sampleSize,
      BigDecimal average,
      ForecastUnavailableReason reason) {
    return new StatisticsForecastItemResponse(
        currency,
        actual,
        BigDecimal.ZERO.setScale(SCALE),
        BigDecimal.ZERO.setScale(SCALE),
        BigDecimal.ZERO.setScale(SCALE),
        workedDays,
        elapsedEligibleDays,
        remainingEligibleDays,
        observedWorkFrequency,
        expectedRemainingWorkedDays,
        todayIncluded,
        calculationBasis,
        sampleSize,
        null,
        null,
        0,
        0,
        BigDecimal.ZERO.setScale(SCALE),
        average,
        StatisticsConfidence.LOW,
        false,
        reason);
  }

  private List<LocalDate> eligibleDates(UUID userId, LocalDate from, LocalDate to, List<WorkEntry> entries, ForecastMode mode) {
    if (to.isBefore(from)) {
      return List.of();
    }
    Set<LocalDate> absenceDays = absenceDates(userId, from, to);
    Set<DayOfWeek> workedWeekdays = entries.stream().map(entry -> entry.getWorkDate().getDayOfWeek()).collect(LinkedHashSet::new, Set::add, Set::addAll);
    boolean weekendWorker = workedWeekdays.contains(DayOfWeek.SATURDAY) || workedWeekdays.contains(DayOfWeek.SUNDAY);
    List<LocalDate> dates = new ArrayList<>();
    LocalDate cursor = from;
    while (!cursor.isAfter(to)) {
      boolean weekend = cursor.getDayOfWeek() == DayOfWeek.SATURDAY || cursor.getDayOfWeek() == DayOfWeek.SUNDAY;
      if ((mode == ForecastMode.CALENDAR_PACE || !weekend || weekendWorker) && !absenceDays.contains(cursor)) {
        dates.add(cursor);
      }
      cursor = cursor.plusDays(1);
    }
    return dates;
  }

  private BigDecimal dailyGrossStdDev(List<WorkEntry> entries, String currency, List<LocalDate> eligibleDates) {
    Map<LocalDate, BigDecimal> daily = new LinkedHashMap<>();
    for (LocalDate date : eligibleDates) {
      daily.put(date, BigDecimal.ZERO.setScale(SCALE));
    }
    for (WorkEntry entry : entries) {
      if (entry.getCurrencySnapshot().equals(currency) && daily.containsKey(entry.getWorkDate())) {
        daily.merge(entry.getWorkDate(), entry.getGrossAmount(), BigDecimal::add);
      }
    }
    if (daily.size() <= 1) {
      return BigDecimal.ZERO.setScale(SCALE);
    }
    double average = daily.values().stream().mapToDouble(BigDecimal::doubleValue).average().orElse(0);
    double variance = daily.values().stream().mapToDouble(value -> Math.pow(value.doubleValue() - average, 2)).sum() / daily.size();
    return BigDecimal.valueOf(Math.sqrt(variance)).setScale(SCALE, RoundingMode.HALF_UP);
  }

  private StatisticsConfidence forecastConfidence(
      StatisticsFilters filters, int workedDays, BigDecimal stdDev, BigDecimal average, LocalDate today) {
    long elapsed = ChronoUnit.DAYS.between(filters.from(), today) + 1;
    long total = ChronoUnit.DAYS.between(filters.from(), filters.to()) + 1;
    BigDecimal variation =
        average.signum() == 0 ? BigDecimal.ONE : stdDev.divide(average, MATH_CONTEXT).abs();
    if (workedDays < 5 || elapsed * 4 < total) {
      return StatisticsConfidence.LOW;
    }
    if (elapsed * 2 >= total && variation.compareTo(BigDecimal.valueOf(0.25)) <= 0) {
      return StatisticsConfidence.HIGH;
    }
    return StatisticsConfidence.MEDIUM;
  }

  private List<UnitEntryItem> unitItems(List<WorkEntry> entries, Collection<UUID> unitTypeIds) {
    if (entries.isEmpty()) {
      return List.of();
    }
    List<UUID> entryIds = entries.stream().map(WorkEntry::getId).toList();
    List<UUID> selectedUnitTypes = normalize(unitTypeIds);
    return unitEntryItemRepository.findAllByWorkEntryIdIn(entryIds).stream()
        .filter(item -> selectedUnitTypes.isEmpty() || selectedUnitTypes.contains(item.getUnitType().getId()))
        .toList();
  }

  private ProductivityTotals productivityTotals(List<UnitEntryItem> items) {
    BigDecimal totalUnits = items.stream().map(UnitEntryItem::getQuantity).reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal equivalentMinutes = items.stream().map(UnitEntryItem::getCalculatedMinutes).reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal configuredUnitsPerHour = equivalentMinutes.signum() == 0
        ? BigDecimal.ZERO.setScale(SCALE)
        : totalUnits.multiply(BigDecimal.valueOf(60), MATH_CONTEXT).divide(equivalentMinutes, MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);
    return new ProductivityTotals(totalUnits, equivalentMinutes, configuredUnitsPerHour);
  }

  private List<StatisticsProductivityUnitTypeResponse> productivityUnitTypes(List<UnitEntryItem> items, BigDecimal totalUnits) {
    Map<UUID, List<UnitEntryItem>> grouped = new LinkedHashMap<>();
    for (UnitEntryItem item : items) {
      grouped.computeIfAbsent(item.getUnitType().getId(), ignored -> new ArrayList<>()).add(item);
    }
    return grouped.values().stream()
        .map(group -> productivityUnitType(group, totalUnits))
        .sorted(Comparator.comparing(StatisticsProductivityUnitTypeResponse::totalQuantity).reversed())
        .toList();
  }

  private StatisticsProductivityUnitTypeResponse productivityUnitType(List<UnitEntryItem> items, BigDecimal allUnits) {
    UnitEntryItem first = items.getFirst();
    ProductivityTotals totals = productivityTotals(items);
    BigDecimal percentage = allUnits.signum() == 0
        ? BigDecimal.ZERO.setScale(2)
        : totals.totalUnits().multiply(BigDecimal.valueOf(100), MATH_CONTEXT).divide(allUnits, MATH_CONTEXT).setScale(2, RoundingMode.HALF_UP);
    return new StatisticsProductivityUnitTypeResponse(
        first.getUnitType().getId(),
        first.getUnitNameSnapshot(),
        first.getWorkEntry().getWorkTypeNameSnapshot(),
        totals.totalUnits(),
        totals.equivalentMinutes(),
        null,
        totals.configuredUnitsPerHour(),
        null,
        null,
        false,
        (int) items.stream().map(item -> item.getWorkEntry().getId()).distinct().count(),
        percentage);
  }

  private List<StatisticsProductivityPointResponse> productivityPoints(
      LocalDate from,
      LocalDate to,
      StatisticsGranularity granularity,
      ProductivityGrouping grouping,
      List<WorkEntry> entries,
      List<UnitEntryItem> items,
      ProductivityMetric metric) {
    Map<UUID, WorkEntry> entriesById = new HashMap<>();
    for (WorkEntry entry : entries) {
      entriesById.put(entry.getId(), entry);
    }
    List<StatisticsProductivityPointResponse> points = new ArrayList<>();
    if (grouping == ProductivityGrouping.TOTAL) {
      ProductivityTotals totals = productivityTotals(items);
      BigDecimal value =
          switch (metric) {
            case TOTAL_UNITS -> totals.totalUnits();
            case CONFIGURED_UNITS_PER_HOUR -> totals.configuredUnitsPerHour();
            case EQUIVALENT_MINUTES -> totals.equivalentMinutes();
          };
      points.add(new StatisticsProductivityPointResponse(from, to, value, metric, !items.isEmpty()));
      return points;
    }
    for (Bucket bucket : completeBuckets(from, to, granularity)) {
      List<UnitEntryItem> bucketItems = items.stream()
          .filter(item -> {
            WorkEntry entry = entriesById.get(item.getWorkEntry().getId());
            return entry != null && !entry.getWorkDate().isBefore(bucket.start()) && !entry.getWorkDate().isAfter(bucket.end());
          })
          .toList();
      ProductivityTotals totals = productivityTotals(bucketItems);
      BigDecimal value =
          switch (metric) {
            case TOTAL_UNITS -> totals.totalUnits();
            case CONFIGURED_UNITS_PER_HOUR -> totals.configuredUnitsPerHour();
            case EQUIVALENT_MINUTES -> totals.equivalentMinutes();
          };
      points.add(new StatisticsProductivityPointResponse(bucket.start(), bucket.end(), value, metric, !bucketItems.isEmpty()));
    }
    return points;
  }

  private List<StatisticsHighlightResponse> highlightItems(List<WorkEntry> entries) {
    if (entries.isEmpty()) {
      return List.of();
    }
    List<StatisticsHighlightResponse> highlights = new ArrayList<>();
    Map<String, Map<LocalDate, BigDecimal>> grossByCurrencyAndDate = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      grossByCurrencyAndDate
          .computeIfAbsent(entry.getCurrencySnapshot(), ignored -> new LinkedHashMap<>())
          .merge(entry.getWorkDate(), entry.getGrossAmount(), BigDecimal::add);
    }
    grossByCurrencyAndDate.entrySet().stream()
        .sorted(Map.Entry.comparingByKey())
        .forEach(
            currencyEntry ->
                currencyEntry.getValue().entrySet().stream()
                    .max(
                        Comparator
                            .<Map.Entry<LocalDate, BigDecimal>, BigDecimal>comparing(Map.Entry::getValue)
                            .thenComparing(Map.Entry::getKey, Comparator.reverseOrder()))
                    .ifPresent(
                        dateEntry ->
                            highlights.add(
                                new StatisticsHighlightResponse(
                                    HighlightType.BEST_GROSS_DAY,
                                    true,
                                    null,
                                    null,
                                    dateEntry.getKey(),
                                    dateEntry.getKey(),
                                    dateEntry.getValue().setScale(SCALE, RoundingMode.HALF_UP),
                                    currencyEntry.getKey(),
                                    List.of(new MoneyAmountResponse(currencyEntry.getKey(), dateEntry.getValue().setScale(SCALE, RoundingMode.HALF_UP)))))));
    entriesByDate(entries).entrySet().stream()
        .max(Comparator.comparing(entry -> sumMinutes(entry.getValue())))
        .ifPresent(entry -> highlights.add(new StatisticsHighlightResponse(HighlightType.BEST_HOURS_DAY, true, null, null, entry.getKey(), entry.getKey(), sumMinutes(entry.getValue()), null, grossByCurrency(entry.getValue()))));
    entries.stream()
        .max(Comparator.comparing(WorkEntry::getCalculatedMinutes))
        .ifPresent(entry -> highlights.add(new StatisticsHighlightResponse(HighlightType.LONGEST_SHIFT, true, entry.getWorkTypeNameSnapshot(), null, entry.getWorkDate(), entry.getWorkDate(), entry.getCalculatedMinutes(), null, List.of())));
    BigDecimal averageShift = entries.isEmpty() ? BigDecimal.ZERO.setScale(SCALE) : sumMinutes(entries).divide(BigDecimal.valueOf(entries.size()), MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);
    highlights.add(new StatisticsHighlightResponse(HighlightType.AVERAGE_SHIFT, true, null, null, null, null, averageShift, null, List.of()));
    workTypeBreakdown(entries).stream().findFirst().ifPresent(item -> highlights.add(new StatisticsHighlightResponse(HighlightType.MOST_USED_WORK_TYPE, true, item.name(), null, null, null, item.minutes(), null, item.grossByCurrency())));
    busiestWeekday(entries).ifPresent(item -> highlights.add(item));
    Streaks streaks = streaks(entries);
    highlights.add(new StatisticsHighlightResponse(HighlightType.CURRENT_STREAK, true, null, null, streaks.currentStart(), streaks.currentEnd(), BigDecimal.valueOf(streaks.currentLength()).setScale(SCALE), null, List.of()));
    highlights.add(new StatisticsHighlightResponse(HighlightType.LONGEST_STREAK, true, null, null, streaks.longestStart(), streaks.longestEnd(), BigDecimal.valueOf(streaks.longestLength()).setScale(SCALE), null, List.of()));
    long weekends = entries.stream().filter(entry -> entry.getWorkDate().getDayOfWeek() == DayOfWeek.SATURDAY || entry.getWorkDate().getDayOfWeek() == DayOfWeek.SUNDAY).count();
    highlights.add(new StatisticsHighlightResponse(HighlightType.WEEKEND_WORK_COUNT, true, null, null, null, null, BigDecimal.valueOf(weekends).setScale(SCALE), null, List.of()));
    highlights.add(new StatisticsHighlightResponse(HighlightType.OVERNIGHT_SHIFT_COUNT, true, null, null, null, null, BigDecimal.valueOf(overnightShiftCount(entries)).setScale(SCALE), null, List.of()));
    return highlights;
  }

  private BigDecimal sumGross(List<WorkEntry> entries) {
    return entries.stream().map(WorkEntry::getGrossAmount).reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add).setScale(SCALE, RoundingMode.HALF_UP);
  }

  private java.util.Optional<StatisticsHighlightResponse> busiestWeekday(List<WorkEntry> entries) {
    Map<DayOfWeek, List<WorkEntry>> byWeekday = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      byWeekday.computeIfAbsent(entry.getWorkDate().getDayOfWeek(), ignored -> new ArrayList<>()).add(entry);
    }
    return byWeekday.entrySet().stream()
        .max(
            Comparator
                .<Map.Entry<DayOfWeek, List<WorkEntry>>, BigDecimal>comparing(entry -> sumMinutes(entry.getValue()))
                .thenComparing(entry -> entry.getKey().getValue(), Comparator.reverseOrder()))
        .map(
            entry ->
                new StatisticsHighlightResponse(
                    HighlightType.BUSIEST_WEEKDAY,
                    true,
                    entry.getKey().name(),
                    null,
                    null,
                    null,
                    sumMinutes(entry.getValue()),
                    null,
                    grossByCurrency(entry.getValue())));
  }

  private long overnightShiftCount(List<WorkEntry> entries) {
    List<UUID> entryIds =
        entries.stream()
            .filter(entry -> entry.getCalculationMethodSnapshot() == CalculationMethod.TIME_BASED)
            .map(WorkEntry::getId)
            .toList();
    if (entryIds.isEmpty()) {
      return 0;
    }
    return timeEntryDetailsRepository.findAllByWorkEntryIdIn(entryIds).stream()
        .filter(detail -> !detail.getEndTime().isAfter(detail.getStartTime()))
        .count();
  }

  private Streaks streaks(List<WorkEntry> entries) {
    List<LocalDate> dates = entries.stream().map(WorkEntry::getWorkDate).distinct().sorted().toList();
    if (dates.isEmpty()) {
      return new Streaks(0, null, null, 0, null, null);
    }
    int longest = 1;
    LocalDate longestStart = dates.getFirst();
    LocalDate longestEnd = dates.getFirst();
    int current = 1;
    LocalDate currentStart = dates.getFirst();
    for (int i = 1; i < dates.size(); i++) {
      if (dates.get(i).equals(dates.get(i - 1).plusDays(1))) {
        current++;
      } else {
        current = 1;
        currentStart = dates.get(i);
      }
      if (current > longest) {
        longest = current;
        longestStart = currentStart;
        longestEnd = dates.get(i);
      }
    }
    int trailing = 1;
    LocalDate trailingStart = dates.getLast();
    for (int i = dates.size() - 2; i >= 0; i--) {
      if (dates.get(i).plusDays(1).equals(dates.get(i + 1))) {
        trailing++;
        trailingStart = dates.get(i);
      } else {
        break;
      }
    }
    LocalDate lastWorkedDay = dates.getLast();
    LocalDate today = LocalDate.now(clock);
    boolean currentStreakIsActive = lastWorkedDay.equals(today) || lastWorkedDay.equals(today.minusDays(1));
    return new Streaks(
        currentStreakIsActive ? trailing : 0,
        currentStreakIsActive ? trailingStart : null,
        currentStreakIsActive ? lastWorkedDay : null,
        longest,
        longestStart,
        longestEnd);
  }

  private void addChangeInsight(
      List<StatisticsInsightResponse> insights,
      InsightType type,
      String currency,
      BigDecimal current,
      BigDecimal previous,
      BigDecimal divisor) {
    if (previous.signum() <= 0 || current.signum() <= 0) {
      return;
    }
    BigDecimal currentValue = current.divide(divisor, MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal previousValue = previous.divide(divisor, MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);
    BigDecimal percentage = current.subtract(previous).multiply(BigDecimal.valueOf(100), MATH_CONTEXT).divide(previous, MATH_CONTEXT).setScale(2, RoundingMode.HALF_UP);
    insights.add(new StatisticsInsightResponse(type, comparisonDirection(current, previous), percentage, currentValue, previousValue, currency, null, percentage.signum() >= 0 ? InsightSeverity.POSITIVE : InsightSeverity.ATTENTION, StatisticsConfidence.MEDIUM));
  }

  private void addWorkedDaysInsight(List<StatisticsInsightResponse> insights, List<WorkEntry> current, List<WorkEntry> previous) {
    BigDecimal currentDays = BigDecimal.valueOf(distinctWorkedDays(current)).setScale(SCALE);
    BigDecimal previousDays = BigDecimal.valueOf(distinctWorkedDays(previous)).setScale(SCALE);
    addChangeInsight(insights, InsightType.WORKED_DAYS_CHANGE, null, currentDays, previousDays, BigDecimal.ONE);
  }

  private void addBestWeekdayInsight(List<StatisticsInsightResponse> insights, List<WorkEntry> entries) {
    Map<DayOfWeek, List<WorkEntry>> byWeekday = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      byWeekday.computeIfAbsent(entry.getWorkDate().getDayOfWeek(), ignored -> new ArrayList<>()).add(entry);
    }
    byWeekday.entrySet().stream()
        .filter(entry -> distinctWorkedDays(entry.getValue()) >= 2)
        .max(
            Comparator
                .<Map.Entry<DayOfWeek, List<WorkEntry>>, BigDecimal>comparing(
                    entry -> sumMinutes(entry.getValue()).divide(BigDecimal.valueOf(distinctWorkedDays(entry.getValue())), MATH_CONTEXT))
                .thenComparing(entry -> entry.getKey().getValue(), Comparator.reverseOrder()))
        .ifPresent(
            entry ->
                insights.add(
                    new StatisticsInsightResponse(
                        InsightType.BEST_WEEKDAY,
                        ComparisonDirection.FLAT,
                        null,
                        sumMinutes(entry.getValue())
                            .divide(BigDecimal.valueOf(distinctWorkedDays(entry.getValue())), MATH_CONTEXT)
                            .divide(BigDecimal.valueOf(60), MATH_CONTEXT)
                            .setScale(SCALE, RoundingMode.HALF_UP),
                        BigDecimal.valueOf(distinctWorkedDays(entry.getValue())).setScale(SCALE),
                        null,
                        entry.getKey().name(),
                        InsightSeverity.NEUTRAL,
                        distinctWorkedDays(entry.getValue()) >= 4 ? StatisticsConfidence.HIGH : StatisticsConfidence.MEDIUM)));
  }

  private void addMostUsedWorkTypeInsight(List<StatisticsInsightResponse> insights, List<WorkEntry> entries) {
    if (entries.size() < 3) {
      return;
    }
    workTypeBreakdown(entries).stream().findFirst()
        .ifPresent(item -> insights.add(new StatisticsInsightResponse(InsightType.MOST_USED_WORK_TYPE, ComparisonDirection.FLAT, null, item.minutes(), null, null, item.name(), InsightSeverity.NEUTRAL, StatisticsConfidence.MEDIUM)));
  }

  private int insightScore(StatisticsInsightResponse insight) {
    int confidence =
        switch (insight.confidence()) {
          case HIGH -> 300;
          case MEDIUM -> 200;
          case LOW -> 100;
        };
    int severity =
        switch (insight.severity()) {
          case POSITIVE, ATTENTION -> 30;
          case NEUTRAL -> 10;
        };
    int priority =
        switch (insight.type()) {
          case HOURS_CHANGE -> 60;
          case GROSS_CHANGE -> 55;
          case WORKED_DAYS_CHANGE -> 50;
          case AVERAGE_SHIFT_CHANGE -> 45;
          case FORECAST_ABOVE_PREVIOUS_PERIOD, FORECAST_BELOW_PREVIOUS_PERIOD -> 40;
          case BEST_WEEKDAY -> 30;
          case MOST_USED_WORK_TYPE -> 20;
          case STREAK -> 10;
        };
    int magnitude = insight.percentage() == null ? 0 : insight.percentage().abs().min(BigDecimal.valueOf(100)).intValue();
    return confidence + severity + priority + magnitude;
  }

  private List<WorkEntry> findEntries(UUID userId, StatisticsFilters filters) {
    return findEntries(userId, filters, filters.from(), filters.to());
  }

  private List<WorkEntry> entriesInRange(List<WorkEntry> entries, LocalDate from, LocalDate to) {
    if (to.isBefore(from)) {
      return List.of();
    }
    return entries.stream()
        .filter(entry -> !entry.getWorkDate().isBefore(from) && !entry.getWorkDate().isAfter(to))
        .toList();
  }

  private void validateComparisonRequest(StatisticsComparisonRequest request) {
    if (request == null || request.periodA() == null || request.periodB() == null || request.metric() == null) {
      throw new ValidationException(
          "comparison request is incomplete", StatisticsErrorCode.STATISTICS_INVALID_COMPARISON_RANGE.name());
    }
    validateComparisonPeriod(request.periodA());
    validateComparisonPeriod(request.periodB());
  }

  private void validateComparisonPeriod(StatisticsPeriodRequest period) {
    try {
      validateRange(period.from(), period.to());
    } catch (ValidationException exception) {
      throw new ValidationException(
          "comparison period is invalid", StatisticsErrorCode.STATISTICS_INVALID_COMPARISON_RANGE.name());
    }
  }

  private List<WorkEntry> findEntries(UUID userId, StatisticsFilters filters, LocalDate from, LocalDate to) {
    validateRange(from, to);
    List<UUID> workTypeIds = normalize(filters.workTypeIds());
    List<CalculationMethod> methods = normalize(filters.calculationMethods());
    return statisticsRepository.findFiltered(
        userId,
        from,
        to,
        workTypeIds,
        workTypeIds.isEmpty(),
        methods,
        methods.isEmpty());
  }

  private void validateRange(LocalDate from, LocalDate to) {
    if (from == null || to == null) {
      throw invalidRange("from and to are required");
    }
    if (to.isBefore(from)) {
      throw invalidRange("to must be on or after from");
    }
    if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_RANGE_DAYS) {
      throw invalidRange("date range is too large");
    }
  }

  private ValidationException invalidRange(String message) {
    return new ValidationException(message, StatisticsErrorCode.STATISTICS_INVALID_DATE_RANGE.name());
  }

  private <T> List<T> normalize(Collection<T> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    return values.stream().distinct().toList();
  }

  private BigDecimal sumMinutes(List<WorkEntry> entries) {
    return entries.stream()
        .map(WorkEntry::getCalculatedMinutes)
        .reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add)
        .setScale(SCALE, RoundingMode.HALF_UP);
  }

  private StatisticsPeriodTotalsResponse totals(LocalDate from, LocalDate to, List<WorkEntry> entries) {
    int workedDays = distinctWorkedDays(entries);
    BigDecimal workedMinutes = sumMinutes(entries);
    BigDecimal averageMinutesPerWorkedDay =
        workedDays == 0
            ? BigDecimal.ZERO.setScale(SCALE)
            : workedMinutes
                .divide(BigDecimal.valueOf(workedDays), MATH_CONTEXT)
                .setScale(SCALE, RoundingMode.HALF_UP);
    return new StatisticsPeriodTotalsResponse(
        from, to, workedMinutes, workedDays, entries.size(), grossByCurrency(entries), averageMinutesPerWorkedDay);
  }

  private int distinctWorkedDays(List<WorkEntry> entries) {
    return (int) entries.stream().map(WorkEntry::getWorkDate).distinct().count();
  }

  private List<MoneyAmountResponse> grossByCurrency(List<WorkEntry> entries) {
    Map<String, BigDecimal> totals = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      totals.merge(entry.getCurrencySnapshot(), entry.getGrossAmount(), BigDecimal::add);
    }
    return totals.entrySet().stream()
        .map(item -> new MoneyAmountResponse(item.getKey(), item.getValue().setScale(SCALE, RoundingMode.HALF_UP)))
        .toList();
  }

  private List<String> currenciesFor(List<WorkEntry> entries) {
    return entries.stream().map(WorkEntry::getCurrencySnapshot).distinct().sorted().toList();
  }

  private StatisticsComparisonResponse comparison(List<WorkEntry> currentEntries, List<WorkEntry> previousEntries) {
    List<MoneyAmountResponse> currentGross = grossByCurrency(currentEntries);
    List<MoneyAmountResponse> previousGross = grossByCurrency(previousEntries);
    if (currentGross.isEmpty() && previousGross.isEmpty()) {
      return new StatisticsComparisonResponse(false, null, ComparisonDirection.NO_DATA, grossByCurrency(previousEntries));
    }
    if (previousGross.isEmpty()) {
      return new StatisticsComparisonResponse(false, null, ComparisonDirection.NEW, grossByCurrency(previousEntries));
    }
    if (currentGross.size() != 1 || previousGross.size() != 1 || !currentGross.getFirst().currency().equals(previousGross.getFirst().currency())) {
      return new StatisticsComparisonResponse(false, null, ComparisonDirection.NO_DATA, previousGross);
    }
    BigDecimal current = currentGross.getFirst().amount();
    BigDecimal previous = previousGross.getFirst().amount();
    if (previous.signum() == 0) {
      return new StatisticsComparisonResponse(false, null, ComparisonDirection.NEW, previousGross);
    }
    BigDecimal percentage =
        current
            .subtract(previous)
            .multiply(BigDecimal.valueOf(100), MATH_CONTEXT)
            .divide(previous, MATH_CONTEXT)
            .setScale(2, RoundingMode.HALF_UP);
    return new StatisticsComparisonResponse(true, percentage, comparisonDirection(current, previous), previousGross);
  }

  private List<StatisticsComparisonDifferenceResponse> comparisonDifferences(
      List<WorkEntry> entriesA,
      List<WorkEntry> entriesB,
      StatisticsPeriodTotalsResponse totalsA,
      StatisticsPeriodTotalsResponse totalsB,
      StatisticsMetric metric) {
    if (metric == StatisticsMetric.GROSS) {
      Map<String, BigDecimal> aByCurrency = moneyMap(totalsA.grossByCurrency());
      Map<String, BigDecimal> bByCurrency = moneyMap(totalsB.grossByCurrency());
      Set<String> currencies = new LinkedHashSet<>();
      currencies.addAll(aByCurrency.keySet());
      currencies.addAll(bByCurrency.keySet());
      return currencies.stream()
          .sorted()
          .map(
              currency ->
                  difference(
                      currency,
                      aByCurrency.getOrDefault(currency, BigDecimal.ZERO.setScale(SCALE)),
                      bByCurrency.getOrDefault(currency, BigDecimal.ZERO.setScale(SCALE))))
          .toList();
    }
    return List.of(difference(null, aggregateMetric(entriesA, metric), aggregateMetric(entriesB, metric)));
  }

  private StatisticsComparisonDifferenceResponse difference(String currency, BigDecimal periodA, BigDecimal periodB) {
    BigDecimal absolute = periodA.subtract(periodB).setScale(SCALE, RoundingMode.HALF_UP);
    if (periodA.signum() == 0 && periodB.signum() == 0) {
      return new StatisticsComparisonDifferenceResponse(
          currency, periodA, periodB, absolute, null, ComparisonDirection.NO_DATA, false);
    }
    if (periodB.signum() == 0) {
      return new StatisticsComparisonDifferenceResponse(
          currency, periodA, periodB, absolute, null, ComparisonDirection.NEW, false);
    }
    BigDecimal percentage =
        absolute
            .multiply(BigDecimal.valueOf(100), MATH_CONTEXT)
            .divide(periodB, MATH_CONTEXT)
            .setScale(2, RoundingMode.HALF_UP);
    return new StatisticsComparisonDifferenceResponse(
        currency, periodA, periodB, absolute, percentage, comparisonDirection(periodA, periodB), true);
  }

  private StatisticsComparisonSeriesResponse comparisonSeries(
      StatisticsFilters filtersA,
      StatisticsFilters filtersB,
      List<WorkEntry> entriesA,
      List<WorkEntry> entriesB,
      StatisticsMetric metric) {
    StatisticsGranularity granularity = comparisonGranularity(filtersA, filtersB);
    StatisticsComparisonAlignment alignment = comparisonAlignment(filtersA, filtersB, granularity);
    List<Bucket> bucketsA = completeBuckets(filtersA.from(), filtersA.to(), granularity);
    List<Bucket> bucketsB = completeBuckets(filtersB.from(), filtersB.to(), granularity);
    int size = Math.max(bucketsA.size(), bucketsB.size());
    List<String> currencies =
        metric == StatisticsMetric.GROSS ? comparisonCurrencies(entriesA, entriesB) : List.of((String) null);
    List<StatisticsComparisonSeriesPointResponse> points = new ArrayList<>();
    for (String currency : currencies) {
      for (int index = 0; index < size; index++) {
        Bucket bucketA = index < bucketsA.size() ? bucketsA.get(index) : null;
        Bucket bucketB = index < bucketsB.size() ? bucketsB.get(index) : null;
        points.add(
            new StatisticsComparisonSeriesPointResponse(
                comparisonLabel(alignment, index, bucketA, bucketB),
                bucketA == null ? null : bucketA.start(),
                bucketA == null ? null : bucketA.end(),
                bucketB == null ? null : bucketB.start(),
                bucketB == null ? null : bucketB.end(),
                bucketA == null
                    ? BigDecimal.ZERO.setScale(SCALE)
                    : aggregateMetric(entriesInBucket(entriesA, bucketA, currency, metric), metric),
                bucketB == null
                    ? BigDecimal.ZERO.setScale(SCALE)
                    : aggregateMetric(entriesInBucket(entriesB, bucketB, currency, metric), metric),
                currency));
      }
    }
    return new StatisticsComparisonSeriesResponse(alignment, granularity, points);
  }

  private StatisticsGranularity comparisonGranularity(StatisticsFilters filtersA, StatisticsFilters filtersB) {
    long longest =
        Math.max(
            ChronoUnit.DAYS.between(filtersA.from(), filtersA.to()) + 1,
            ChronoUnit.DAYS.between(filtersB.from(), filtersB.to()) + 1);
    if (longest <= 31) {
      return StatisticsGranularity.DAILY;
    }
    if (longest <= 370) {
      return StatisticsGranularity.WEEKLY;
    }
    return StatisticsGranularity.MONTHLY;
  }

  private StatisticsComparisonAlignment comparisonAlignment(
      StatisticsFilters filtersA, StatisticsFilters filtersB, StatisticsGranularity granularity) {
    long daysA = ChronoUnit.DAYS.between(filtersA.from(), filtersA.to()) + 1;
    long daysB = ChronoUnit.DAYS.between(filtersB.from(), filtersB.to()) + 1;
    if (daysA == 7 && daysB == 7) {
      return StatisticsComparisonAlignment.DAY_OF_WEEK;
    }
    if (granularity == StatisticsGranularity.MONTHLY) {
      return StatisticsComparisonAlignment.MONTH_OF_YEAR;
    }
    if (daysA == daysB && granularity == StatisticsGranularity.DAILY) {
      return StatisticsComparisonAlignment.RELATIVE_DAY;
    }
    if (daysA == daysB) {
      return StatisticsComparisonAlignment.RELATIVE_WEEK;
    }
    return StatisticsComparisonAlignment.CALENDAR_BUCKET;
  }

  private String comparisonLabel(
      StatisticsComparisonAlignment alignment, int index, Bucket bucketA, Bucket bucketB) {
    if (alignment == StatisticsComparisonAlignment.DAY_OF_WEEK) {
      return DayOfWeek.of(index + 1).name();
    }
    if (alignment == StatisticsComparisonAlignment.MONTH_OF_YEAR) {
      Bucket source = bucketA == null ? bucketB : bucketA;
      return source == null ? String.valueOf(index + 1) : source.start().getMonth().name();
    }
    return String.valueOf(index + 1);
  }

  private List<WorkEntry> entriesInBucket(
      List<WorkEntry> entries, Bucket bucket, String currency, StatisticsMetric metric) {
    return entries.stream()
        .filter(entry -> !entry.getWorkDate().isBefore(bucket.start()) && !entry.getWorkDate().isAfter(bucket.end()))
        .filter(entry -> metric != StatisticsMetric.GROSS || entry.getCurrencySnapshot().equals(currency))
        .toList();
  }

  private Map<String, BigDecimal> moneyMap(List<MoneyAmountResponse> amounts) {
    Map<String, BigDecimal> result = new LinkedHashMap<>();
    for (MoneyAmountResponse amount : amounts) {
      result.put(amount.currency(), amount.amount());
    }
    return result;
  }

  private BigDecimal aggregateMetric(List<WorkEntry> entries, StatisticsMetric metric) {
    if (metric == StatisticsMetric.WORKED_DAYS) {
      return BigDecimal.valueOf(distinctWorkedDays(entries)).setScale(SCALE);
    }
    if (metric == StatisticsMetric.AVERAGE_MINUTES_PER_WORKED_DAY) {
      return totals(null, null, entries).averageMinutesPerWorkedDay();
    }
    return entries.stream()
        .map(entry -> metricValue(entry, metric))
        .reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add)
        .setScale(SCALE, RoundingMode.HALF_UP);
  }

  private List<String> comparisonCurrencies(List<WorkEntry> entriesA, List<WorkEntry> entriesB) {
    Set<String> currencies = new LinkedHashSet<>();
    currencies.addAll(currenciesFor(entriesA));
    currencies.addAll(currenciesFor(entriesB));
    return currencies.stream().sorted().toList();
  }

  private Map<LocalDate, List<WorkEntry>> entriesByDate(List<WorkEntry> entries) {
    Map<LocalDate, List<WorkEntry>> result = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      result.computeIfAbsent(entry.getWorkDate(), ignored -> new ArrayList<>()).add(entry);
    }
    return result;
  }

  private Set<LocalDate> absenceDates(UUID userId, LocalDate from, LocalDate to) {
    Set<LocalDate> result = new LinkedHashSet<>();
    for (Absence absence :
        absenceRepository.findAllByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(userId, to, from)) {
      LocalDate start = absence.getStartDate().isBefore(from) ? from : absence.getStartDate();
      LocalDate end = absence.getEndDate().isAfter(to) ? to : absence.getEndDate();
      for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
        result.add(date);
      }
    }
    return result;
  }

  private List<StatisticsWorkTypeResponse> workTypeBreakdown(List<WorkEntry> entries) {
    BigDecimal totalMinutes = sumMinutes(entries);
    Map<UUID, WorkTypeAggregate> grouped = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      WorkTypeAggregate aggregate =
          grouped.computeIfAbsent(
              entry.getWorkType().getId(),
              ignored ->
                  new WorkTypeAggregate(
                      entry.getWorkType().getId(),
                      entry.getWorkTypeNameSnapshot(),
                      entry.getCalculationMethodSnapshot()));
      aggregate.add(entry);
    }
    return grouped.values().stream()
        .sorted(Comparator.comparing(WorkTypeAggregate::minutes).reversed())
        .map(aggregate -> aggregate.toResponse(totalMinutes))
        .toList();
  }

  private ComparisonDirection comparisonDirection(BigDecimal current, BigDecimal previous) {
    int comparison = current.compareTo(previous);
    if (comparison > 0) {
      return ComparisonDirection.UP;
    }
    if (comparison < 0) {
      return ComparisonDirection.DOWN;
    }
    return ComparisonDirection.FLAT;
  }

  private Period previousPeriod(LocalDate from, LocalDate to) {
    long days = ChronoUnit.DAYS.between(from, to) + 1;
    LocalDate previousTo = from.minusDays(1);
    return new Period(previousTo.minusDays(days - 1), previousTo);
  }

  private StatisticsGranularity resolveGranularity(LocalDate from, LocalDate to) {
    long days = ChronoUnit.DAYS.between(from, to) + 1;
    if (days <= 62) {
      return StatisticsGranularity.DAILY;
    }
    if (days <= 370) {
      return StatisticsGranularity.WEEKLY;
    }
    return StatisticsGranularity.MONTHLY;
  }

  private StatisticsGranularity productivityGranularity(LocalDate from, LocalDate to, ProductivityGrouping grouping) {
    return switch (grouping) {
      case DAILY -> StatisticsGranularity.DAILY;
      case WEEKLY -> StatisticsGranularity.WEEKLY;
      case MONTHLY -> StatisticsGranularity.MONTHLY;
      case TOTAL, WORK_TYPE, UNIT_TYPE -> resolveGranularity(from, to);
    };
  }

  private void validateProductivityGrouping(ProductivityGrouping grouping) {
    if (grouping == ProductivityGrouping.WORK_TYPE || grouping == ProductivityGrouping.UNIT_TYPE) {
      throw new ValidationException(
          "productivity grouping is not supported yet",
          StatisticsErrorCode.STATISTICS_PRODUCTIVITY_INCOMPATIBLE_UNITS.name());
    }
  }

  private List<Bucket> completeBuckets(LocalDate from, LocalDate to, StatisticsGranularity granularity) {
    List<Bucket> buckets = new ArrayList<>();
    LocalDate cursor =
        switch (granularity) {
          case DAILY -> from;
          case WEEKLY -> from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
          case MONTHLY -> from.withDayOfMonth(1);
        };
    while (!cursor.isAfter(to)) {
      Bucket bucket = bucketFor(cursor, granularity, to);
      buckets.add(bucket);
      cursor =
          switch (granularity) {
            case DAILY -> cursor.plusDays(1);
            case WEEKLY -> cursor.plusWeeks(1);
            case MONTHLY -> cursor.plusMonths(1);
          };
    }
    return buckets;
  }

  private Bucket bucketFor(LocalDate date, StatisticsGranularity granularity, LocalDate rangeTo) {
    LocalDate start =
        switch (granularity) {
          case DAILY -> date;
          case WEEKLY -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
          case MONTHLY -> date.withDayOfMonth(1);
        };
    LocalDate naturalEnd =
        switch (granularity) {
          case DAILY -> start;
          case WEEKLY -> start.plusDays(6);
          case MONTHLY -> start.withDayOfMonth(start.lengthOfMonth());
        };
    return new Bucket(start, naturalEnd.isAfter(rangeTo) ? rangeTo : naturalEnd);
  }

  private BigDecimal metricValue(WorkEntry entry, StatisticsMetric metric) {
    return switch (metric) {
      case GROSS -> entry.getGrossAmount();
      case WORKED_MINUTES -> entry.getCalculatedMinutes();
      case WORKED_HOURS -> entry.getCalculatedMinutes().divide(BigDecimal.valueOf(60), MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);
      case WORKED_DAYS -> BigDecimal.ONE.setScale(SCALE);
      case ENTRIES -> BigDecimal.ONE.setScale(SCALE);
      case AVERAGE_MINUTES_PER_WORKED_DAY -> entry.getCalculatedMinutes();
    };
  }

  private StatisticsTimeSeriesPointResponse point(Bucket bucket, BigDecimal value, StatisticsMetric metric, String currency) {
    return new StatisticsTimeSeriesPointResponse(
        bucket.start(), bucket.end(), value.setScale(SCALE, RoundingMode.HALF_UP), metric, currency);
  }

  private record Period(LocalDate from, LocalDate to) {}

  private record Bucket(LocalDate start, LocalDate end) {}

  private record BucketCurrencyKey(LocalDate bucketStart, LocalDate bucketEnd, String currency) {}

  private record ProductivityTotals(
      BigDecimal totalUnits, BigDecimal equivalentMinutes, BigDecimal configuredUnitsPerHour) {}

  private record Streaks(
      int currentLength,
      LocalDate currentStart,
      LocalDate currentEnd,
      int longestLength,
      LocalDate longestStart,
      LocalDate longestEnd) {}

  private static final class WorkTypeAggregate {
    private final UUID workTypeId;
    private final String name;
    private final CalculationMethod calculationMethod;
    private final List<WorkEntry> entries = new ArrayList<>();

    private WorkTypeAggregate(UUID workTypeId, String name, CalculationMethod calculationMethod) {
      this.workTypeId = workTypeId;
      this.name = name;
      this.calculationMethod = calculationMethod;
    }

    private void add(WorkEntry entry) {
      entries.add(entry);
    }

    private BigDecimal minutes() {
      return entries.stream()
          .map(WorkEntry::getCalculatedMinutes)
          .reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add)
          .setScale(SCALE, RoundingMode.HALF_UP);
    }

    private StatisticsWorkTypeResponse toResponse(BigDecimal totalMinutes) {
      BigDecimal minutes = minutes();
      BigDecimal percentage =
          totalMinutes.signum() == 0
              ? BigDecimal.ZERO.setScale(2)
              : minutes.multiply(BigDecimal.valueOf(100), MATH_CONTEXT)
                  .divide(totalMinutes, MATH_CONTEXT)
                  .setScale(2, RoundingMode.HALF_UP);
      Map<String, BigDecimal> grossTotals = new LinkedHashMap<>();
      for (WorkEntry entry : entries) {
        grossTotals.merge(entry.getCurrencySnapshot(), entry.getGrossAmount(), BigDecimal::add);
      }
      List<MoneyAmountResponse> grossByCurrency =
          grossTotals.entrySet().stream()
              .map(item -> new MoneyAmountResponse(item.getKey(), item.getValue().setScale(SCALE, RoundingMode.HALF_UP)))
              .toList();
      return new StatisticsWorkTypeResponse(
          workTypeId,
          name,
          calculationMethod,
          minutes,
          grossByCurrency,
          percentage,
          StatisticsPercentageBasis.MINUTES,
          entries.size());
    }
  }
}
