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
import org.springframework.web.multipart.MaxUploadSizeExceededException;

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
  void oversizedUploadsUseAHelpfulPayloadTooLargeResponse() throws Exception {
    mockMvc
        .perform(get("/test/upload-too-large"))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.message").value("File exceeds the 15 MB upload limit"))
        .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
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

    @GetMapping("/test/upload-too-large")
    void uploadTooLarge() {
      throw new MaxUploadSizeExceededException(15L * 1024 * 1024);
    }
  }
}
