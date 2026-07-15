package com.alveryn.api.user.mapper;

import com.alveryn.api.user.dto.*;
import com.alveryn.api.user.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface UserMapper {
  UserAccountDto toDto(UserAccount e);

  UserProfileResponse toProfileResponse(UserProfile e);

  UserPreferencesResponse toPreferencesResponse(UserPreferences e);
}
