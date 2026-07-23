package com.alveryn.api.schedule.repository;

import com.alveryn.api.schedule.entity.ShiftBreak;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShiftBreakRepository extends JpaRepository<ShiftBreak, UUID> {}
