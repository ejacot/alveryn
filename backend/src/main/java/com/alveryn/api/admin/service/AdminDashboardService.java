package com.alveryn.api.admin.service;

import com.alveryn.api.admin.dto.AdminDashboardResponse;
import com.alveryn.api.admin.dto.AdminDashboardResponse.*;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.user.entity.UserStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {
  private static final String CUSTOMER = "role = 'USER' AND status <> 'DELETED'";

  private final JdbcTemplate jdbc;
  private final AuthenticatedUserAccessor authenticated;
  private final Clock clock;

  @Transactional
  public AdminDashboardResponse dashboard() {
    OffsetDateTime now = OffsetDateTime.now(clock);
    LocalDate today = now.atZoneSameInstant(ZoneOffset.UTC).toLocalDate();
    OffsetDateTime todayStart = today.atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime sevenDaysAgo = today.minusDays(6).atStartOfDay().atOffset(ZoneOffset.UTC);
    OffsetDateTime thirtyDaysAgo = today.minusDays(29).atStartOfDay().atOffset(ZoneOffset.UTC);

    Overview overview = new Overview(
        count("SELECT COUNT(*) FROM user_accounts WHERE " + CUSTOMER),
        count("SELECT COUNT(*) FROM user_accounts WHERE " + CUSTOMER + " AND email_verified = TRUE"),
        countSince("SELECT COUNT(*) FROM user_accounts WHERE " + CUSTOMER + " AND created_at >= ?", todayStart),
        countSince("SELECT COUNT(*) FROM user_accounts WHERE " + CUSTOMER + " AND created_at >= ?", sevenDaysAgo),
        activeSince(today),
        activeSince(today.minusDays(6)),
        activeSince(today.minusDays(29)));

    long registered = overview.totalUsers();
    ActivationFunnel activation = new ActivationFunnel(
        registered,
        overview.verifiedUsers(),
        count("""
            SELECT COUNT(*) FROM user_accounts u
            WHERE u.role = 'USER' AND u.status <> 'DELETED'
              AND EXISTS (SELECT 1 FROM user_preferences p WHERE p.user_id = u.id AND p.tracking_setup_version_completed > 0)
            """),
        usersWith("employments"),
        usersWith("work_types"),
        usersWith("work_records"));

    ProductUsage usage = new ProductUsage(
        trackingUsers("TIME"),
        trackingUsers("EARNINGS"),
        customerOwnedCount("employments"),
        customerOwnedCount("work_types"),
        customerOwnedCount("work_records"),
        customerOwnedCount("work_projects"),
        customerOwnedCount("work_intervals"),
        customerOwnedCount("product_events"));

    List<RegistrationPoint> registrations = registrationSeries(today.minusDays(29), today);
    List<UserSummary> users = userSummaries();
    audit("VIEW_FOUNDER_DASHBOARD", now);
    return new AdminDashboardResponse(overview, activation, usage, registrations, users);
  }

  private long count(String sql) {
    Long value = jdbc.queryForObject(sql, Long.class);
    return value == null ? 0 : value;
  }

  private long countSince(String sql, OffsetDateTime since) {
    Long value = jdbc.queryForObject(sql, Long.class, Timestamp.from(since.toInstant()));
    return value == null ? 0 : value;
  }

  private long activeSince(LocalDate since) {
    Long value = jdbc.queryForObject(
        """
        SELECT COUNT(DISTINCT a.user_id)
        FROM user_activity_days a
        JOIN user_accounts u ON u.id = a.user_id
        WHERE a.activity_date >= ? AND u.role = 'USER' AND u.status <> 'DELETED'
        """,
        Long.class,
        since);
    return value == null ? 0 : value;
  }

  private long usersWith(String table) {
    return count("SELECT COUNT(*) FROM user_accounts u WHERE " + CUSTOMER
        + " AND EXISTS (SELECT 1 FROM " + table + " item WHERE item.user_id = u.id)");
  }

  private long customerOwnedCount(String table) {
    return count("SELECT COUNT(*) FROM " + table
        + " item JOIN user_accounts u ON u.id = item.user_id WHERE u.role = 'USER' AND u.status <> 'DELETED'");
  }

  private long trackingUsers(String focus) {
    Long value = jdbc.queryForObject(
        """
        SELECT COUNT(DISTINCT e.user_id)
        FROM employments e
        JOIN user_accounts u ON u.id = e.user_id
        WHERE u.role = 'USER' AND u.status <> 'DELETED' AND e.tracking_focus = ?
        """,
        Long.class,
        focus);
    return value == null ? 0 : value;
  }

  private List<RegistrationPoint> registrationSeries(LocalDate from, LocalDate to) {
    return jdbc.query(
        """
        SELECT days.day,
               COALESCE(COUNT(u.id), 0) AS registrations
        FROM generate_series(?::date, ?::date, interval '1 day') AS days(day)
        LEFT JOIN user_accounts u
          ON u.created_at >= days.day
         AND u.created_at < days.day + interval '1 day'
         AND u.role = 'USER'
         AND u.status <> 'DELETED'
        GROUP BY days.day
        ORDER BY days.day
        """,
        (rs, rowNum) -> new RegistrationPoint(rs.getDate("day").toLocalDate(), rs.getLong("registrations")),
        from,
        to);
  }

  private List<UserSummary> userSummaries() {
    return jdbc.query(
        """
        SELECT u.id, u.email, u.email_verified, u.status, u.created_at, u.last_login_at,
               (SELECT MAX(a.last_seen_at) FROM user_activity_days a WHERE a.user_id = u.id) AS last_active_at,
               COALESCE(p.onboarding_completed, FALSE) AS onboarding_completed,
               (SELECT COUNT(*) FROM employments e WHERE e.user_id = u.id) AS employment_count,
               (SELECT COUNT(*) FROM work_types wt WHERE wt.user_id = u.id) AS work_type_count,
               (SELECT COUNT(*) FROM work_records wr WHERE wr.user_id = u.id) AS work_session_count
        FROM user_accounts u
        LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE u.role = 'USER' AND u.status <> 'DELETED'
        ORDER BY u.created_at DESC
        LIMIT 250
        """,
        this::mapUser);
  }

  private UserSummary mapUser(ResultSet rs, int rowNum) throws SQLException {
    return new UserSummary(
        rs.getObject("id", UUID.class),
        rs.getString("email"),
        rs.getBoolean("email_verified"),
        UserStatus.valueOf(rs.getString("status")),
        offset(rs, "created_at"),
        offset(rs, "last_login_at"),
        offset(rs, "last_active_at"),
        rs.getBoolean("onboarding_completed"),
        rs.getLong("employment_count"),
        rs.getLong("work_type_count"),
        rs.getLong("work_session_count"));
  }

  private OffsetDateTime offset(ResultSet rs, String column) throws SQLException {
    Timestamp value = rs.getTimestamp(column);
    return value == null ? null : value.toInstant().atOffset(ZoneOffset.UTC);
  }

  private void audit(String action, OffsetDateTime at) {
    jdbc.update(
        "INSERT INTO admin_audit_events (id, admin_user_id, action, occurred_at) VALUES (?, ?, ?, ?)",
        UUID.randomUUID(),
        authenticated.requireUserId(),
        action,
        Timestamp.from(at.toInstant()));
  }
}
