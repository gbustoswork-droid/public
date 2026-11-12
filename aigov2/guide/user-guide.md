# AI Governance Center user guide
Description: What each tab, page and feature is for, and what you can do there. Pick a topic from the contents, or open the Guide link on any page to land on the section about it.

The AI Governance Center shows how each part of your business uses AI, which rules apply, and what came of it. Everything is organized around your business groups, such as Lending or Marketing, so a compliance team, a legal team or a business owner can see their own corner of the organization without anyone assembling it by hand. People and individual conversations are a level below: you open them from a group when you need the detail.

This guide follows the tabs across the top of the application, left to right, and then the Settings pages. Each section says what the page is for, what you will find on it, and what you can do there. Every page has a small **Guide** link near its title that opens this guide on the section about that page, and the question mark in the header opens the whole guide.

## Getting started {#getting-started}

### Choosing a profile {#choosing-a-profile}

The prototype opens on a page that asks you to choose a profile. Each card is a person at Brookhaven Financial, the fictional bank the sample data describes, with their role, what they can see, and what they can do. Pick the one closest to the role you want to try. You can switch at any time from the menu under your name in the header, and refreshing the browser brings you back to this page on purpose.

- **Gabriel Bustos**, Compliance Manager. Reviews findings, registers AI assets, works the Unregistered AI queue, manages the AI Policy Rules and generates evidence packages.
- **Dan Manners**, Executive Vice President and the accountable owner of Lending. Sees Lending's facts, reconfirms its registrations and completes remediations, but cannot open the content of a conversation.
- **Tibi Popp**, Chief Technology Officer and an approver. Decides escalations and new AI systems, reviews findings in his own group, and owns the AI platforms.
- **Archive360 Administrator.** Sees everything and is the only profile that can open Settings.

### The header {#header}

The dark bar at the top is the same on every page.

- **Theme.** The moon or sun switches between light and dark mode.
- **User guide.** The question mark opens this guide in a new browser tab.
- **Applications.** The grid of squares lists the other Archive360 applications. In the prototype they are names only.
- **Notifications.** The bell shows messages addressed to you, such as an escalation that needs your decision or an evidence package that is ready. Each one links to the page where the work is.
- **Your name.** Opens a menu with Change Profile, which returns you to the profile page.

### How pages work {#how-pages-work}

Most pages share the same shape, so once you know one you know them all.

- **Tiles** under the title show counts and act as filters. Click one to narrow the list to it. Click it again, or the first tile, to go back to the full list.
- **The toolbar** holds dropdowns, a search box and **Export**, which would export the list as a file.
- **Lists** have an **Actions** menu at the end of each row. **View** opens the item. An action you are not allowed to take is still listed, greyed out, with the reason next to it, so you always know why.
- **Detail pages** have a breadcrumb that leads back the way you came, and a header line that says what the thing is and what is riding on it.
- **Needs attention** strips, on the Overview and on each group's page, list only what needs a decision or a fix. Every line links to where that is done.
- **Date range.** A group's page has a date range at the top right on the sub-pages whose numbers depend on a period. It applies to that group's page only and resets when you leave.
- **Dialogs** that need something from you keep their main button disabled, with a note beside it saying what is still missing, until you have filled it in.

### Who can do what {#who-can-do-what}

What you can see and do comes from your Archive360 Profile and Entitlement Policies, which an administrator manages outside this module. Two rules run through every page:

- **Pages and lists** follow your Profile. A tab you cannot use is not shown, and a list shows the business groups your policies cover or that you own.
- **The content of a conversation** needs an Entitlement Policy covering that group. Owning a group does not grant it: an owner sees the list of interactions and the facts about a finding, with a notice in place of the words. Every time anyone opens content, Audit History records it.

Reviewers and approvers are separate roles. A reviewer decides whether a finding is real; an approver decides what changes as a result. Nobody can review a finding on their own activity, approve an escalation they reviewed themselves, or approve a registration they own.

### Key terms {#key-terms}

