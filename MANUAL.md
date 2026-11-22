# Sephral’s Table Compass: Manual

## For players

Open the compass from the token controls on the left (compass icon) or with a key you set in Foundry's controls. The small window has three tabs:

* **Now:** quick signals for the moment: *Break, please*, *Lost the thread*, *Not enough spotlight*, *More of this!* and *Tech trouble*. A second click takes a signal back. Below them the **X card**: it asks the GM to skip the current topic, without a reason. The GM sees it at once, and everyone learns when the GM has seen it.
* **Mood:** one scale per topic with five steps: much too little, a bit too little, fine (the big middle dot), a bit too much, much too much. Click a step to vote, click it again to take the vote back. A vote fades after 20 minutes (setting), so the picture belongs to the current scene. Vote again to renew it.
* **Wishes:** what you would like next. A wish stays until the end of the session, until you take it back or until the GM marks it fulfilled. A small green dot means the GM announced it as coming soon.

* **Lines and veils:** below the X card the button *Lines and veils* opens a window for the session zero and for any time later. A **line** is something that never happens in this game: it is not described, not shown, not played. A **veil** is something that may happen, but off screen: the story moves on and nothing is shown. Click the suggestions or write your own words, click again to take one back. Below you see the list of the whole table, without names. Your entries stay in your browser for the whole campaign, a new session does not reset them. When the GM asks the table for its lines and veils, the window opens by itself.

When the GM starts a **scene check**, a small window asks "How was the scene?" with five faces for 30 seconds. You can change your answer until the time is up.

When the GM starts the **feedback round**, a form opens: stars for the session, the pace, a table of topics (highlight, more next time, less next time) and, if the GM allows it, a rose (what was good), a thorn (what bothered you) and a bud (what you look forward to). *Send anonymously* sends it, *Change my answers* lets you change it until the GM closes the round. *Skip* closes the form. While the round runs, the compass shows a line on top which opens the form again, also after skipping.

## For the GM

The GM's window starts collapsed as an orb in the top right corner. Click the orb to open the window, the dash in the title bar collapses it again. Drag the orb wherever you like. Green means calm, amber means signals or a scale far off, red means an X card.

