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
| A registration, endorsement or indemnity policy a clinician holds | **Credential** | licence, certification, qualification |
| Whether a clinician may consult and prescribe right now, with the reasons if not | **Standing** | status, active, eligible |
| The weekly blocks a clinician can be booked in | **Working hours** | availability, roster, shifts |
| A period a clinician can't be booked | **Time off** | leave block, unavailability |
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
| Something a tenant sells: a medicine, a device or a service, with its price | **Product** | item, SKU, line |
| Every product a tenant sells | **Catalogue** | inventory, product list, store |
| Medora's platform-wide rule that stops matching products being prescribed, ordered or charged, which no tenant can lift | **Block rule** | ban list, blacklist |
| A product a block rule matches, or that its tenant blocked | **Blocked product** | banned product, disabled product |
| A real-time video or phone appointment with a clinician | **Consult** | appointment (except when booking), session, call |
| When the patient and the clinician connected and left during a consult, from the provider's verified callbacks | **Consult evidence** | call log, attendance, recording |
| A time a consult can be booked in, cut from a clinician's working hours | **Slot** | availability, opening, appointment time |
| Moving a consult to another time: the old one is cancelled and a new one booked, linked to it | **Reschedule** | move (in code), rebook |
| A consult the patient didn't come to | **No-show** | missed, DNA, failed to attend |
| A prescription | **Script** | Rx, prescription (in code), order |
| Writing a script (in Parchment) | **Prescribe** | order, issue |
| Preparing and handing over medicine against a script | **Dispense** | fulfil, fill |
| What a patient buys: program fees, medicine, or both | **Order** | purchase, cart |
| A parcel on its way to a patient | **Shipment** | delivery, consignment |
| A patient's ongoing goals, check-ins and reviews | **Care plan** | journey, treatment plan |
| A clinical record of a consult or review | **Note** | encounter, chart entry |
| A tenant's published text a patient agrees to, in numbered versions | **Consent document** | policy, form, terms (as a record) |
| A patient's recorded decision on one version of a consent document | **Consent** | agreement, opt-in, acceptance |
| Checking a patient is who they say, against a document | **Identity check** | KYC, ID verification, DVS check |
| The national Individual Healthcare Identifier | **IHI** | health ID, healthcare number |
| One numbered edition of a protocol: a draft, then live once signed off | **Protocol version** | revision, release |
| A medical director's recorded approval that makes a protocol version live | **Sign-off** | approval, publish |
| A platform protocol a tenant copies into a draft of its own | **Protocol template** | preset, starter |
| A protocol rule that ends an intake because the person can't be treated on it | **Hard stop** | exclusion, knock-out, disqualifier |
| A protocol rule that lets the intake go on and shows the prescriber something to look at | **Red flag** | warning, alert, caution |

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
| Every audit entry of one tenant, as people with `audit:read` read and export it | **Audit log** | activity log, audit trail, history |
| A fact written to the outbox for others to react to | **Event** | message, notification, webhook |
| An outside service's signed call to Medora saying something happened on its side (a call ended, a script was written) | **Webhook** | callback, hook, notification, event |
| A setting that switches unfinished work on or off | **Feature flag** | toggle, switch |

## Who is who in these docs

- **You** means the coding agent reading this and changing Medora.
- **The product owner** means the person who reviews and approves pull requests that touch clinical rules, money, permissions, tenancy, data zones, AI autonomy and migrations.
- **Agent** without "coding" always means one of Medora's own AI agents, never you.
