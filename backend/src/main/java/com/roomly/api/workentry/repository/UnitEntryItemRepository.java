package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.UnitEntryItem;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnitEntryItemRepository extends JpaRepository<UnitEntryItem, UUID> {
  @EntityGraph(attributePaths = "unitType")
  List<UnitEntryItem> findAllByWorkEntryId(UUID workEntryId);

  @EntityGraph(attributePaths = "unitType")
  List<UnitEntryItem> findAllByWorkEntryIdIn(Collection<UUID> workEntryIds);

  void deleteAllByWorkEntryId(UUID workEntryId);

  boolean existsByUnitTypeId(UUID unitTypeId);
}
