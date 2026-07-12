package com.roomly.api.auth.dto;

import com.roomly.api.user.dto.UserAccountDto;
import com.roomly.api.user.dto.UserPreferencesDto;
import com.roomly.api.user.dto.UserProfileDto;

public record CurrentUserResponse(
    UserAccountDto account, UserProfileDto profile, UserPreferencesDto preferences) {}
