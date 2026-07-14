package com.roomly.api.statistics.service;

import com.roomly.api.auth.security.AuthenticatedUserAccessor;
import com.roomly.api.statistics.dto.ComparisonDirection;
import com.roomly.api.statistics.dto.StatisticsFilters;
import com.roomly.api.statistics.dto.StatisticsOverviewResponse;
import com.roomly.api.statistics.dto.StatisticsTimeSeriesPointResponse;
import com.roomly.api.statistics.dto.StatisticsWorkTypeResponse;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StatisticsService {
  private static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;
  private static final int SCALE = 15;

  private final StatisticsRepository statisticsRepository;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;

  @Transactional(readOnly = true)
  public StatisticsOverviewResponse overview(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> currentEntries = findEntries(userId, filters);
    Period previousPeriod = previousPeriod(filters.from(), filters.to());
    List<WorkEntry> previousEntries =
        findEntries(userId, filters, previousPeriod.from(), previousPeriod.to());

    BigDecimal gross = sumGross(currentEntries);
    BigDecimal previousGross = sumGross(previousEntries);
    long entries = currentEntries.size();
    int workedDays = distinctWorkedDays(currentEntries);
    BigDecimal workedMinutes = sumMinutes(currentEntries);
    BigDecimal averageMinutesPerDay =
        workedDays == 0
            ? BigDecimal.ZERO.setScale(SCALE)
            : workedMinutes.divide(BigDecimal.valueOf(workedDays), MATH_CONTEXT).setScale(SCALE, RoundingMode.HALF_UP);

    return new StatisticsOverviewResponse(
        gross,
        resolveCurrency(currentEntries),
        workedMinutes,
        workedDays,
        entries,
        averageMinutesPerDay,
        comparisonPercentage(gross, previousGross),
        comparisonDirection(gross, previousGross));
  }

  @Transactional(readOnly = true)
  public List<StatisticsTimeSeriesPointResponse> timeSeries(StatisticsFilters filters) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    List<WorkEntry> entries = findEntries(userId, filters);
    TimeBucket bucket = TimeBucket.forRange(filters.from(), filters.to());
    Map<LocalDate, BigDecimal> grouped = new LinkedHashMap<>();
    for (WorkEntry entry : entries) {
      LocalDate key = bucket.key(entry.getWorkDate());
      grouped.merge(key, entry.getGrossAmount(), BigDecimal::add);
    }
    return grouped.entrySet().stream()
        .map(item -> new StatisticsTimeSeriesPointResponse(item.getKey(), item.getValue().setScale(SCALE, RoundingMode.HALF_UP)))
        .toList();
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
              ignored -> new WorkTypeAggregate(entry.getWorkType().getId(), entry.getWorkTypeNameSnapshot()));
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
      throw new IllegalArgumentException("from and to are required");
    }
    if (to.isBefore(from)) {
      throw new IllegalArgumentException("to must be on or after from");
    }
  }

  private <T> List<T> normalize(Collection<T> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    return values.stream().distinct().toList();
  }

  private BigDecimal sumGross(List<WorkEntry> entries) {
    return entries.stream()
        .map(WorkEntry::getGrossAmount)
        .reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add)
        .setScale(SCALE, RoundingMode.HALF_UP);
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

  private String resolveCurrency(List<WorkEntry> entries) {
    List<String> currencies = entries.stream().map(WorkEntry::getCurrencySnapshot).distinct().toList();
    if (currencies.isEmpty()) {
      return null;
    }
    return currencies.size() == 1 ? currencies.getFirst() : "MIXED";
  }

  private BigDecimal comparisonPercentage(BigDecimal current, BigDecimal previous) {
    if (previous.signum() == 0) {
      return current.signum() == 0 ? BigDecimal.ZERO.setScale(2) : BigDecimal.valueOf(100).setScale(2);
    }
    return current
        .subtract(previous)
        .multiply(BigDecimal.valueOf(100), MATH_CONTEXT)
        .divide(previous, MATH_CONTEXT)
        .setScale(2, RoundingMode.HALF_UP);
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

  private enum TimeBucket {
    DAILY {
      @Override
      LocalDate key(LocalDate date) {
        return date;
      }
    },
    WEEKLY {
      @Override
      LocalDate key(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      }
    },
    MONTHLY {
      @Override
      LocalDate key(LocalDate date) {
        return date.withDayOfMonth(1);
      }
    };

    abstract LocalDate key(LocalDate date);

    static TimeBucket forRange(LocalDate from, LocalDate to) {
      long days = ChronoUnit.DAYS.between(from, to) + 1;
      if (days <= 62) {
        return DAILY;
      }
      if (days <= 370) {
        return WEEKLY;
      }
      return MONTHLY;
    }
  }

  private record Period(LocalDate from, LocalDate to) {}

  private static final class WorkTypeAggregate {
    private final UUID workTypeId;
    private final String name;
    private final List<WorkEntry> entries = new ArrayList<>();

    private WorkTypeAggregate(UUID workTypeId, String name) {
      this.workTypeId = workTypeId;
      this.name = name;
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
      BigDecimal gross =
          entries.stream()
              .map(WorkEntry::getGrossAmount)
              .reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add)
              .setScale(SCALE, RoundingMode.HALF_UP);
      BigDecimal percentage =
          totalMinutes.signum() == 0
              ? BigDecimal.ZERO.setScale(2)
              : minutes.multiply(BigDecimal.valueOf(100), MATH_CONTEXT)
                  .divide(totalMinutes, MATH_CONTEXT)
                  .setScale(2, RoundingMode.HALF_UP);
      return new StatisticsWorkTypeResponse(workTypeId, name, minutes, gross, percentage, entries.size());
    }
  }
}
