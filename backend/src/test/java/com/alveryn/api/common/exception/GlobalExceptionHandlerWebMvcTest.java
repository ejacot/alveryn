package com.alveryn.api.common.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpMethod;
import org.springframework.web.servlet.resource.NoResourceFoundException;

class GlobalExceptionHandlerWebMvcTest {
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new FailingController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void mailExceptionsUseSafeApiErrorResponse() throws Exception {
    mockMvc
        .perform(get("/test/mail"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.message").value("Email delivery is temporarily unavailable"))
        .andExpect(jsonPath("$.trace").doesNotExist());
  }

  @Test
  void unexpectedExceptionsUseSafeApiErrorResponse() throws Exception {
    mockMvc
        .perform(get("/test/unexpected"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.message").value("Unexpected server error"))
        .andExpect(jsonPath("$.trace").doesNotExist());
  }

  @Test
  void missingResourcesReturnNotFoundInsteadOfServerError() throws Exception {
    mockMvc
        .perform(get("/test/missing-resource"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Resource not found"))
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @RestController
  static class FailingController {
    @GetMapping("/test/mail")
    void mail() {
      throw new MailAuthenticationException("Authentication failed");
    }

    @GetMapping("/test/unexpected")
    void unexpected() {
      throw new IllegalStateException("boom");
    }

    @GetMapping("/test/missing-resource")
    void missingResource() throws NoResourceFoundException {
      throw new NoResourceFoundException(HttpMethod.GET, "api/data-imports/analyze", "/api/data-imports/analyze");
    }
  }
}
