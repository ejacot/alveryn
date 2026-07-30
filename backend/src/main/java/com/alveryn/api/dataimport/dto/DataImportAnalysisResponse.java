package com.alveryn.api.dataimport.dto;

import java.util.Map;
import java.util.UUID;

public record DataImportAnalysisResponse(
    UUID batchId,
    String filename,
    String sha256,
    long size,
    String status,
    String importScope,
    UUID employmentId,
    boolean duplicate,
    Map<String, Object> analysis) {}
