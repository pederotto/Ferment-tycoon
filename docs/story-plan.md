# Story and tutorial: decisions so far

Working notes, 30 Sep 2026. The story and the tutorial are one thing: each chapter is a story beat and a lesson, and each ends with something the player earned.

## Premise
- The player won a blind tasting (twelve unlabelled jars). The prize was a partnership in a craft ferment house, offered by an older mentor, **Mr. Master**.
- The gift is perception: everyone can taste that a traditional ferment differs from a factory one, but the player is the only one who works out *why* (side notes, terroir, meaning).
- Backstory: the player learned the trade on a traditional intensive estate, where everything is measured by profit and speed.
- The antagonist is not a person. It is **the system**: uniform batches, erased seasons, fields turned into suppliers. Its faces in the game are the cheap-and-fast buyers (SuperSave, the school district, industry).
- The player's name is chosen on the title screen before the game starts, and is saved with the run (`playerName`).

## Chapters
0. **The Letter** (built): name entry, the letter in three pages, then the terms page (till, weekly bill, bench, the rest of the house).
1. **The Bench** (built): a chapter card, then the six koji steps (grow, fill, steer, chamber, watch, keep), each with a margin note from Mr. Master. A "first bill" card appears when the first week's rent falls due.
2. **The Primer** (built): Mr. Master hands over the Primer as soon as the first koji is kept (built; today it is the existing Bench Primer: koji, shio koji, amazake). The guide then continues with use, sell, report and strain. The Primer is now a nine-page book (one page per class: what it is, what it wants, the levers, one example, an instinct hint, a margin note), opened from the Codex or from the guide. Guide steps: read it, make one example by the book, make one thing it does not name by instinct, then find a buyer, read the post-mortem, breed a strain. A closing card, "Two ways of knowing", fires when both the book and instinct steps are done. One chapter per class of ferment, with the principle and one worked example. The player can follow the example or go by instinct. First buys from Nordic.
3. **The Counter**: suppliers and locked items, the town, buyers, renown.
4. **The Crew**: staff.
5. **The Estate**.
6. **The Wild**.

## The Primer
An upgrade of the existing `primer_bench` book: free, gifted, with the mentor's margin notes. Recipe knowledge already has three states (unknown, known, analysed), and a book makes its recipes known.

Hands-on examples (all buyable at the start with kit the player owns): Barley Koji, Shiro Miso, Tepache or Pine Cheong, Kombucha. Lacto: Sauerkraut (needs an onggi, $200; tomatoes are out of season in March). Shoyu, Garum, Vinegar and Blackening are explained but made later (tamari is difficulty 4, surstromming 5, cider vinegar needs a $500 barrel, black garlic a $1,500 Thermal Chamber).

## How it is built (in index.html)
- Story beats live in `STORY_BEATS` (id, condition, card text, optional side effect). Each beat fires once per run and is recorded in `story.seen` in the save. Saves from before the story existed carry a `legacy` mark and never see the cards.
- The clock is held while any menu, book, message or story card is open (a ref refreshed every render; the estate and wild views already held it). The batch inspector is deliberately not a menu, so a running batch can be watched live. Orders does not close on Escape (as before).
- The old first-run guide (`STEPS`) is now split by chapter (`ch`), with a chapter title in its header and a margin note per step.
- Moved for now, not removed: the "Breed your own strain" step sits at the end of chapter 2 and is a candidate to move to a later chapter.

## Numbers measured in the game
- Rent $120 plus about $4 upkeep: **$124 a week**. Start money $1,800 (about 14 weeks). Three weeks in the red ends the run.
- The clock is paused while the title screen is up, so the letter costs nothing. In a 20 s test at 8x with an empty bench, three weeks passed and $372 was gone, so later story cards should hold the clock.

## Not built yet
- Chapter 3 (The Counter), chapter 4 (The Crew), chapter 5 (The Estate), chapter 6 (The Wild).
- The guide still ends with the old "find a buyer", "post-mortem" and "strain" steps; they need reworking around the story.

## Open
- Perception layers on the tasting card (side note, terroir, meaning): explained in chat, waiting for a decision.
- Whether the player is addressed by name or as "partner" after the letter.
