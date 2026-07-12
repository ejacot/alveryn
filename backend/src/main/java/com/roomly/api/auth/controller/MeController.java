package com.roomly.api.auth.controller;

import com.roomly.api.auth.dto.CurrentUserResponse;
import com.roomly.api.auth.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MeController {
  private final CurrentUserService currentUserService;

  @GetMapping("/api/me")
  public CurrentUserResponse me() {
    return currentUserService.getCurrentUser();
  }
}