- **Business group.** A part of your business, such as Lending or Human Resources. People belong to one group at a time, based on their department in your identity source. Everything in the module is organized by group.
- **AI system.** An AI platform your organization uses, such as ChatGPT Enterprise, or a custom application you built. An administrator adds them in Settings.
- **AI asset.** Something created inside an AI platform: a GPT, a Project or a Plugin in ChatGPT Enterprise. Archive360 discovers these automatically.
- **Interaction.** One conversation between a person and an AI system, as Archive360 archived it.
- **Finding.** Something an AI Policy Rule flagged in an interaction, such as a card number in a prompt. A finding becomes a **violation** only when a reviewer confirms it. A dismissed finding counts for nothing.
- **Registration.** The record that says an AI system or AI asset is approved for use, who is accountable for it, and what it is approved to do. The accountable owner **reconfirms** it on a schedule so the approval never goes stale.
- **Accountable owner.** The person who answers for a business group, an AI system or a registered AI asset.
- **Risk score.** A number from 0 to 100, worked out from the facts on record, that says where attention is needed first. Its **risk level** is the name of the range it falls in: Low, Moderate, High or Critical. See [Risk scoring](#risk-scoring).

## Overview {#overview}

The Overview is the landing page for everyone: the state of AI governance at a glance, with a link to wherever the work is done.

- **Needs attention** lists what needs a decision or a fix across the whole business: findings waiting for review, escalations waiting for an approver, groups with no active owner or no reviewer, registrations waiting for approval or expired, reconfirmations due soon, open Unregistered AI items, and approved remediations that are not finished, each with its status. Lines about your own work come first. If a group you own needs nothing, it says so.
- **The tiles** are facts that open the page behind them: business groups, people governed, registrations, AI assets and open Unregistered AI items.
- **AI use by business group, last 30 days** ranks the groups by how much AI they used in the last month, with each group's risk score, interactions, confirmed violations, people using AI, AI assets and a few words on what needs attention. Numbers link to the page that shows the same number.
- **What AI is used for, last 30 days** shows the ten things people use AI for, such as summarizing documents or drafting customer communications, with counts. Open a row to see which groups use AI for it.

## Groups {#groups}

The Groups page lists every business group and tells you whether each is ready for governance. A group is ready when it has an active accountable owner and at least one reviewer with access to its activity.

- **Tiles:** All groups, Ready, Not ready.
- **Cards or Grid** switch the layout. Each card shows the group's name in full, with its risk score and a mark for whether it is ready beneath it, then its owner, how many reviewers have access, and four counts that open the matching sub-page: Members, AI assets, Findings awaiting review and Interactions. A red footer names the gap when the group is not ready. The grid shows the same facts as sortable columns.
- **Search** finds a group by its name, its owner or one of its departments.
- **Actions** on a card or row opens any of the group's six sub-pages.

### The group page {#group-page}

Open a group and you land on its Overview. The breadcrumb row has a dropdown to switch between the sub-pages: Overview, AI assets, Members, Interactions, Findings and Audit History. The header shows the group's readiness, its owner, how many reviewers have access, its members and its departments.

The Overview holds:

- **Needs attention** for this group only: a missing or departed owner, no reviewer, findings waiting for review, registrations expired or due soon, escalations waiting, and approved remediations that are not started or in progress. Each line links to its fix.
- **Findings** in the chosen period: awaiting review, confirmed violations, dismissed, escalated.
- **Governance**, **Accountable owner** and **Reviewer access**, the three facts that make a group ready.
- **AI in the group:** how many GPTs, Projects, Plugins and custom AI applications it has, which are registered individually, and any GPT built outside your workspace that its people use.
- **What the group uses AI for**, the same ten categories as the Overview, for this group.
- **Risk**, the group's score and the items driving it. See [Risk scoring](#risk-scoring).
- **Members**, with the most relevant people first, and **Business Group Mapping**, the departments that feed this group.

### AI assets {#group-ai-assets}

One list of every AI asset associated with the group: the GPTs, Projects and Plugins created in it, the custom AI applications it owns, and any outside GPT its people use.

- **Tiles:** All, Managed within their platform, Registered individually, Built outside your workspace, AI systems it owns.
- **Type** narrows the list to GPTs, Projects, Plugins or custom AI applications. Search and Export are beside it.
- **Columns:** name, created, last activity, interactions, approval, risk.
- **Actions:** View opens the AI asset's page; View interactions opens its conversations; Open registration appears on anything registered individually.

The **Approval** column says why an asset may be used. **Managed** means it is covered by its platform's approval, which is the ordinary case. A registered asset shows its own status. An outside GPT shows Undecided or Prohibited, from the Unregistered AI queue.

### Members {#group-members}

Everyone currently in the group, with their department, last AI activity and employment status. Rows for people who are on leave, inactive or terminated are dimmed. View opens the person's page and View interactions opens their conversations. This list follows the same access rule as the People tab.

### Interactions {#group-interactions}

Every conversation attributed to the group, in a two-part view. The left pane is a tree of people: current members, former members, and people from other business groups who used this group's AI assets. Open a person to see their interactions, each with its date, the AI asset it used, and a count of confirmed violations in red or findings waiting for review in amber. The pane stays in place while the conversation on the right scrolls.

- **Quick filters** narrow the tree: members with interactions only, chat status (active, archived, deleted or temporary in the platform), only interactions with confirmed violations, findings awaiting review or dismissed findings, the apps the AI called, interactions where a GPT called an Action, and a member's or an interaction's name. The button shows how many filters are on.
- **Choose an interaction** to read it on the right: every turn, with the person's prompt and the AI's response, the model used, files that were shared (click to preview), edited prompts with their earlier version, and the apps or Actions the AI called. A line marks each day the conversation ran, with the daily collection that archived it. Flagged turns are tinted: red for a confirmed violation, amber for a finding awaiting review.
- **Show details** lists the facts: who, which AI asset, the business group, when, how many turns, chat status and files.
- **Find in this interaction** shows only the turns containing a word, highlights every match, and can limit the turns to a date range. You can reveal the turn before or after a match to read it in context, one turn at a time, as far as you like.

Nothing opens until you choose it, because opening content is recorded in Audit History.

> Example: a reviewer searching for "statement" in a long conversation sees only the three turns that mention it, then reveals the turn before each one to understand what the person asked just before.

### Findings {#group-findings}

The Findings tab for this group only, within the date range at the top of the page. It works exactly like [Findings](#findings).

### Audit History {#group-audit-history}

Who did what in this group, within the date range at the top of the page. It works exactly like [Audit History](#audit-history).

## People {#people}

A place to look up a person: which group they are in, which groups they were in before, and what AI activity they have. You cannot change anything here; a person's group comes from Business Group Mapping.

- **Tiles:** All people, Not in a group yet, On leave, Inactive, Terminated.
- **Business group** dropdown, search by name, title or department, and Export.
- **The list** is grouped by business group, each section collapsed until you expand it or narrow the list. People not in a group yet come first, with a link to where that is fixed.
- **Columns:** person, department, last AI activity, status. A small tag beside a name says when someone was placed in a group by an override or through their manager rather than by their department.
- **Actions:** View opens the person's page; View interactions opens their conversations.

You see the people in the groups your policies cover or that you own, and yourself. The Administrator sees everyone.

### The person page {#person-page}

- **Person identification:** what the identity source reports, such as job title, department, manager, employee type and ID, email, office, country and employment status. These are changed in the identity source, never here.
- **Group membership:** one row per business group the person has been in, current first, with the dates and how they were assigned.
- **AI activity:** interactions in total and in the last 30 days, and one row per AI system the person used. All interactions opens their conversations.
- **AI assets created:** the GPTs, Projects and Plugins this person built, with their approval status.
- **AI assets used from other business groups:** AI assets belonging to other groups that this person used.

A person who is not in a group yet shows a notice with a link to where they can be placed.

### A person's interactions {#person-interactions}

The same two-part view as a group's Interactions page, with the person at the top and one branch per business group, because a person's conversations stay with the group they belonged to at the time. Opened from the person's page, it can be locked to one AI system, and the pane says so.

## Findings {#findings}

Where a reviewer decides what the AI Policy Rules flagged, with the conversation in front of them. A finding becomes a violation when it is confirmed, and disappears from the counts when it is dismissed. The number on the tab is how many findings are waiting for review.

- **Tiles:** Awaiting review, Confirmed, Dismissed, Escalated, All.
- **Dropdowns** for business group, severity and AI Policy Rule, a search across people, AI assets, rules and the kind of sensitive data, and Export.
- **The queue** on the left is grouped by business group. Findings waiting for review are oldest first, so nothing waits unseen. Each row shows the severity, the rule, the person, the AI asset and how long it has waited. A flag marks an escalated finding; a **Returned** tag marks an escalation an approver sent back. Press j and k to move down and up the queue.

### Reviewing a finding {#reviewing-a-finding}

Choose a finding and the right side shows everything needed to decide it.

- **The header** gives the severity, the rule, the status and one sentence saying when and where it was detected. A notice appears when the same person or the same AI asset has had confirmed violations recently.
- **Finding:** the rule and the regulation or policy behind it, the kind of sensitive data, the severity, where it was detected (a prompt, a response, a file, a knowledge file, content an app retrieved, or an Action's request or response), the flagged text with the values marked, how many people's data was involved, the AI asset and its registration at the time, the business group and the person. If the same conversation carries other findings, they are listed so you can open them in place. Jump to the flagged turn scrolls the conversation to it.
- **Decision:** choose Confirm or Dismiss, then the reason. Confirming asks why it happened: accidental user error, deliberate disregard, the AI system's configuration, or a process gap. Dismissing asks what it was: a false positive, permitted use, test data, a duplicate, or already remediated. Add a note, and change the severity if the default is wrong, with a reason. Save decision stays disabled until the decision is complete, and the page moves on to the next finding once saved.
- **Escalate** is for the exception, when something must change. Say what: the AI system (its configuration, knowledge, instructions, sharing or registration) or this person's use of it. A remediation is proposed from the rule's guidance and you can edit it. Tick Notify the owner now if it cannot wait. Escalating an AI system suspends its registration until the approvers decide; escalating a person's conduct does not touch the registration.
- **Flag this rule for review** tells the people who manage the rules that it keeps flagging the wrong thing.
- **Conversation**, with the flagged turn outlined and the values marked; **Approved purpose and instructions** of the AI asset involved; and **History**, the audit events of this finding.

A reviewer decides findings in the groups their policies cover, never on their own activity. An owner without content access sees the facts and the decision, but not the words.

> Example: a reviewer confirms a card number pasted into a reply draft as accidental user error and does not escalate. The violation is recorded, counted in the group's risk score, and reported to the group's owner in the next digest.

### When an approver returns an escalation {#returned-escalation}

If an approver sends an escalation back, the finding shows a Returned tag and sorts to the top of the queue. The decision card shows the approver's note and a form to revise what must change and the remediation. Resubmit sends it back to the approvers.

## Approvals {#approvals}

For approvers and the Administrator: the escalated violations waiting for a decision on what changes, and the AI systems waiting to be approved for use. The number on the tab is how many wait for you.

- **Tiles:** Awaiting your decision, Awaiting others, Decided, All.
- **Dropdowns** for business group and kind (escalations or registrations), search and Export.
- **The queue** is grouped by business group, oldest first while waiting. An escalation row shows the severity, the rule, whether it is about the AI system or a person's conduct, the AI asset and the person, with "1 of 2" when a second approval is still needed. A registration row shows the AI system, its type and its owner.

### Deciding an escalation {#deciding-an-escalation}

- **Escalation** card: what must change, the proposed remediation, whether the registration is suspended pending this decision, who escalated it and when, the reviewer's assessment, and the approvals so far.
- **Decision:** Approve the remediation, Reject as accepted risk (the violation stays confirmed, nothing changes), or Return to reviewer with what must be clarified. On an escalation about the AI system you can approve while downgrading it to the person's conduct, with a reason, if the system is not the problem. A Critical violation needs two approvers.
- **Finding**, **Conversation**, **Approved purpose and instructions** and **History**, the same cards the reviewer saw.

Once approved, the remediation exists and its status is Not started. It is the owner's to carry out, and the registration stays suspended until the owner completes it and reconfirms. From then on the escalation shows the remediation's status. The owner is told immediately when a registration's status changes.

If the registration was retired while the escalation was waiting, the escalation stays in this queue until an approver decides it, and the page says who retired the registration and when. Approving it then records your decision and closes the remediation by retirement at once, because the approved change will not be made. If the person's use is the problem, downgrade it to conduct and the remediation goes to the owner.

### Approving an AI system {#approving-an-ai-system}

A new AI system arrives here as a registration waiting for approval. The page shows who added it and when, the registration's details, who can review its activity and its decision history. Approve adds an optional note; Reject requires a reason. An owner cannot approve their own.

### The owner's remediation {#owner-remediation}

A remediation is the change an approver approved. It exists from the moment the escalation is approved, and it always has one of four statuses:

| Status | What it means | How it gets there |
|---|---|---|
| **Not started** | Approved, and nobody has recorded any work yet. | The approvers approve the escalation. |
| **In progress** | Someone recorded that work has begun. | **Start the remediation**, with an optional note. This step can be skipped. |
| **Completed** | The change was made, and someone recorded what was done. | **Complete the remediation**, which requires a note saying what was done. |
| **Closed by retirement** | The registration was retired before the change was made, so the change was never made. | **Retire** on the registration, with its reason, whether that happens after the approval or before it. |

A remediation that is Not started or In progress waits in three places: the Needs attention strip of the group, the registration's page, which opens with a Remediation card, and the finding itself. Each shows the same status in the same words, with who it waits for, who started it and when, or who completed it and what was done.

- **Start the remediation** records that work has begun. Use it so that the approver and Compliance can see it has been picked up.
- **Complete the remediation** records what was done and, for a suspended registration, reconfirms it in the same step, which lifts the suspension.
- **Retiring instead:** if the AI system is no longer needed, retire its registration. The remediation is then Closed by retirement, never Completed, because the approved change was not made.
- **Who can do it:** the accountable owner. Compliance or the Administrator can start or complete it on the owner's behalf, but only the owner reconfirms. The person whose own use of AI the finding was about can never complete it; in that case it waits for Compliance or an Administrator, and the page says so.

## Unregistered AI {#unregistered-ai}

Everything Archive360 found that your setup does not account for, so nobody is accountable for it and nothing about it can be reviewed by group. Working an item means deciding what it is and where it belongs. Once decided, it leaves this page and its record lives where the decision landed. The number on the tab is the open count. Compliance and the Administrator see this tab.

- **Tiles:** All open items, then one for each kind: Department values not mapped to a group, Outside AI tools in use, API access nobody claims.
- **Columns:** the item, with a badge for its kind, one sentence saying what it is and what is riding on it, and an "Under investigation" tag when someone is looking into it; the business group of the people involved; when it was last detected.

### The three kinds and their decisions {#unregistered-kinds}

- **A department value not mapped to a group** (badge DNG, "Department Not Grouped"). Your identity source reports a department that no business group covers, so its people belong to no group and their AI activity is reviewed by nobody. Decide with **Map to a business group**, which publishes the mapping at once and places the people, or **Exclude from governance** with a reason, for a department whose activity should not be governed.
- **A GPT built outside your workspace** (badge EXT). Your people are using a GPT that somebody else built, so its instructions and knowledge cannot be archived. **Allow with an owner** registers it with an accountable owner and a purpose; **Prohibit** records that it may not be used for business, with a reason; **Dismiss** sets it aside as a duplicate, test traffic, a false positive or retired.
- **API access nobody claims** (badge KEY). A key or service principal is calling an AI vendor and no registered AI system claims it. **Assign to a registered AI system** attaches it to one; **Add as a new AI system** opens the Settings wizard already filled in; Prohibit and Dismiss work as above.

**Start investigation** marks an item as being looked into, with your name and the date, so two people working the queue do not collide; any decision ends it, or End investigation returns it to new. Mapping, excluding, assigning and adding are Administrator actions, shown greyed out with the reason for everyone else.

> Example: the identity source reports a department called Mortgage Servicing with seven people. The Administrator maps it to Lending; the seven people join Lending, their history comes with them, and Lending's owner sees them in the next digest.

### An item's page {#unregistered-item}

View opens the item: a card of facts for its kind (for a department, the mapping status and the dates it was first and last detected; for a GPT, its platform and identifier; for API access, the provider, the account, the project, the credential and its owner, and its usage), the kinds of sensitive data detected in its activity, the people involved with their counts, the Decision card with the same actions, and the decision history.

## AI Registry {#ai-registry}

The inventory of what is approved to run AI here, who answers for it, and when that was last confirmed, and the place where registration work happens. AI systems arrive here from Settings. AI assets are registered here only when they need their own owner and schedule; the ordinary GPTs, Projects and Plugins created inside an approved platform are covered by that platform's approval.

### Registered {#registered}

Every registration in one list, riskiest first.

- **Tiles:** All registrations, Awaiting approval, Due within 60 days, Expired or suspended.
- **Dropdowns** for business group and accountable owner, including Owned by me, search and Export.
- **Columns:** name and type, business group, accountable owner, approval status, risk.
- **Actions:** View, Generate evidence package, Edit registration, Reconfirm, Retire, and Approve or Reject while a registration is awaiting approval. The Administrator also gets Configure in Settings.

### All AI Assets {#all-ai-assets}

Every GPT, Project and Plugin Archive360 discovered, grouped by business group, with the sections collapsed until you expand them or narrow the list.

- **Tiles:** All AI assets, Managed within their platform, Registered individually, Built outside your workspace.
- **Dropdowns** for business group, platform and type, search and Export.
- **Columns:** name and where it was created, created date, last activity, interactions, approval, risk.
- **Actions:** View AI asset, View interactions, and Register individually, or Open registration once it has one.

### A registration's page {#registration-page}

The header names the AI system or AI asset, its status and what it is. The cards:

- **Remediation**, only while an approved remediation is Not started or In progress: what must change, who approved it, its status, and Start the remediation and Complete the remediation. See [The owner's remediation](#owner-remediation).
- **Registration:** the owner, the business group, the approved purpose, the kinds of sensitive data it is permitted to handle, the approval with its due date and anything blocking it, how often it must be reconfirmed, and how its interactions are archived.
- **The AI asset as Archive360 archived it**, for a GPT, Project or Plugin, with a link to its page. A platform's registration shows instead the apps, plugins and custom Actions its administrator enabled.
- **Evidence packages**, see below.
- **Risk**, see [Risk scoring](#risk-scoring).
- **Who can review its activity**, the reviewers whose policies cover the group.
- **Decision history**, every registration, approval, reconfirmation, suspension and retirement, with who and when.

The buttons under the Registration card are the same actions as the list's menu. Each is greyed out with its reason when you cannot take it.

### Registering, approving, reconfirming and retiring {#registration-actions}

- **Registering an AI system** happens in Settings when the Administrator adds it. It arrives here awaiting approval.
- **Registering an AI asset individually** starts from its row on All AI Assets or on a group's AI assets page. The wizard proposes the group's owner as the accountable owner, asks for the approved purpose and the kinds of sensitive data it may handle, then shows a summary. It is approved on save.
- **Approving** is an approver's decision, here or on Approvals. Rejecting needs a reason.
- **Reconfirming** is the owner's check that the AI system or asset is still needed and still used for its approved purpose. It is available at any time, states the dates involved, and sets the next due date. The schedule is six months for a High or Critical risk score and twelve months otherwise, fixed at the time of approval or reconfirmation.
- **Editing** changes the owner, purpose or permitted data of an individual registration.
- **Retiring** records that it is no longer approved for use, with a reason. The owner or Compliance can retire. If an approved remediation on it is not finished, retiring closes that remediation as Closed by retirement. If an escalation about it is still waiting for an approver, retiring does not close the escalation: it stays in the approvers' queue.

### Evidence packages {#evidence-packages}

A dated package for an auditor: an AI system's governance record frozen for a period, with the list of its interactions in that period, a documented sample of them, and the criteria to produce the full set from Archive360.

- **Generate evidence package** on the registration's page or in the list's Actions menu asks for the period (Last quarter, Last 12 months, Since approval, or your own dates), shows how many interactions, findings and sample records that covers, then a summary.
- **The job** runs in the background: queued, in progress, completed. You get a notification in the bell when it is ready.
- **The package's page** shows its manifest (scope, period, population, sample and method, collection, criteria for full production), what it contains, the export's status and size, and its history. In the real product the file is downloaded and deleted from Archive360's Exports page; the prototype offers a stand-in download so you can see the contents.

Generating a package needs the Allow Generate Evidence Package permission, which the Compliance Manager and Administrator profiles have.

### An AI asset's page {#ai-asset-page}

Everything Archive360 archived about one GPT, Project or Plugin. It is for reading; registration and every action happen on the AI Registry.

- **Configuration**, with a Current view and a Change history. For a GPT: description, instructions, conversation starters, recommended model, knowledge files (click one to preview it), capabilities, and the apps it uses or the Actions it calls, each Action with its operations and whether it asks the person first. For a Project: memory type, instructions, files, pasted text sources and linked sources. For a Plugin: its skills, apps and MCP servers. The Change history is a dated list of every change, newest first, with what changed in plain words.
- **Shared with:** who can use it, as the last sync found it: the creator, the whole workspace, named people and platform groups.
- **Risk**, see [Risk scoring](#risk-scoring).
- **AI asset details:** type, platform and workspace, business group, creator, created date, status in the platform, and its approval.
- **Activity:** interactions in total and in the last 30 days, the last activity, the split by business group, the apps used and Actions called, and the people who used it. Open the interactions goes to its conversations.

A GPT built outside your workspace shows a notice instead of a configuration, because none of it is archived.

### An AI asset's interactions {#ai-asset-interactions}

The same two-part view as a group's Interactions page, limited to one AI asset, with the people who used it on the left. It opens from View interactions on any list, from the Activity card, and from the Risk card's factors. Opened from a factor, the tree shows only the interactions behind those points, a line at the top says which and why with a Show all link, and the right side lists the findings involved until you open one.

## AI Policy Rules {#ai-policy-rules}

The rulebook: the rules that decide when sensitive data in an AI interaction is a violation, what each one detects, where that data is allowed, how serious a violation is, which regulation or policy it rests on, how each rule performs, and how it has changed. Everyone with a governance role can read it; Compliance and the Administrator can change it. A finding always keeps the version of the rule it was judged under, so changing a rule never rewrites history. The same tab holds the Risk scoring view, where the weights behind the risk score are set. It is described under [Risk scoring](#risk-scoring), with an example of how a score adds up.

### Rules {#rules-list}

- **Tiles:** All rules, Flagged by reviewers, Inactive.
- **Dropdowns** for the rule family and for the rules that apply to one business group, search, Export and Create rule.
- **Columns:** the rule, its family and version; the kinds of sensitive data it detects; where that data is permitted; the default severity; the regulatory basis; its findings in the last 90 days, split into confirmed, dismissed and awaiting review, with a note when most dismissals were false positives.
- **Actions:** View, Edit rule, Deactivate or Activate, and Delete, which is only possible while no finding refers to the rule.

### Permitted data by business group {#permitted-data}

One table: the business groups down the side, the kinds of sensitive data across the top, and in each cell whether that data is Permitted, Not permitted, Prohibited everywhere, Conditional, or covered by no rule. Hover a cell to see the rules behind it. It is worked out from the active rules and is never edited directly.

### A rule's page {#rule-page}

- **Rule:** what it detects, where it is permitted and what follows from that, what it looks at, the default severity, the regulatory basis, the remediation guidance that is proposed when a finding is escalated, and the owner.
- **Performance:** findings in the last 90 days and since the rule began, confirmed, dismissed and awaiting, with the reasons given for dismissals and the groups it fires in most. A rule reviewers keep dismissing as a false positive is a rule to fix.
- **Flagged by reviewers:** each flag with the reviewer's note and a link to the finding. Changing the rule answers every open flag; Keep it as it is answers them with a note.
- **Versions:** every version, newest first, with what changed and who published it.

### Creating and changing rules {#changing-rules}

- **Edit rule** changes the name, where the data is permitted, the severity, the basis or the guidance, with a required note, and publishes a new version at once. What a rule detects is fixed when it is created.
- **Create rule** asks for a name, whether the data is permitted only in named groups or prohibited everywhere, the kinds of sensitive data, the severity, the basis and the guidance, then a summary.
- **Deactivate** stops a rule producing new findings, with a reason; its findings and history stay. **Activate** brings it back.

## Audit History {#audit-history}

Who did what, and when, across the module: the record an auditor asks for. It is read-only and exportable.

- **Tiles:** All events, Registrations and approvals, Setup changes, People synchronized, Notifications sent, Review decisions, Content viewed.
- **Toolbar:** business group, From and To dates (the last 30 days to start with), a search over the row's words, and Export.
- **Columns:** when, who (a person, or Archive360 for an automatic event), what happened with a link to the item it concerns, and the business group.

You see the events of the groups your policies cover or that you own, events that belong to no group, such as a mapping change or a rule version, and your own actions. The Administrator sees everything.

## Settings {#settings}

Only the Archive360 Administrator can open Settings. The five pages sit in the order a new customer works through them: configure first, verify last.

### AI Systems {#ai-systems}

The AI platforms and custom applications your organization uses, and how each one's interactions are archived.

- **The list:** each AI system with its accountable owner, its record class, whether it is active, how many items are archived and when the last one arrived.
- **Add AI system** is a three-step wizard: the name, type (ChatGPT Enterprise, Claude Enterprise, Microsoft 365 Copilot or a custom AI application), accountable owner and approved purpose; then the record class that holds its data, or Not archived with the reason, for a system you want governed without archiving its interactions; then a summary. Saving registers it, and it waits for an approver on the AI Registry.
- **Actions:** View, with a summary of what is archived; Edit; Deactivate, with a reason, when it is no longer in use; Delete, only while it has no governance record.

Record classes are created in Archive360 before an AI system's interactions can be archived.

### Business Groups {#business-groups}

The groups the whole module is organized around. Create them to match your organization and name who is accountable for each.

- **The list:** each group with its accountable owner, members, departments mapped to it and status.
- **Add business group:** a name, an optional description and an accountable owner. The group exists as soon as you save; members join it when their department is mapped to it on Business Group Mapping, and a new group is called out until one is.
- **Actions:** View, Edit (rename or change the owner), Deactivate with a reason once nothing maps to it, Delete only while it has no governance record. Inactive groups stay here but leave the rest of the module.

### Business Group Mapping {#business-group-mapping}

How people land in business groups automatically, so nobody has to be placed by hand.

- **Identity source:** the system people are synchronized from, the attribute used (Department, chosen once and changed only deliberately), whether a blank value falls back to the person's manager, and the published version with its history.
- **Department values:** every value the identity source reports, with the group it maps to, how many people carry it and its status. Filter by All, Unmapped, Mapped or Excluded, search, or select several values and map them at once. Each row's picker also offers New business group and Exclude from governance. Actions show a row's version history and the people who carry the value.
- **Individual overrides:** the few people placed in a group other than the one their department implies, each with a reason.
- **Publish changes** makes staged edits live as a new version, re-attributes the people affected, and resolves any Unregistered AI items for departments that are now mapped.

Excluding a department is a decision with a reason: its people are not governed, though Archive360 keeps archiving their activity.

> Example: the identity source has both "Loan Servicing" and "Mortgage Servicing". Mapping both to Lending puts everyone in those departments into Lending, with their history.

### Notifications {#notifications}

How each business group's owner hears about their group's AI governance without logging in.

- **Digest schedule:** a scheduled summary per group, daily, weekly or monthly, with Set all to apply one choice everywhere. The table shows each group's owner, frequency and last notification. Preview next digest shows what the next one would say today.
- **Immediate notifications:** the four events that cannot wait: an AI system's approval status changes, a violation is confirmed on an expired or suspended system, a Critical violation is confirmed, and a remediation is sent back or rejected.
- **Reconfirmation reminders:** when owners are reminded before a reconfirmation is due.

Save changes applies the page. Notifications carry counts and links, never the content of an interaction.

### Readiness check {#readiness-check}

The last step before governance runs: a read-only check that every group has an active, accountable owner and at least one reviewer who can see its activity.

- **Tiles:** All groups, Ready, No reviewer has access, No active owner.
- **The table:** each group with its owner, the reviewers with access, Ready or Not ready, and for each gap the reason and where to fix it: owners on the Business Groups page, reviewer access in Archive360 Administration.

## Risk scoring {#risk-scoring}

A risk score says where attention is needed first. It is a number from 0 to 100, worked out from the facts on record, and recomputed every time a page is drawn. It is a priority, not a verdict. This section explains how a score adds up, with an example, and how the weights behind it are changed on the Risk scoring view of AI Policy Rules.

### How a score is worked out {#how-a-score-is-worked-out}

1. Archive360 scores one AI system or AI asset at a time. A person never has a score, and neither does a single interaction.
2. It checks eleven factors. Each factor looks at one kind of fact, such as the violations a reviewer confirmed, or whether an approval has expired.
3. A factor that finds nothing adds 0. A factor that finds something adds points, up to a limit of its own, so no single factor can carry the whole score.
4. The points of all the factors are added together. That total is the risk score, and it never goes above 100.
5. The score falls into a risk level: Low below 25, Moderate from 25, High from 50 and Critical from 75, unless your organization has moved where they start.

### An example {#risk-score-example}

This example is made up, to show the arithmetic. Access Request Helper is a GPT in the Information Technology business group. The service desk uses it to answer requests for access to systems. It has its own registration on the AI Registry, and every factor is at its Standard weight.

:::score
Confirmed violations, 90 days | In the last 90 days a reviewer confirmed three violations in its interactions, by three different people: one Critical, one High and one Medium. | 10 + 6 + 3 | 19
Sensitive data handled, 90 days | Two kinds of sensitive data were found in its interactions, which adds 2 for each kind. Five interactions carried sensitive data, which adds 1 for each: the three with violations, and two with findings still awaiting review. | 4 + 5 | 9
Approval | Its approval has expired, because nobody reconfirmed it in time. | 15 | 15
Accountable owner | Its accountable owner is on leave. | 10 | 10
Configuration drift | A knowledge file was added after it was last approved. This counts once, however many changes there were. | 5 | 5
Reach | Everyone in the workspace can use it. | 4 | 4
Review coverage | Reviewers have access to Information Technology's activity. | | 0
Open remediation | No escalation about it is unfinished. | | 0
Recurring conduct | Nobody has three or more confirmed violations on it. | | 0
Review backlog | The two findings awaiting review have waited less than 30 days. | | 0
Origin | It was built inside your workspace. | | 0
:::

Information Technology's own score is 62 as well. A business group scores as its riskiest AI system or AI asset, plus points for the group's own two gaps: no active accountable owner, and no reviewer with access. Information Technology has neither gap, and nothing in it scores higher than Access Request Helper.

### What changes a score {#what-changes-a-score}

A score moves when the facts move. Three things that could happen to the example:

| What happens | What it does to the factors | New score | Risk level |
|---|---|---|---|
| The two findings awaiting review are confirmed as Critical violations. | Confirmed violations would be 19 + 10 + 10 = 39, but the factor stops at its limit of 30. That is 11 more points. | 62 + 11 = 73 | High |
| A new accountable owner is named and reconfirms the registration. | Accountable owner, Approval and Configuration drift stop adding points. That is 10 + 15 + 5 = 30 fewer points. | 62 − 30 = 32 | Moderate |
| The weight of Confirmed violations is set to Lower. | A Critical violation then adds 5, a High 3 and a Medium 2. The factor adds 5 + 3 + 2 = 10 where it added 19, which is 9 fewer points. | 62 − 9 = 53 | High |

A score also falls by itself as time passes. A confirmed violation stops counting 90 days after it was detected, so the example loses 10 points on the day its Critical violation becomes too old.

### Changing the weights and risk levels {#changing-risk-scoring}

This is done on the Risk scoring view of the AI Policy Rules tab. It sets how much each factor counts and the score at which each risk level starts. Everyone with a governance role can read it; Compliance and the Administrator can change it.
- **Factors:** the eleven factors of the risk score. Each row says in a sentence what the factor is, then the points it adds, its weight and the most it can add. A weight is Off, Lower, Standard or Higher: Lower counts the factor about half as much as Standard, Higher about one and a half times as much, and Off leaves it out. The points shown are always the ones that count at the weight selected, in whole numbers, and they change as you change the weight. The factors themselves are fixed.
- **Risk levels:** the scores at which Moderate, High and Critical start.
- **Staging a change:** choose a weight or type a new starting score and the change is staged, not applied. The page then shows what would change: every AI system, AI asset and business group whose risk level would move, with its score now and after publishing. Discard drops what is staged.
- **Publish changes** asks for a note saying what changed and why, and publishes a new version at once. Every score follows on its next view, and the change is recorded in Audit History. A reconfirmation schedule that is already set does not move; the next approval or reconfirmation uses the risk level of that day.
- **A risk level out of reach:** no AI system or AI asset can score more than its factors' limits added together. If your weights make that total smaller than the score where a risk level starts, nothing could ever reach that level. The page says so and names the level. It is a warning, and you can still publish.
- **Restore product default** stages the scoring the product ships with: every factor at Standard, and the risk levels starting at 25, 50 and 75.
- **Versions:** every version, newest first, with its note and what changed.

> Example: an organization whose examiners care most about accountability sets Accountable owner to Higher. Before publishing, the page lists the AI assets whose risk level would rise because their owner has left.

### Where scores appear {#where-scores-appear}

- **Where you see it:** a pill on the Groups cards and grid and on the Overview's table; a Risk column on the AI Registry and on a group's AI assets page; and a Risk card on a registration's page, an AI asset's page and a group's Overview.
- **The Risk card** shows the score, its risk level, its movement over the last 30 days, and every factor that adds points, with what it rests on and what would lower it. Click a factor to open its evidence. How risk is scored lists all eleven factors with the points each can add.
- **The eleven factors:** confirmed violations in the last 90 days, by severity; the kinds and amount of sensitive data handled in the last 90 days; an approval that is expired, suspended, rejected or still pending; an owner who is missing or not active; no reviewer with access; configuration changes since the last approval; how widely it is shared and whether it calls outside systems; unfinished escalations; people with repeated violations; findings waiting for review for more than 30 days; and a GPT built outside your workspace. Dismissed findings add nothing.
- **The version in force** is named on the Risk card. The weights and the risk levels are changed as described under [Changing the weights and risk levels](#changing-risk-scoring).
- **Reconfirmation follows the risk level:** at approval or reconfirmation, the schedule is set from the risk level at that moment, six months for High and Critical, twelve otherwise, and stays fixed until the next reconfirmation.
