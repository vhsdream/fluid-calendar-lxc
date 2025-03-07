# Beta Waitlist Implementation Guide

This document outlines the implementation plan for the beta waitlist feature in the SAAS version of Fluid Calendar. The feature will allow us to manage a controlled rollout of the application to beta users, with admin controls for inviting users in batches.

## Database Schema

- [ ] **Create `WaitlistEntry` model in Prisma schema**
  - Fields: id, email, name, status (enum: WAITING, INVITED, REGISTERED), createdAt, invitedAt, registeredAt, invitationToken, invitationExpiry, referralCode, referredBy, notes
  - Add appropriate indexes for email and status fields
  - Add unique constraint on email
  - Add referralCount field to track number of successful referrals
  - Add priorityScore field to calculate position in the queue
  - Add lastVisitedAt field to track when user last checked their status

- [ ] **Create `BetaSettings` model in Prisma schema**
  - Fields: id, maxActiveUsers, invitationEmailTemplate, waitlistConfirmationTemplate, reminderEmailTemplate, invitationValidDays, autoInviteEnabled, autoInviteCount, autoInviteFrequency
  - Add referralBoostAmount field to control how much each referral improves priority
  - Add maxReferralBoost field to cap the total boost from referrals
  - Add showQueuePosition field to control whether to show exact position or range
  - Add showTotalWaitlist field to control whether to show total waitlist size

- [ ] **Add migration script**
  - Create migration for the new models
  - Add seed data for default email templates and settings

## Public Waitlist Page

- [ ] **Create public waitlist page route**
  - Path: `/beta` (accessible without authentication)
  - Design a clean, informative page explaining the beta program
  - Include waitlist signup form (email required, name optional)
  - Add privacy policy checkbox and terms acceptance
  - Add referral code field (optional) for users coming from a referral link
  - Implement email recognition for returning users

- [ ] **Implement waitlist form submission**
  - Create API endpoint for form submission
  - Add validation for email format
  - Check if email already exists in waitlist or as registered user
  - Generate unique referral code for each entry
  - Implement rate limiting to prevent abuse
  - Process referral code if provided and update referrer's priority
  - Return appropriate response for new vs. returning users

- [ ] **Create waitlist confirmation email**
  - Design email template with Resend
  - Include confirmation of waitlist position
  - Add personalized referral link prominently
  - Explain the referral benefits clearly
  - Set up email tracking for opens
  - Include link to check status page

## Waitlist Status Feature

- [ ] **Implement user recognition system**
  - Create email verification mechanism for returning users
  - Generate secure, time-limited access tokens for status page
  - Implement cookie-based recognition for frequent visitors
  - Add option to "remember this device" for easier access

- [ ] **Build waitlist status dashboard**
  - Create dedicated status page with personalized information
  - Show current queue position and total people in waitlist
  - Display estimated time until invitation (if enabled)
  - Show referral performance statistics
  - Update lastVisitedAt timestamp when user checks status

- [ ] **Implement position calculation system**
  - Create algorithm to calculate real-time queue position based on priority score
  - Add option to show exact position or position range based on admin settings
  - Implement caching to prevent excessive database queries
  - Create background job to recalculate positions periodically

- [ ] **Add engagement features to status page**
  - Show progress bar or visual representation of position
  - Add "share your status" social media functionality
  - Implement milestone celebrations when position improves
  - Create personalized tips to improve position (e.g., "Refer 2 more friends to move up 10 spots")

## Referral System

- [ ] **Implement referral link generation**
  - Create unique, short referral codes for each waitlist entry
  - Build URL structure for referral links (e.g., `/beta?ref=CODE`)
  - Ensure referral codes are URL-friendly and easy to share
  - Add QR code generation for referral links

- [ ] **Create referral tracking system**
  - Build database queries to track referral conversions
  - Implement priority score calculation based on referrals
  - Create mechanism to update waitlist position when new referrals join
  - Add protection against fraudulent referrals

- [ ] **Build referral dashboard for users**
  - Create a page for users to track their referrals
  - Show current waitlist position and how it has improved
  - Display number of successful referrals
  - Add sharing options for social media and email

- [ ] **Implement referral notifications**
  - Send email notifications when someone uses a referral link
  - Create notification when waitlist position improves
  - Add milestone notifications (e.g., "You're in the top 100!")
  - Design gamification elements to encourage more referrals

## Admin Management Interface

- [ ] **Create admin waitlist dashboard**
  - Path: `/settings/admin/waitlist` (SAAS-only route)
  - Add access control to restrict to admin users only
  - Create overview statistics (total waiting, recently invited, conversion rate)
  - Add charts for waitlist growth and conversion trends
  - Include referral system metrics and effectiveness

- [ ] **Implement waitlist entries table**
  - Create sortable/filterable table of all waitlist entries
  - Add status indicators (waiting, invited, registered)
  - Include search functionality by email or name
  - Add pagination for large lists
  - Show referral count and priority score columns
  - Add ability to sort by referral performance

