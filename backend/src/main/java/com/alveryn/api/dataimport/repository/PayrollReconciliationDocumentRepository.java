package com.alveryn.api.dataimport.repository;

import com.alveryn.api.dataimport.entity.PayrollReconciliationDocument;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollReconciliationDocumentRepository
    extends JpaRepository<PayrollReconciliationDocument, UUID> {
  Optional<PayrollReconciliationDocument> findByReconciliationId(UUID reconciliationId);
  Optional<Metadata> findMetadataByReconciliationId(UUID reconciliationId);

  interface Metadata {
    String getFilename();
    String getContentType();
    long getContentSize();
  }
}
