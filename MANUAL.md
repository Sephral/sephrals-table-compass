# Sephral’s Table Compass: Manual

## For players

Open the compass from the token controls on the left (compass icon) or with a key you set in Foundry's controls. The small window has three tabs:

* **Now:** quick signals for the moment: *Break, please*, *Lost the thread*, *Not enough spotlight*, *More of this!* and *Tech trouble*. A second click takes a signal back. Below them the **X card**: it asks the GM to skip the current topic, without a reason. The GM sees it at once, and everyone learns when the GM has seen it.
* **Mood:** one scale per topic with five steps: much too little, a bit too little, fine (the big middle dot), a bit too much, much too much. Click a step to vote, click it again to take the vote back. A vote fades after 20 minutes (setting), so the picture belongs to the current scene. Vote again to renew it.
* **Wishes:** what you would like next. A wish stays until the end of the session, until you take it back or until the GM marks it fulfilled. A small green dot means the GM announced it as coming soon.

When the GM starts a **scene check**, a small window asks "How was the scene?" with five faces for 30 seconds. You can change your answer until the time is up.

When the GM starts the **feedback round**, a form opens: stars for the session, the pace, a table of topics (highlight, more next time, less next time) and, if the GM allows it, a rose (what was good), a thorn (what bothered you) and a bud (what you look forward to). *Send anonymously* sends it, *Change my answers* lets you change it until the GM closes the round. *Skip* closes the form. While the round runs, the compass shows a line on top which opens the form again, also after skipping.

## For the GM

The GM's window starts collapsed as an orb in the top right corner. Click the orb to open the window, the dash in the title bar collapses it again. Drag the orb wherever you like. Green means calm, amber means signals or a scale far off, red means an X card.

* **On top:** the X card with *Seen*, then the signals with their count. A click on a signal ticks it off for everyone.
* **The middle panel**, three views (buttons on the right):
  * **Balance:** each scale as a bar with fine in the middle. Small dots are single votes, the big dot is the average. Green is fine, amber a bit off, terracotta far off, blue split (some want more, some less). A scale shows only from two votes on (setting).
  * **Compass rose:** each spoke points where the table wants more. Outside the dashed ring the table wants more of it, inside less.
  * **History:** a line per scale over the session, with marks for X cards, scene checks, fulfilled wishes and the feedback round.
* **Wishes:** the three most wished for, with their count. Click a wish for *Coming soon* (the players see it on the tile) or *Fulfilled* (it goes off for everyone).
* **Scene check** and **Feedback round** at the bottom. While the round runs, the button shows how many answered and closes the round.
* **The menu of the title bar:** *New session* (votes, signals, wishes and the history start again), *Feedback rounds* (the results) and *Scales, signals and wishes*.

A new session also starts on its own after six hours without players online.

### More than one GM

The active GM's client collects the votes. Other GMs (for example an assistant GM) see a copy of the window and can acknowledge the X card, tick off signals and answer wishes, the active GM's client carries it out for everyone. Scene check and feedback round are started by the active GM. When the active GM leaves, the next GM takes over and the players' clients send their votes again.

### Reloads and leaving

* A reload of the GM's client keeps the session and a running feedback round: the players' clients send their votes, signals, wishes and answers again. Votes and signals keep fading from when they were cast. A running scene check ends.
* What a player says while no GM is online, the X card included, goes out as soon as a GM joins.
* A player's own votes stay in the browser, so after a reload the compass still shows them.

## Feedback rounds

Closing the round shows the result: the stars with their distribution, the pace, the highlights, what the table wants more or less of, the free texts in a random order and the wishes of the session (fulfilled, coming soon, open). With fewer answers than the minimum the result only says how many came. *Save to the journal (GM only)* writes the result into the journal entry *Table Compass*, which only GMs can see. The last ten rounds stay in the window *Feedback rounds* on the GM's computer.

## Anonymity

