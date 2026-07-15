package com.alveryn.api.auth.security;

import com.alveryn.api.auth.exception.UnauthorizedException;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class AuthenticatedUserAccessor {
  public UUID requireUserId() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
      throw new UnauthorizedException("Authentication is required");
    }
    return user.userId();
  }

  public AuthenticatedUser requireUser() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
      throw new UnauthorizedException("Authentication is required");
    }
    return user;
  }
}
