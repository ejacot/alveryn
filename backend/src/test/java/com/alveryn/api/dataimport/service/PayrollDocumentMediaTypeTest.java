package com.alveryn.api.dataimport.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PayrollDocumentMediaTypeTest {
  @Test
  void recognizesExtensionlessIphoneJpegByItsContents() {
    var file = new MockMultipartFile(
        "file", "image", "application/octet-stream",
        new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0, 1});

    assertThat(PayrollDocumentMediaType.detect(file)).isEqualTo("image/jpeg");
  }

  @Test
  void normalizesIosJpgMimeTypeWithoutAnExtension() {
    var file = new MockMultipartFile(
        "file", "image", "image/jpg", new byte[] {1, 2, 3});

    assertThat(PayrollDocumentMediaType.detect(file)).isEqualTo("image/jpeg");
  }
}
