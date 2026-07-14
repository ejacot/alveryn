package com.roomly.api.statistics.service;

import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.statistics.dto.ComparisonDirection;
import com.roomly.api.statistics.dto.MoneyAmountResponse;
import com.roomly.api.statistics.dto.StatisticsComparisonResponse;
import com.roomly.api.statistics.dto.StatisticsFilters;
import com.roomly.api.statistics.dto.StatisticsGranularity;
import com.roomly.api.statistics.dto.StatisticsMetric;
import com.roomly.api.statistics.dto.StatisticsOverviewResponse;
import com.roomly.api.statistics.dto.StatisticsPercentageBasis;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesPointResponse;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesResponse;
import com.roomly.api.statistics.dto.StatisticsWorkTypeResponse;
import com.roomly.api.statistics.model.StatisticsErrorCode;
import com.roomly.api.statistics.repository.StatisticsRepository;
import com.roomly.api.common.exception.ValidationException;
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

  private final StatisticsRepository statisticsRepository;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;

  @Transactional(readOnly = true)
  public StatisticsOverviewResponse overview(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> currentEntries = findEntries(userId, filters);
    Period previousPeriod = previousPeriod(filters.from(), filters.to());
    List<WorkEntry> previousEntries =
        findEntries(userId, filters, previousPeriod.from(), previousPeriod.to());

    long entries = currentEntries.size();
    int workedDays = distinctWorkedDays(currentEntries);
    BigDecimal workedMinutes = sumMinutes(currentEntries);
    BigDecimal averageMinutesPerDay =
        workedDays == 0
            ? BigDecimal.ZERO.setScale(SCALE)
            : workedMinutes.divide(BigDecimal.valueOf(workedDays), MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);

    return new StatisticsOverviewResponse(
        grossByCurrency(currentEntries),
        workedMinutes,
        workedDays,
        entries,
        averageMinutesPerDay,
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

  private List<WorkEntry> findEntries(UUID userId, StatisticsFilters filters) {
    return findEntries(userId, filters, filters.from(), filters.to());
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
