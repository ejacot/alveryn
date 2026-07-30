package com.alveryn.api.dataimport.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record DataImportConfirmRequest(
    @NotEmpty List<@Valid DataImportCandidateDecision> candidates) {}
