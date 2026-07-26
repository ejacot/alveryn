# Changelog

All notable changes to Alveryn are documented in this file.

The project follows [Semantic Versioning](https://semver.org/). During the beta
period, breaking changes may still be introduced between minor versions.

## [Unreleased]

## [0.1.0-beta.2] - 2026-07-26

### Added

- Personal work projects with a name, date range, optional client/address metadata, project totals, and day-specific work sessions.
- Atomic project creation with its initial total lines, so a partial project cannot be left behind when validation fails.
- Employment rest days and complete day-state reporting alongside worked and absent days.
- A reusable ambient background, liquid-glass cards, and centered module titles across the personal dashboard, calendar, new-job, and settings flows.

### Changed

- Reworked the dashboard activity hierarchy, project presentation, weekly flow, and rhythm summaries for clearer daily earnings and hours.
- Kept project totals out of daily statistics; only dated project sessions contribute to a specific day.
- Clarified the calendar monthly summary by separating paid absence time from extra pay.
- Made address parts independently optional, allowing a useful partial address such as only a city or postal code.
- Split large frontend dependencies into cacheable chunks and deferred PDF rendering code until export, reducing the largest production bundle from about 918 kB to 339 kB.

### Fixed

- Enforced matching user, employment, and project date boundaries when attaching records to projects.
- Preserved correct daily totals when a project spans multiple days.
- Applied the ambient settings background to both `/settings/**` and the profile entry page.

## [0.1.0-beta.1] - 2026-07-26

### Added

- Personal onboarding with employment, tracking, balance, absence, and paid-hours setup.
- Work entries, check-in timer, work types, absences, rest days, and hours balance.
- Dashboard, calendar, statistics, profile, employment, and subscription settings.
- Responsive phone, tablet, and desktop layouts.
- Six-digit email verification and password recovery flows.
- Branded transactional email templates and administration interface.

### Changed

- Introduced the current Alveryn visual identity and responsive navigation.
- Improved onboarding explanations and configuration previews.
- Added separate paid hours per day for Sick Leave and Vacation.

### Infrastructure

- Automated backend, frontend, and Playwright E2E verification.
- Production deployment through `main`.
- Version consistency checks and tag-based GitHub Releases.

[Unreleased]: https://github.com/ejacot/alveryn/compare/v0.1.0-beta.2...HEAD
[0.1.0-beta.2]: https://github.com/ejacot/alveryn/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/ejacot/alveryn/releases/tag/v0.1.0-beta.1