* **On top:** the X card with *Seen*, then the signals with their count. A click on a signal ticks it off for everyone.
* **The middle panel**, three views (buttons on the right):
  * **Balance:** each scale as a bar with fine in the middle. Small dots are single votes, the big dot is the average. Green is fine, amber a bit off, terracotta far off, blue split (some want more, some less). A scale shows only from two votes on (setting).
  * **Compass rose:** each spoke points where the table wants more. Outside the dashed ring the table wants more of it, inside less.
  * **History:** a line per scale over the session, with marks for X cards, scene checks, fulfilled wishes and the feedback round.
  * **Spotlight** (people icon, switched on in the settings): per player a soft bar and how long ago their character was last in the spotlight. See [Spotlight](#spotlight).
* **Wishes:** the three most wished for, with their count. Click a wish for *Coming soon* (the players see it on the tile) or *Fulfilled* (it goes off for everyone).
* **Scene check** and **Feedback round** at the bottom. While the round runs, the button shows how many answered and closes the round.
* **The menu of the title bar:** *New session* (votes, signals, wishes and the history start again), *Feedback rounds* (the results), *Lines and veils* and *Scales, signals and wishes*.

A new session also starts on its own after six hours without players online.

### Spotlight

The fourth view of the middle panel shows who has had the spotlight and who has not for a while. It is a rough picture for the GM, not a log.

* **What counts:** rolls of a player (whispered ones too), in-character messages and cards of a character (an item used, a spell cast), token moves of the player in a running combat, and your own mark: the spotlight icon at the end of a row says "this player was just in the spotlight". Table talk out of character only warms the bar. Whispers and the GM's own messages never count. The same kind of signal from one player counts once in a few seconds, so a token moved square by square is one move.
* **What it shows:** per player how long ago ("just now", "12 min ago", "1 h 5 min ago", or "not yet" this session) and a soft bar. The bar is the share of the recent activity, which fades by half every 20 minutes, never a number. Only the players online are listed.
* **The gentle hint:** when a player has been quiet for the time of the setting *Quiet hint after* (20 minutes by default) and at least twice as long as the others, while somebody else was in the spotlight, one line says "Not in the scene for a while: Ben. Maybe time for a scene of their own." and a dot appears on the view button. At most two names. When everybody is quiet, for example during a break, nobody is singled out. A player who just arrived counts from their arrival.
* **The anonymous signal:** if players sent *Not enough spotlight*, a line says how many. It is not matched to the names above.
* **Privacy:** only the GM sees the view, nothing of it is sent to the players. It keeps one time and one fading score per player and never a text, a roll or a result. It starts again with every new session and stays on the active GM's computer (other GMs get a copy of the window). It is the one part of the module that names players, and it is kept apart from the votes: the view of the votes never holds a name. *Spotlight view* in the settings switches it off, the module then does not listen to the chat and the map at all.

### Lines and veils

The window *Lines and veils* (menu of the GM's title bar, or the button in the players' compass) is for the session zero and any time later.

* **Players:** click a suggestion (harm to children, sexual violence, torture, gore, harm to animals, abuse, slavery, suicide, body horror, spiders, snakes, insects, needles, drowning, being trapped, serious illness) or write your own words (up to 80 characters, the setting *Own words for lines and veils* can turn that off). Up to 12 entries per player.
* **The shared list:** lines before veils, the suggestions in a fixed order, own words alphabetical. The same entry of several players is one entry, and nobody sees how many. It stays on the list until nobody holds it any more.
* **The GM:** sees the same list without names, can add entries of their own (marked *GM* for everybody, taken back with a click) and *Ask the table* opens the window on every player's screen. A GM who is not the active one asks the active GM, like for the other actions.
* **Anonymity:** an entry travels like a vote, with a random token, only to the active GM's client. New entries reach the list after the same random wait as new votes (setting *Delay of the GM's view*), so an entry cannot be matched to the player who just clicked. Free text can reveal its writer by style, as in the feedback round.
* **Campaign, not session:** the list stays when a new session starts. The players' clients send their entries again when the GM's client loads. If another GM's computer takes over, an entry whose player is offline stays on the list until that player is back and takes it away.

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
* Lines and veils follow the same rules as the votes (see [Lines and veils](#lines-and-veils)). The spotlight view is the exception: see [Spotlight](#spotlight).
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
| Spotlight view | The fourth view with who had the spotlight (GM). Off: the module does not listen to chat and map |
| Quiet hint after | Minutes of quiet (10 to 60, default 20) before the gentle hint can appear |
| Own words for lines and veils | Players may write their own besides the suggestions |
| Scales, signals and wishes | Which ones the players' window offers |
| Self test | Checks the socket, the GM, the storage and the texts |
| Save debug file | One file for bug reports about all of Sephral’s modules (GM). See [Debug file](#debug-file) |

## Debug file

For bug reports, the GM saves one file about all of Sephral’s modules in this world: `Save debug file` in the module settings, or `Save Debug File (Sephral’s Modules)` in the context menu of a chat message. It holds the versions of Foundry, the system and the active modules, the settings of the modules and what they recorded, for Table Compass only counts: the session, a running scene check or feedback round, how many signals, votes and answers the active GM holds, whether the spotlight view is on and how many entries the shared list of lines and veils has. No votes, tokens, wishes or ratings of a player go into it, and the history and results of the feedback rounds, the spotlight and the lines and veils stay out. Macros call `game.modules.get("sephrals-table-compass").api.saveDebugFile()`.

The file contains chat text and whispers. Check it before you share it.

## Sephral’s Modules

The first button in the module settings, *Sephral’s Modules* (GMs only), opens one window for all of Sephral's modules in the world: the version, self test, settings, manual and demo video of each, a button that switches on an installed module that is off (Foundry then reloads the world for everyone), and the debug file. Below, *More from Sephral* lists other modules that fit the game system of the world, shown only after a click, each with its demo video and an *Install* button. Foundry installs modules only on its setup screen, so the button copies the module's link (manifest URL) and shows the steps with a short clip. When the GM launches the world again, the window opens once with the new module and its *Enable* button. The list is part of the module. Only a video you start is loaded, from the module page on GitHub. If the GM agreed to the usage statistics, the window also counts how it is used: opened, the other modules shown, a video or install link of one of them, a module installed or switched on from it. It never records which module.

## Usage statistics

The module can take part in a small usage report shared by all of Sephral’s modules. Nothing is counted or sent until the GM agrees: shortly after the world starts, the active GM is asked, and the question comes back at every start until there is an answer. The answer counts for all of Sephral’s modules in the world. *Share usage statistics* in the module settings turns the report on or off at any time, and *Manage statistics* below it shows what the report contains right now.

With the GM’s consent only the active GM’s browser counts, and it sends at most one report a day. The counts are kept in a hidden world setting, so all browsers and computers of the GM count together, and turning the statistics off deletes them. A copy of a world gets its own world ID. The question lists everything the report contains, from the Foundry version to a random world ID. For the Table Compass it holds:

* on how many of the last 30 days the module was used
* how often scene checks and feedback rounds run, a new session starts, the GM saves which scales, signals and wishes are offered, past results are opened and the GM switches between the compass, the history and the spotlight
* how often the GM marks a player in the spotlight view, opens the window for lines and veils, adds an entry of their own and asks the table for its lines and veils
* the settings *Look*, *Delay of the GM's view* and *Spotlight view* (only the chosen option)
* whether the GM uses the window or the orb
* where errors occur in the module code: file, line, error type and whether the error arose in the module itself, in Foundry, in the game system or in another module, never the error message or the name of another module

No names, chat messages, notes, dice results or other content of the world are sent. Votes, signals, wishes, lines, veils and the X card are never counted, and neither is who gave feedback or who had the spotlight.

## Storage

* World setting `public`: what everyone may know (the session, announced and fulfilled wishes, ticked off signals, acknowledged X cards, a running scene check or round). No votes.
* World setting `choices`: the scales, signals and wishes of the table.
* World setting `lv`: the shared list of lines and veils (entries only, no names, no tokens).
* Client settings on the GM's computer: the history of the session, the last ten feedback rounds, the spotlight of the session (`spotlightBook`) and which token belongs to which entry of lines and veils (`lvTokens`).
* The players' own votes stay in their browser (local storage), so they can change or take them back. Their lines and veils stay there too, for the whole campaign.

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
| `spotlight()` | The spotlight view on this GM client: rows with name, minutes and bar, the quiet ones |
| `markSpotlight(userId)` | Marks a player as in the spotlight now (GM) |
| `openLines()`, `lines()`, `callLines()` | The window for lines and veils, the shared list, asking the table (GM) |
| `choices()`, `openChoices()` | The scales, signals and wishes of the table |
| `publicState()`, `myState()` | What everyone may know, what this player said |
| `openFeedback()` | Opens the form of a running round again (player) |
| `runSelfTest()` | The self test (GM) |
| `samples()` | The list of sample windows: the real windows (GM window with its views, players' window, scene check, feedback form, results, lines and veils) filled with made-up votes of four players. Nothing is saved or sent, buttons that would change something do nothing. For translators and testers |
| `saveDebugFile()` | The debug file of Sephral’s modules (GM), see [Debug file](#debug-file) |
