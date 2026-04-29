# Barista video clips

Drop short looping clips here named exactly `<mood>.mp4`:

| File           | Mood       | Wanneer komt deze terug                                              |
| -------------- | ---------- | -------------------------------------------------------------------- |
| `wave.mp4`     | wave       | Onboarding, lege state — geen bonen of shots, eerste shot logged    |
| `happy.mp4`    | happy      | `praise`-tips: 3× ≥4★ op rij, sweet-spot shot, trending up          |
| `content.mp4`  | content    | Standaard rustige state, alleen `info`-tips                          |
| `think.mp4`    | think      | `tweak`-tips: "iets fijner malen", "ratio te kort", "grover"         |
| `concerned.mp4`| concerned  | `warn`-tips: trending down, slechte shot vs gemiddelde, boon te oud  |

Tips voor de clips:
- **Kort en loopbaar** (1–4 sec). Ze worden via `<video autoplay loop muted playsInline>` gerenderd.
- **Vierkant of portret** dat past op ~56–80 px breed (de SVG-fallback is portret).
- **Geen audio** nodig (de video staat altijd op muted).
- **MP4 met H.264** is de veiligste keuze qua compatibility (Safari + Chrome + Firefox).

Ontbreekt een file? De UI valt automatisch terug op `public/Barista.svg`
met de bestaande bob-animatie. Niets gaat stuk.
