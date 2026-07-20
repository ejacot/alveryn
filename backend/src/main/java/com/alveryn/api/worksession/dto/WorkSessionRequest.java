package com.alveryn.api.worksession.dto;

import jakarta.validation.constraints.*;
import java.util.UUID;

public record WorkSessionRequest(@NotNull UUID workTypeId, @NotBlank @Size(max = 60) String timezone) {}
