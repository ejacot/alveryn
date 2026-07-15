package com.alveryn.api.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import com.alveryn.api.user.dto.UserAccountDto;
import com.alveryn.api.user.dto.UserPreferencesResponse;
import com.alveryn.api.user.dto.UserProfileResponse;

@Schema(description = "Authenticated current user response")
public record CurrentUserResponse(
    UserAccountDto account, UserProfileResponse profile, UserPreferencesResponse preferences) {}
