# Glossary

One word per thing (ADR 0032). Use these words in table names, API fields, routes, code, tests and screens. The left column is what we say; the right column is what we never say for it. When a new concept needs a word, add it here in the same pull request.

## People and organisations

| Thing | We call it | Never |
| --- | --- | --- |
| A business that runs its care on Medora (a clinic, an operator) | **Tenant** | customer, client, org, account |
| A name and look a tenant sells under; one tenant can have several | **Brand** | site, storefront, white label |
| A legal entity under a tenant, with its own ABN; every brand belongs to one | **Company** | entity, legal entity, business |
| A web address a brand's public pages answer on, such as app.brand.com.au | **Domain** | URL, site, web address |
| What a tenant must have before it takes new patients: a company, a live brand, a medical director and a prescriber | **Onboarding checklist** | setup wizard, go-live list |
| Medora's own team, who create tenants and verify domains, and see no tenant's data | **Platform staff** | super admin, Medora admin, staff (alone) |
| A person receiving care | **Patient** | client, customer, user, member |
| A person working for a tenant | **Staff member** | user, employee, agent |
| A staff member who prescribes (doctor, nurse practitioner) | **Prescriber** | doctor (unless the role really is "doctor"), provider |
| Any staff member who sees patients clinically | **Clinician** | practitioner, provider |
| The clinician who signs off a tenant's protocols | **Medical director** | clinical lead |
| A pharmacy that dispenses for a tenant | **Partner pharmacy** | pharmacy app, dispensary |
| A person's link to one tenant, with a role | **Membership** | seat, access |
| An offer of a membership, sent by email, that becomes the membership when the person signs in | **Invitation** | invite (as a noun), pending user |
| A named set of permissions | **Role** | group, profile |
| A role every tenant has, defined in Medora's code and not editable by a tenant | **Starting role** | default role, system role, built-in role |
| A role a tenant made by copying a starting role and editing it | **Custom role** | tenant role, user-defined role |
| One thing a role may do, as a key like `staff:manage` | **Permission** | right, scope, claim |

## Care

| Thing | We call it | Never |
| --- | --- | --- |
| What a tenant treats (weight loss, skin, sleep) | **Condition** | service, vertical, category, therapy area |
| A packaged course of care a patient signs up for | **Program** | plan, subscription, package |
| The clinical rules for a service: eligibility, questions, products, reviews | **Protocol** | pathway, flow, playbook |
| The questions a patient answers before a consult | **Intake** | questionnaire, survey, form |
| A real-time video or phone appointment with a clinician | **Consult** | appointment (except when booking), session, call |
| A prescription | **Script** | Rx, prescription (in code), order |
| Writing a script (in Parchment) | **Prescribe** | order, issue |
| Preparing and handing over medicine against a script | **Dispense** | fulfil, fill |
| What a patient buys: program fees, medicine, or both | **Order** | purchase, cart |
| A parcel on its way to a patient | **Shipment** | delivery, consignment |
| A patient's ongoing goals, check-ins and reviews | **Care plan** | journey, treatment plan |
| A clinical record of a consult or review | **Note** | encounter, chart entry |
| A tenant's published text a patient agrees to, in numbered versions | **Consent document** | policy, form, terms (as a record) |
| A patient's recorded decision on one version of a consent document | **Consent** | agreement, opt-in, acceptance |

## Support and messaging

| Thing | We call it | Never |
| --- | --- | --- |
| One request from a person, across every channel they use for it | **Ticket** | case, conversation, enquiry, issue |
| One thing said to or by a person on any channel (email, SMS, chat, a logged call), in or out | **Message** | post, entry, communication |
| A staff member's note on a ticket that the person never sees | **Comment** | internal note, note |
| Where a ticket waits for staff: the support queue or the clinical queue | **Queue** | inbox (as a record), bucket, group |
| Checking a person's message for words that need a clinician, a person or governance | **Triage** | screening, classification |
| A mark on a ticket such as emergency, self-harm or possible complaint | **Flag** | tag, label |
| Approved saved wording for a ticket reply | **Macro** | canned response, snippet, template (for replies) |
| A brand's own email address or phone number on a channel, for service or for marketing | **Sender** | from address, sender id |
| A brand's public pages of service articles, which agents answer from | **Help centre** | knowledge base, help center, FAQ, docs |
| One page of a help centre, with its approved wording in versions | **Article** | help doc, FAQ entry, page |
| A heading a brand's help centre articles are grouped under | **Section** | category, folder, topic (for articles) |

## Platform

| Thing | We call it | Never |
| --- | --- | --- |
| One of Medora's own AI agents (intake, support, care coordinator, clinical copilot) | **Agent** | bot, assistant, AI |
| A permission-checked action an agent can take through the API | **Agent tool** | function, skill |
| A clinical, operational, marketing or platform schema and what may touch it | **Data zone** | domain, area |
| Time-limited, logged and reviewed use of clinical permissions by someone whose role is not clinical | **Break-glass** | emergency access, override, god mode |
| Signing in with a second proof after the first, such as an authenticator code | **Two-step sign-in** | MFA, 2FA |
| That second proof | **Second factor** | OTP, token |
| One signed-in session, recorded with when, where from and on what device | **Sign-in** | login, session (on a screen) |
| A row in `platform.audit_log` | **Audit entry** | log, history |
| A fact written to the outbox for others to react to | **Event** | message, notification, webhook |
| An outside service's signed call to Medora saying something happened on its side (a call ended, a script was written) | **Webhook** | callback, hook, notification, event |
| A setting that switches unfinished work on or off | **Feature flag** | toggle, switch |

## Who is who in these docs

- **You** means the coding agent reading this and changing Medora.
- **The product owner** means the person who reviews and approves pull requests that touch clinical rules, money, permissions, tenancy, data zones, AI autonomy and migrations.
- **Agent** without "coding" always means one of Medora's own AI agents, never you.
