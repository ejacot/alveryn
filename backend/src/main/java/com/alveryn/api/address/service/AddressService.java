package com.alveryn.api.address.service;

import com.alveryn.api.address.dto.AddressRequest;
import com.alveryn.api.address.dto.AddressResponse;
import com.alveryn.api.address.entity.Address;
import com.alveryn.api.address.repository.AddressRepository;
import com.alveryn.api.auth.security.AuthenticatedUserAccessor;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@RequiredArgsConstructor
public class AddressService {
  private final AddressRepository addresses;
  private final UserAccountRepository users;
  private final AuthenticatedUserAccessor authenticatedUserAccessor;

  @Transactional(readOnly = true)
  public List<AddressResponse> list() {
    UUID userId = authenticatedUserAccessor.requireUserId();
    return addresses.findAllByUserIdOrderByUpdatedAtDesc(userId).stream().map(AddressService::toResponse).toList();
  }

  @Transactional
  public AddressResponse create(@Valid AddressRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    UserAccount user = users.findById(userId).orElseThrow(() -> new NotFoundException("User", userId));
    try {
      return toResponse(
          addresses.save(
              new Address(
                  user,
                  request.street(),
                  request.street2(),
                  request.postalCode(),
                  request.city(),
                  request.region(),
                  request.country())));
    } catch (IllegalArgumentException ex) {
      throw new ValidationException(ex.getMessage());
    }
  }

  @Transactional
  public AddressResponse update(UUID id, @Valid AddressRequest request) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    Address address = addresses.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("Address", id));
    try {
      address.update(request.street(), request.street2(), request.postalCode(), request.city(), request.region(), request.country());
      return toResponse(address);
    } catch (IllegalArgumentException ex) {
      throw new ValidationException(ex.getMessage());
    }
  }

  @Transactional
  public void delete(UUID id) {
    UUID userId = authenticatedUserAccessor.requireUserId();
    Address address = addresses.findByIdAndUserId(id, userId).orElseThrow(() -> new NotFoundException("Address", id));
    addresses.delete(address);
  }

  public static AddressResponse toResponse(Address address) {
    if (address == null) {
      return null;
    }
    return new AddressResponse(
        address.getId(),
        address.getStreet(),
        address.getStreet2(),
        address.getPostalCode(),
        address.getCity(),
        address.getRegion(),
        address.getCountry(),
        format(address));
  }

  public static String format(Address address) {
    if (address == null) {
      return null;
    }
    StringBuilder builder = new StringBuilder(address.getStreet());
    if (address.getStreet2() != null) {
      builder.append(", ").append(address.getStreet2());
    }
    if (address.getPostalCode() != null) {
      builder.append(", ").append(address.getPostalCode());
    }
    builder.append(" ").append(address.getCity());
    if (address.getRegion() != null) {
      builder.append(", ").append(address.getRegion());
    }
    builder.append(", ").append(address.getCountry());
    return builder.toString();
  }
}