- [ ] **Create bulk actions for waitlist management**
  - Implement select/deselect functionality for entries
  - Add bulk invite action with confirmation dialog
  - Create bulk delete action with confirmation
  - Add bulk export to CSV option
  - Add option to boost priority for selected entries

- [ ] **Build invitation management interface**
  - Create form to send invitations to selected users
  - Add option to customize invitation message
  - Implement scheduling for delayed invitations
  - Add preview functionality for invitation emails
  - Include option to prioritize users with most referrals

- [ ] **Implement beta settings configuration**
  - Create form for updating beta settings
  - Add controls for max users, invitation validity period
  - Create email template editor with variables support
  - Add toggle for automatic invitations
  - Add controls for referral boost settings

## Invitation System

- [ ] **Create invitation generation logic**
  - Implement secure token generation for invitations
  - Add expiration date based on settings
  - Store invitation details in database
  - Create function to validate invitation tokens

- [ ] **Build invitation email system**
  - Design invitation email template with Resend
  - Include unique signup link with token
  - Add expiration information
  - Set up tracking for email opens and link clicks

- [ ] **Implement reminder system**
  - Create logic to identify unused invitations nearing expiration
  - Build reminder email template
  - Set up scheduled job to send reminders
  - Track reminder effectiveness

- [ ] **Create automatic invitation system**
  - Implement logic to select users for automatic invitation
  - Build scheduled job for processing automatic invitations
  - Add controls to pause/resume automatic invitations
  - Create logs for automatic invitation activities

## Signup Flow Modification

- [ ] **Update authentication system**
  - Modify signup process to check invitation status
  - Create middleware to validate invitation tokens
  - Add logic to handle expired invitations
  - Implement redirect for uninvited users to waitlist

- [ ] **Enhance signup page for invited users**
  - Add special welcome message for invited users
  - Pre-fill email from invitation
  - Create streamlined onboarding flow for beta users
  - Add beta badge or indicator for beta users

- [ ] **Implement post-registration process**
  - Update waitlist entry status upon successful registration
  - Send welcome email to new beta users
  - Record conversion metrics
  - Clean up used invitation tokens

## Analytics and Reporting

- [ ] **Create waitlist analytics system**
  - Track key metrics (signup rate, invitation acceptance rate)
  - Implement funnel analysis (waitlist → invitation → registration)
  - Add time-based analysis (time on waitlist, time to accept invitation)
  - Create export functionality for analytics data
  - Add referral system performance metrics
  - Track viral coefficient of the referral program

- [ ] **Build admin reporting dashboard**
  - Design overview of beta program status
  - Add charts for key metrics
  - Create weekly/monthly report generation
  - Implement email delivery of reports to admins

## Email Integration with Resend

- [ ] **Set up Resend API integration**
  - Create API key and configure environment variables
  - Implement helper functions for sending emails
  - Add error handling and retry logic
  - Create logging for email activities

- [ ] **Build email templates system**
  - Create base template with consistent branding
  - Implement variable substitution system
  - Add responsive design for all email templates
  - Create preview functionality for testing

- [ ] **Implement email tracking**
  - Set up open and click tracking
  - Create database structure for storing tracking data
  - Build reporting interface for email performance
  - Add alerts for low engagement rates

## Testing and Quality Assurance

- [ ] **Create unit tests**
  - Test invitation token generation and validation
  - Verify email sending functionality
  - Test waitlist entry management functions
  - Validate access control for admin features

- [ ] **Implement integration tests**
  - Test end-to-end waitlist signup flow
  - Verify invitation and registration process
  - Test bulk operations functionality
  - Validate automatic invitation system

- [ ] **Perform security review**
  - Audit invitation token security
  - Review rate limiting implementation
  - Check for potential data exposure
  - Validate admin access controls

## Deployment and Launch

- [ ] **Create feature flag for beta waitlist**
  - Implement feature flag in config system
  - Add conditional rendering for waitlist-related UI
  - Create migration plan for existing users

- [ ] **Prepare documentation**
  - Write admin guide for managing waitlist
  - Create internal documentation for the feature
  - Prepare user-facing FAQ for waitlist members

- [ ] **Plan phased rollout**
  - Set up initial waitlist with test users
  - Create schedule for first batch of invitations
  - Prepare monitoring for system performance
  - Define success metrics for the beta program

## Post-Launch Activities

- [ ] **Implement feedback collection**
  - Create feedback form for beta users
  - Set up automated feedback requests
  - Build dashboard for feedback analysis
  - Implement prioritization system for feedback

- [ ] **Plan for general availability transition**
  - Define criteria for ending beta period
  - Create migration plan for waitlist to public signup
  - Prepare communication plan for full launch
  - Design special recognition for beta participants 