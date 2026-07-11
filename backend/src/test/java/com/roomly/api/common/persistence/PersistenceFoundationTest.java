package com.roomly.api.common.persistence;

import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class PersistenceFoundationTest {
    @Autowired UserAccountRepository users;

    @Test void generatesUuidAndTimestamps() {
        var saved = users.saveAndFlush(new UserAccount("uuid@example.com", "hash"));
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test void rejectsDuplicateNormalizedEmail() {
        users.saveAndFlush(new UserAccount("duplicate@example.com", "hash"));
        assertThatThrownBy(() -> users.saveAndFlush(new UserAccount(" DUPLICATE@example.com ", "other")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
