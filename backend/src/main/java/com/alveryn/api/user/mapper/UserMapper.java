package com.alveryn.api.user.mapper;

import com.alveryn.api.address.service.AddressService;
import com.alveryn.api.user.dto.*;
import com.alveryn.api.user.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface UserMapper {
  UserAccountDto toDto(UserAccount e);

  default UserProfileResponse toProfileResponse(UserProfile e) {
    if (e == null) {
      return null;
    }
    return new UserProfileResponse(
        e.getId(),
        e.getFirstName(),
        e.getLastName(),
        e.getDisplayName(),
        e.getDateOfBirth(),
        e.getPhone(),
        e.getCountryCode(),
        e.getCity(),
        e.getPostalCode(),
        e.getStreet(),
        e.getHouseNumber(),
        e.getApartment(),
        e.getAddress() == null ? null : e.getAddress().getId(),
        AddressService.toResponse(e.getAddress()),
        e.getAvatarUrl(),
        e.getEmploymentStartDate(),
        e.getEmploymentEndDate(),
        e.getEmploymentType());
  }

  UserPreferencesResponse toPreferencesResponse(UserPreferences e);
}
