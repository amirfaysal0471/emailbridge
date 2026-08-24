# Standalone Gmail API Demo — Project Requirements

> Source document provided by the client. Kept verbatim as the reference spec for
> this repository. Implementation status for each section is tracked in
> [`ai/implementation-status.md`](./implementation-status.md).

## 1. Project Overview

Build a standalone Gmail integration demo using React.js + Node.js that demonstrates how Gmail API and Google OAuth 2.0 can be integrated into an existing application.

This is a test/demo/reference project only. It will not include any separate user authentication, registration system, or production application dashboard.

## 2. Authentication & Gmail Connection

- No custom user login or registration.
- User will click **Connect Gmail**.
- Google OAuth 2.0 will open for Gmail authorization.
- After successful authorization, the connected Gmail account will be identified.
- OAuth access token and refresh token will be securely handled on the backend.
- Automatic access-token refresh should be supported.
- User should be able to disconnect the Gmail account.

## 3. Gmail Inbox / Received Emails

The application should display emails received in the connected Gmail account.

Required information:

- Sender
- Recipient
- Subject
- Date/time
- Email preview/snippet
- Email body/details

Additional functionality:

- Open/view email
- Refresh inbox
- Pagination
- Reply to received email
- Forward email

## 4. Sent Emails

Display emails sent from the connected Gmail account.

Required information:

- Recipient
- Subject
- Date/time
- Email preview
- Email details/body

Users should be able to open and view sent emails.

## 5. Compose & Send Email

Provide a complete compose interface with:

- To
- CC
- BCC
- Subject
- Email body
- Send button

Emails must be sent through the connected user's Gmail account using Gmail API.

The recipient must see the connected Gmail address as the From address.

Example:

```
Connected Gmail: example@gmail.com
```

When an email is sent, the recipient should see:

```
From: example@gmail.com
```

The application must not send emails through its own SMTP/server email address.

## 6. Email Reply

Users should be able to open a received email and reply directly from the application.
The reply should be sent through the same connected Gmail account.

## 7. Email Forward

Users should be able to forward a received email to another recipient.

## 8. Backend

Use Node.js + Express.js.

Backend responsibilities:

- Google OAuth 2.0
- Gmail API integration
- OAuth callback handling
- Token management
- Access-token refresh
- Gmail profile/account information
- Inbox retrieval
- Sent email retrieval
- Email details
- Send email
- Reply
- Forward
- Error handling

OAuth credentials and sensitive tokens must never be exposed to the React frontend.

## 9. Frontend

Use React.js.

Required screens/components:

- Gmail connection screen
- Connected Gmail account information
- Inbox
- Sent
- Email details
- Compose email
- Reply
- Forward
- Disconnect
- Loading/error/success states

The UI should be clean, simple, responsive, and suitable for demonstrating the Gmail integration to a client.

## 10. Google Cloud Configuration

The demo should include documentation for:

- Google Cloud Project creation
- Gmail API enablement
- OAuth consent screen
- Required Gmail scopes
- OAuth Client ID creation
- Authorized redirect URI
- Test users
- Environment variables
- Local development configuration

The developer may use their own Google account/project for testing the demo.
Production Google Cloud configuration and verification will be handled separately by the client's team.

## 11. Environment Variables

Provide a complete `.env.example` containing required configuration such as:

- Google Client ID
- Google Client Secret
- Google Redirect URI
- Session/security secret
- Database configuration if required

No real credentials should be included in the source code.

## 12. Demo Requirements

The final demo should allow the client to test the complete flow:

```
Connect Gmail → OAuth Authorization → View Inbox → Open Received Email
→ Reply/Forward → Compose Email → Send → View Sent Email
```

The client should be able to verify that emails are actually being sent from the connected Gmail account.

## 13. Source Code & Documentation

Deliver:

- Complete React source code
- Complete Node.js source code
- `.env.example`
- Google Cloud setup guide
- Installation instructions
- Run instructions
- API documentation
- Gmail OAuth configuration instructions
- Basic architecture/flow documentation

## 14. Out of Scope

The following are not required for this demo:

- User registration/login
- User management
- Admin dashboard
- Subscription/payment system
- Multi-tenant SaaS
- Production deployment
- Production Google OAuth verification
- Advanced Gmail features beyond the defined scope

## 15. Final Expected Result

A working standalone Gmail demo where a user can:

```
Connect Gmail → View Received Emails → View Sent Emails → Compose → Send → Reply → Forward
```

with all outgoing emails being sent through the connected Gmail account, so the recipient sees that Gmail address as the sender.
