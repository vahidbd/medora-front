# Patients, identity and consent in the console

The console's rulings for the Patients screens and Consent documents. The rules they reflect are the API's (`medora-backend` `docs/decisions/patients.md` IDN1 to IDN20). Ids continue from the backend's file, so they never collide. Rulings marked "Decided by" with a name other than Vahid's are to be confirmed with him.

### IDN21. A patient's name stays out of the address and the tab's title

Decision: the patient search lives in the screen's state and the request to the API, never in the page's address. A patient's record is addressed by id. The navigation entry for Patients is marked `privateRecords`, so the shell leaves the record's name out of the browser tab's title, which reads "Patients · Medora" or "Patient · Medora".
Why: browsers keep addresses and titles in their history, sync them between devices and show them in tab lists (the web app's principle 6). The name still shows in the page itself.
Decided by: us, to confirm with Vahid

### IDN22. One record page per patient, built of sections

Decision: a patient's record is one page in the kit's record shape: details (with Medicare masked as the API sends it), identity, consents and intakes, each a numbered section. Each action shows only to whoever holds its permission: verifying by sighting a document (`patients:verify_identity`), letting a patient whose checks didn't match try again, looking the IHI up again and recording a consent decision (`patients:manage`). Verifying and recording ask for a note, which goes to the audit log; the IHI itself never reaches the screen. Other areas (consults, notes, orders) add their own sections to this page.
Why: one place to see a person, with each area adding to it, is what staff work from; a page per area would scatter a patient across the console.
Decided by: us, to confirm with Vahid

### IDN23. Consent documents is a Workspace screen, version by version

Decision: Consent documents lists every version of every document, the current one marked. Publishing picks the document, starts from the current version's text, says which version it will be and, for the privacy notice and the telehealth terms, that patients will be asked to agree again before their next care. Published text never changes. Publishing needs `consents:manage`; everyone with `patients:read` can read them.
Why: what a patient agreed to must stay readable exactly as it was (IDN12), and whoever publishes needs to know when a change asks every patient again.
Decided by: us, to confirm with Vahid
