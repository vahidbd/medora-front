# Catalogue and blocked items in the console

The console's rulings for the Products and Block rules screens. The rules they reflect are the API's (`medora-backend` `docs/decisions/catalogue.md` CAT1 to CAT6). Ids continue from the backend's file, so they never collide.

### CAT7. Products is its own work area, and says on every row whether the product can be supplied

Decision: Products sits in a Catalogue group of the sidebar, for anyone holding `catalogue:read`. Active and Archived are two tabs of one list. Each row shows the product's details in one muted line (schedule, compounded, ARTG number, strength, form, pack size), its list price, and a status: Active, Blocked (the tenant's own block), Blocked by Medora, or Archived, with the block's reason under it. Medora's block rules in force show in a notice above the list. Holders of `catalogue:manage` get New product and each row's menu: Edit product, Block product or Lift block, Archive or Restore.
Why: whether a product can be supplied is the thing staff need from the list, and it changes when Medora adds a rule, not when anyone edits the product (CAT3).

### CAT8. Blocking takes a reason, and lifting a block says when Medora's rule still applies

Decision: Block product opens a small dialog that asks for a reason (3 to 300 characters), shown beside the product. Lift block appears only for the tenant's own block; when a Medora rule still matches, the toast says so and the row stays Blocked by Medora. The screen never offers a way around a Medora rule.
Why: the tenant's block is theirs to undo, and a lifted block that looked like it freed a product Medora blocks would mislead (CAT4).

### CAT9. Platform staff add block rules from a screen that says they can't be undone there

Decision: platform staff get Platform, Block rules: each rule with what it blocks, its reason and source, the day it takes effect, and In force or Announced. New block rule takes a schedule, an ARTG number or compounded medicines, a reason and an optional source link, and applies at once. The sheet says that only a reviewed script retires a rule. A rule announced for a later day is added through the API by an operator for now.
Why: tightening must be quick for the day a regulator acts, and loosening slow (CAT2); a screen with no retire button keeps it that way.
