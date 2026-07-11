package com.roomly.api.user.mapper;

import com.roomly.api.user.dto.*;
import com.roomly.api.user.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface UserMapper {
  UserAccountDto toDto(UserAccount e);

  @Mapping(target = "userId", source = "user.id")
  UserProfileDto toDto(UserProfile e);

  @Mapping(target = "userId", source = "user.id")
  UserPreferencesDto toDto(UserPreferences e);
}
