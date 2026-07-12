package com.roomly.api.user.mapper;

import com.roomly.api.user.dto.*;
import com.roomly.api.user.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface UserMapper {
  UserAccountDto toDto(UserAccount e);

  UserProfileResponse toProfileResponse(UserProfile e);

  UserPreferencesResponse toPreferencesResponse(UserPreferences e);
}
