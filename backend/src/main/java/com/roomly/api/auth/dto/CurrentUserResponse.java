package com.roomly.api.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import com.roomly.api.user.dto.UserAccountDto;
import com.roomly.api.user.dto.UserPreferencesResponse;
import com.roomly.api.user.dto.UserProfileResponse;

@Schema(description = "Authenticated current user response")
public record CurrentUserResponse(
    UserAccountDto account, UserProfileResponse profile, UserPreferencesResponse preferences) {}
