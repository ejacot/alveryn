package com.roomly.api.statistics.service;

import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.statistics.dto.StatisticsAdvancedComparisonResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonAlignment;
import com.roomly.api.statistics.dto.StatisticsComparisonDifferenceResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonRequest;
import com.roomly.api.statistics.dto.ComparisonDirection;
import com.roomly.api.statistics.dto.MoneyAmountResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonSeriesPointResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonSeriesResponse;
import com.roomly.api.statistics.dto.StatisticsDrilldownResponse;
import com.roomly.api.statistics.dto.StatisticsFilters;
import com.roomly.api.statistics.dto.StatisticsGranularity;
import com.roomly.api.statistics.dto.StatisticsHeatmapDayResponse;
import com.roomly.api.statistics.dto.StatisticsHeatmapResponse;
import com.roomly.api.statistics.dto.StatisticsMetric;
import com.roomly.api.statistics.dto.StatisticsOverviewResponse;
import com.roomly.api.statistics.dto.StatisticsPercentageBasis;
import com.roomly.api.statistics.dto.StatisticsPeriodRequest;
import com.roomly.api.statistics.dto.StatisticsPeriodTotalsResponse;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesPointResponse;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesResponse;
import com.roomly.api.statistics.dto.StatisticsWorkTypeResponse;
import com.roomly.api.statistics.model.StatisticsErrorCode;
import com.roomly.api.statistics.repository.StatisticsRepository;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.worktype.entity.CalculationMethod;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
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
  private final AbsenceRepository absenceRepository;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;

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
  public StatisticsHeatmapResponse heatmap(StatisticsFilters filters, StatisticsMetric metric) {
    validateRange(filters.from(), filters.to());
    long days = ChronoUnit.DAYS.between(filters.from(), filters.to()) + 1;
    if (days > MAX_HEATMAP_DAYS) {
      throw new ValidationException(
          "heatmap range is too large", StatisticsErrorCode.STATISTICS_HEATMAP_RANGE_TOO_LARGE.name());
    }
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    List<String> currencies = currenciesFor(entries);
    if (metric == StatisticsMetric.GROSS && currencies.size() > 1) {
      throw new ValidationException(
          "gross heatmap requires a single currency result",
          StatisticsErrorCode.STATISTICS_GROSS_REQUIRES_CURRENCY_SELECTION.name());
    }
    Map<LocalDate, List<WorkEntry>> entriesByDate = entriesByDate(entries);
    Set<LocalDate> absenceDates = absenceDates(userId, filters.from(), filters.to());
    List<StatisticsHeatmapDayResponse> heatmapDays = new ArrayList<>();
    BigDecimal max = BigDecimal.ZERO.setScale(SCALE);
    for (LocalDate date = filters.from(); !date.isAfter(filters.to()); date = date.plusDays(1)) {
      List<WorkEntry> dayEntries = entriesByDate.getOrDefault(date, List.of());
      BigDecimal value = aggregateMetric(dayEntries, metric).setScale(SCALE, RoundingMode.HALF_UP);
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
        metric == StatisticsMetric.GROSS && currencies.size() == 1 ? currencies.getFirst() : null,
        BigDecimal.ZERO.setScale(SCALE),
        max,
        heatmapDays);
  }

  @Transactional(readOnly = true)
  public StatisticsDrilldownResponse drilldown(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    return new StatisticsDrilldownResponse(
        filters.from(), filters.to(), totals(filters.from(), filters.to(), entries), workTypeBreakdown(entries));
  }

  private List<WorkEntry> findEntries(UUID userId, StatisticsFilters filters) {
    return findEntries(userId, filters, filters.from(), filters.to());
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
