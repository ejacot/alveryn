package com.roomly.api.user.repository;
import com.roomly.api.user.entity.UserAccount; import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface UserAccountRepository extends JpaRepository<UserAccount,UUID>{Optional<UserAccount> findByEmailIgnoreCase(String email);boolean existsByEmailIgnoreCase(String email);}
