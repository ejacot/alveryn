package com.roomly.api.workentry.repository;

import com.roomly.api.workentry.entity.UnitEntryItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnitEntryItemRepository extends JpaRepository<UnitEntryItem, UUID> {
  List<UnitEntryItem> findAllByWorkEntryId(UUID workEntryId);

  void deleteAllByWorkEntryId(UUID workEntryId);
}
