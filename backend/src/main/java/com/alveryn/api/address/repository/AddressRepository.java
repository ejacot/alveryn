package com.alveryn.api.address.repository;

import com.alveryn.api.address.entity.Address;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AddressRepository extends JpaRepository<Address, UUID> {
  List<Address> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);

  Optional<Address> findByIdAndUserId(UUID id, UUID userId);
}
