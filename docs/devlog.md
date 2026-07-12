# Devlog drafts

Draft notes for devlogs posted to itch.io / Discord / X (published in English).
Newest batch goes at the top. Edit/trim before actually posting — this file itself
is not published.

## v0.1.3

A batch of visual and feel fixes based on playtester feedback.

- **Fixed leader units showing the wrong team color**: on the board, leader units
  (commanders) had their cape/armor rendering in a reddish color regardless of
  which side they belonged to. The root cause was a caching bug that broke team-color
  recoloring for any unit served through the sprite pack. Both factions' leaders now
  show the correct team color (blue).
- **Tuned the "end turn?" confirmation**: it used to nag about units that had already
  moved but simply had no attack target nearby. Now a unit only counts as "hasn't
  acted" if it hasn't moved or attacked at all yet this turn. Recruiting also now
  counts as the leader having acted, so it won't get flagged just for recruiting.
- **Unified selection/icon colors to the team color**: the unit-selection ring, the
  faction-select hover border, and the unit icons on the faction-select and recruit
  screens were all showing the raw asset color (reddish) instead of your actual team
  color. Everything now matches your team color (blue).
- **Fixed the victory screen preempting the finishing-blow animation**: killing the
  enemy leader used to instantly show the victory screen before the kill animation
  could play. The victory screen now waits for the animation to finish.

<!-- append the next batch here -->
