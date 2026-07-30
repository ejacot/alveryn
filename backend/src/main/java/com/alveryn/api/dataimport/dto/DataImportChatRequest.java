package com.alveryn.api.dataimport.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record DataImportChatRequest(
    @NotBlank @Size(max = 300) String questionId,
    @NotEmpty @Size(max = 12) List<@Valid Message> messages) {

  public record Message(
      @NotNull Role role,
      @NotBlank @Size(max = 2000) String content) {}

  public enum Role {
    USER,
    ASSISTANT
  }
}
