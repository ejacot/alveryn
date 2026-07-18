package com.alveryn.api.address.controller;

import com.alveryn.api.address.dto.AddressRequest;
import com.alveryn.api.address.dto.AddressResponse;
import com.alveryn.api.address.service.AddressService;
import com.alveryn.api.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/addresses")
@RequiredArgsConstructor
public class AddressController {
  private final AddressService addressService;

  @GetMapping
  public ApiResponse<List<AddressResponse>> list() {
    return ApiResponse.of(addressService.list());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<AddressResponse> create(@Valid @RequestBody AddressRequest request) {
    return ApiResponse.of(addressService.create(request));
  }

  @PutMapping("/{id}")
  public ApiResponse<AddressResponse> update(@PathVariable UUID id, @Valid @RequestBody AddressRequest request) {
    return ApiResponse.of(addressService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    addressService.delete(id);
  }
}