* Players send their votes only to the active GM's client, never to the other players.
* Foundry's server names the sender of every socket message. The module uses it only to tell a player from a GM and drops it right away: votes are kept by a random token per scale, signal and wish, never by user, and no name is shown or stored.
* Scales, scene checks and the feedback round show results only from the minimum number of answers on (2 by default).
* New votes reach the GM's window after a random wait (setting: none, short 15 to 45 seconds, longer 30 to 90 seconds), so a click cannot be matched to the player who just moved the mouse. The X card always arrives at once, and neither the X card nor anything the GM does in the meantime shows the votes still waiting.
* Free texts come back in a random order. They can still reveal their writer by style, the form says so, and the GM can turn free text off.
* With only one player online nothing can be anonymous. The windows of the GM and the player say so.
* Limits: a GM who reads the network traffic of their own client with the browser's developer tools can see which user sent a message. The module protects against telling votes apart by accident, not against a GM who sets out to spy.

## Settings

All options are in *Game Settings → Configure Settings → Sephral’s Table Compass*. The gear in the title bar of the compass opens them directly, for players too:

| Setting | What it does |
| --- | --- |
| Module language | Follow Foundry, German or English, for you |
| Look | Warm paper colors (Signature) or the dark colors of Foundry, for you |
| Votes before anything shows | Minimum number of votes for a scale, a scene check and the feedback round (1 to 5, default 2) |
| Delay of the GM's view | None, short or longer random wait before new votes show |
| Votes fade after | Minutes a vote on a scale counts (5 to 60, default 20) |
| Signals last | Minutes a signal stays unless the GM ticks it off (1 to 30, default 5) |
| Free text in the feedback round | Rose, thorn and bud on or off |
| Sound for the X card | A short sound on the GM's client |
| Scales, signals and wishes | Which ones the players' window offers |
| Self test | Checks the socket, the GM, the storage and the texts |

## Usage statistics

The module can take part in a small usage report shared by all of Sephral’s modules. Nothing is counted or sent until the GM agrees: shortly after the world starts, the active GM is asked, and the question comes back at every start until there is an answer. The answer counts for all of Sephral’s modules in the world. *Share usage statistics* in the module settings turns the report on or off at any time, and *Manage statistics* below it shows what the report contains right now.

With the GM’s consent only the active GM’s browser counts, and it sends at most one report a day. The question lists everything the report contains, from the Foundry version to a random world ID. For the Table Compass it holds:

* on how many of the last 30 days the module was used
* how often scene checks and feedback rounds run, a new session starts, the GM saves which scales, signals and wishes are offered, past results are opened and the GM switches between the compass and the history
* the settings *Look* and *Delay of the GM's view* (only the chosen option)
* whether the GM uses the window or the orb
* where errors occur in the module code: file, line and error type, never the error message

No names, chat messages, notes, dice results or other content of the world are sent. Votes, signals, wishes and the X card are never counted, and neither is who gave feedback.

## Storage

* World setting `public`: what everyone may know (the session, announced and fulfilled wishes, ticked off signals, acknowledged X cards, a running scene check or round). No votes.
* World setting `choices`: the scales, signals and wishes of the table.
* Client settings on the GM's computer: the history of the session and the last ten feedback rounds.
* The players' own votes stay in their browser (local storage), so they can change or take them back.

## API

`game.modules.get("sephrals-table-compass").api`:

| Function | Does |
| --- | --- |
| `open()` | Opens the GM's window for a GM, the players' window for a player |
| `startPoll()`, `startRound()`, `closeRound()` | Scene check and feedback round (active GM) |
| `newSession()` | Starts a new session (active GM) |
| `view()` | What the GM's window shows: summaries only |
| `results()`, `openResults()` | The feedback rounds on this GM client |
| `history()` | The history of the session on this GM client |
| `choices()`, `openChoices()` | The scales, signals and wishes of the table |
| `publicState()`, `myState()` | What everyone may know, what this player said |
| `openFeedback()` | Opens the form of a running round again (player) |
| `runSelfTest()` | The self test (GM) |
