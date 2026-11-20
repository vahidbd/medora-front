# Glossary

One word per thing (ADR 0032). Use these words in table names, API fields, routes, code, tests and screens. The left column is what we say; the right column is what we never say for it. When a new concept needs a word, add it here in the same pull request.

## People and organisations

| Thing | We call it | Never |
| --- | --- | --- |
| A business that runs its care on Medora (a clinic, an operator) | **Tenant** | customer, client, org, account |
| A name and look a tenant sells under; one tenant can have several | **Brand** | site, storefront, white label |
| A person receiving care | **Patient** | client, customer, user, member |
| A person working for a tenant | **Staff member** | user, employee, agent |
| A staff member who prescribes (doctor, nurse practitioner) | **Prescriber** | doctor (unless the role really is "doctor"), provider |
| Any staff member who sees patients clinically | **Clinician** | practitioner, provider |
| The clinician who signs off a tenant's protocols | **Medical director** | clinical lead |
| A pharmacy that dispenses for a tenant | **Partner pharmacy** | pharmacy app, dispensary |
| A person's link to one tenant, with a role | **Membership** | seat, access |
| A named set of permissions | **Role** | group, profile |
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

## Money

| Thing | We call it | Never |
| --- | --- | --- |
| A company that moves card payments: Stripe or eWAY | **Processor** | gateway, PSP, provider (in code) |
| A tenant's connection to one processor | **Payment account** | merchant account, integration |
| A patient's saved card, held by the processor as a token | **Payment method** | card on file, source |
| What a program costs and how often it is charged | **Price** | plan, rate, tier |
| A patient's recurring billing for a program | **Subscription** | plan, membership, recurring order |
| The time from one renewal of a subscription to the next | **Billing period** | cycle, term |
| Who charges the patient for the medicine: bundled or pharmacy-billed (ADR 0021) | **Billing model** | payment model |
| What a fee is for: consult, program, medicine or shipping | **Fee kind** | fee type, category |
| The part of a bundled medicine price that belongs to the partner pharmacy | **Pharmacy share** | cost, wholesale price |
| The tax invoice for what a patient owes | **Invoice** | bill, statement |
| An invoice whose charge failed, or with no card to charge, and still owed | **Past due** | overdue, failed, unpaid |
| Trying a past-due invoice's card again on a set day | **Retry** | dunning, reattempt, recharge |
| A processor's refusal no retry changes: the card is lost, stolen, expired, closed or needs the patient to authenticate | **Hard decline** | permanent failure, fatal decline |
| An issued invoice that no longer stands: it keeps its number and nothing is owed on it | **Void** | cancelled, deleted, written off |
| One attempt to take money for an invoice | **Payment** | charge, transaction |
| Money given back to a patient | **Refund** | reversal, chargeback |
| An amount held for a patient, used against later invoices | **Credit** | voucher, store credit |
| The record of every money movement, as entries whose lines sum to zero | **Ledger** | journal, books |
| One money movement in the ledger | **Ledger entry** | posting, transaction |
| A ledger entry that undoes another, line by line | **Reversal** | correction, void |

## Platform

| Thing | We call it | Never |
| --- | --- | --- |
| One of Medora's own AI agents (intake, support, care coordinator, clinical copilot) | **Agent** | bot, assistant, AI |
| A permission-checked action an agent can take through the API | **Agent tool** | function, skill |
| A clinical, operational, marketing or platform schema and what may touch it | **Data zone** | domain, area |
| A row in `platform.audit_log` | **Audit entry** | log, history |
| A fact written to the outbox for others to react to | **Event** | message, notification, webhook |
| A setting that switches unfinished work on or off | **Feature flag** | toggle, switch |

## Who is who in these docs

- **You** means the coding agent reading this and changing Medora.
- **The product owner** means the person who reviews and approves pull requests that touch clinical rules, money, permissions, tenancy, data zones, AI autonomy and migrations.
- **Agent** without "coding" always means one of Medora's own AI agents, never you.
