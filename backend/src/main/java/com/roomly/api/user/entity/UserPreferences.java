package com.roomly.api.user.entity;
import com.roomly.api.common.persistence.BaseEntity; import jakarta.persistence.*; import lombok.*;
@Getter @NoArgsConstructor(access=AccessLevel.PROTECTED) @Entity @Table(name="user_preferences")
public class UserPreferences extends BaseEntity {
 @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false,unique=true) private UserAccount user;
 @Column(nullable=false,length=10) private String language="ro"; @Column(nullable=false,length=60) private String timezone="Europe/Berlin";
 @Column(nullable=false,length=3) private String currency="EUR"; @Enumerated(EnumType.STRING) @Column(name="first_day_of_week",nullable=false,length=10) private FirstDayOfWeek firstDayOfWeek=FirstDayOfWeek.MONDAY;
 @Column(name="date_format",nullable=false,length=30) private String dateFormat="DD.MM.YYYY"; @Enumerated(EnumType.STRING) @Column(name="time_format",nullable=false,length=10) private TimeFormat timeFormat=TimeFormat.H24;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=10) private ThemePreference theme=ThemePreference.SYSTEM; @Column(name="default_break_minutes",nullable=false) private int defaultBreakMinutes=30;
 @Column(name="preferred_daily_minutes") private Integer preferredDailyMinutes; @Column(name="onboarding_completed",nullable=false) private boolean onboardingCompleted;
 public UserPreferences(UserAccount user){this.user=java.util.Objects.requireNonNull(user);} public void setDefaultBreakMinutes(int v){if(v<0)throw new IllegalArgumentException();defaultBreakMinutes=v;} public void setPreferredDailyMinutes(Integer v){if(v!=null&&v<=0)throw new IllegalArgumentException();preferredDailyMinutes=v;}
}
