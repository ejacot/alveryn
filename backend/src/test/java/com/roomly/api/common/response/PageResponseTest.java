package com.roomly.api.common.response;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class PageResponseTest {
  @Test
  void buildsStablePaginationMetadataFromSpringPage() {
    PageResponse<String> response =
        PageResponse.from(new PageImpl<>(List.of("a", "b"), PageRequest.of(1, 2), 5));

    assertThat(response.content()).containsExactly("a", "b");
    assertThat(response.page()).isEqualTo(1);
    assertThat(response.size()).isEqualTo(2);
    assertThat(response.totalElements()).isEqualTo(5);
    assertThat(response.totalPages()).isEqualTo(3);
    assertThat(response.first()).isFalse();
    assertThat(response.last()).isFalse();
    assertThat(response.hasNext()).isTrue();
    assertThat(response.hasPrevious()).isTrue();
    assertThat(response.numberOfElements()).isEqualTo(2);
  }
}
