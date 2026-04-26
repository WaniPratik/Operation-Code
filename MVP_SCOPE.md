# MVP Scope

## Purpose

This document separates what should be built now from what should wait. The goal is to protect speed without creating hidden product debt.

## Build Now

- repository foundation and documentation
- Next.js web app scaffold
- mobile-responsive landing page
- lightweight onboarding shell
- explicit age gate step placeholder plan
- internal anonymous identity model direction
- queue lifecycle definition
- match lifecycle definition
- report and block model direction
- backend guest session persistence
- queue, match, report, block, and audit APIs
- basic admin backend APIs
- initial database schema planning for users, queue, matches, reports, blocks, and audit events
- testing and code quality baseline

## Build Later

- auth provider integration
- voice provider integration
- billing and subscriptions
- premium cohort filters
- analytics and experimentation framework
- abuse prevention hardening beyond MVP basics

## Do Not Build Yet

- native iOS or Android apps
- advanced recommendation engines
- social graph or friend systems
- profile-heavy experiences
- complex personalization layers
- full trust-and-safety operations suite
- full compliance claims that are not yet supported by real systems
- provider-specific voice logic before the product lifecycle is stable
- premium filters before the fairness, policy, and support implications are defined

## Scope Guardrails

- If a feature does not directly help validate the core anonymous voice matching loop or platform safety basics, it probably should not enter the first implementation slice.
- If a capability is important but policy-heavy, architect for it now and implement it later.
- If a workflow is not operationally credible yet, do not present it as finished.
