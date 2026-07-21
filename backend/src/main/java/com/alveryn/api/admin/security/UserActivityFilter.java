package com.alveryn.api.admin.security;

import com.alveryn.api.admin.service.ProductAnalyticsService;
import com.alveryn.api.auth.security.AuthenticatedUser;
import com.alveryn.api.user.entity.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class UserActivityFilter extends OncePerRequestFilter {
  private final ProductAnalyticsService analytics;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication != null
        && authentication.getPrincipal() instanceof AuthenticatedUser user
        && user.role() == UserRole.USER) {
      try {
        analytics.recordActivity(user.userId());
      } catch (RuntimeException ignored) {
        // Product analytics must never make the product unavailable.
      }
    }
    filterChain.doFilter(request, response);
  }
}
