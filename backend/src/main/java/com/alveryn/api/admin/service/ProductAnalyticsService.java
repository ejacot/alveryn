package com.alveryn.api.admin.service;

import com.alveryn.api.admin.dto.PublicAnalyticsEventType;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductAnalyticsService {
  private final JdbcTemplate jdbc;
  private final Clock clock;

  @Transactional
  public void recordActivity(UUID userId) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    jdbc.update(
        """
        INSERT INTO user_activity_days (user_id, activity_date, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id, activity_date)
        DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
        """,
        userId,
        now.atZoneSameInstant(ZoneOffset.UTC).toLocalDate(),
        Timestamp.from(now.toInstant()),
        Timestamp.from(now.toInstant()));
  }

  @Transactional
  public void recordPdfExport(UUID userId) {
    jdbc.update(
        "INSERT INTO product_events (id, user_id, event_type, occurred_at) VALUES (?, ?, 'PDF_EXPORTED', ?)",
        UUID.randomUUID(),
        userId,
        Timestamp.from(OffsetDateTime.now(clock).toInstant()));
  }

  @Transactional
  public void recordPublicEvent(PublicAnalyticsEventType eventType, UUID anonymousId) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    OffsetDateTime dayStart = now.atZoneSameInstant(ZoneOffset.UTC).toLocalDate()
        .atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime nextDay = dayStart.plusDays(1);
    jdbc.update(
        """
        INSERT INTO product_events (id, anonymous_id, event_type, occurred_at)
        SELECT ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM product_events
          WHERE anonymous_id = ?
            AND event_type = ?
            AND occurred_at >= ?
            AND occurred_at < ?
        )
        """,
        UUID.randomUUID(),
        anonymousId,
        eventType.name(),
        Timestamp.from(now.toInstant()),
        anonymousId,
        eventType.name(),
        Timestamp.from(dayStart.toInstant()),
        Timestamp.from(nextDay.toInstant()));
  }
}
