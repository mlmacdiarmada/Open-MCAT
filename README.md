# Open-MCAT

**Free MCAT practice, one testable idea at a time.**

Open-MCAT is a free, open collection of MCAT practice quizzes organized by *testable idea* — the smallest self-contained concept the exam builds questions around. Each set targets a single idea (say, visual depth cues or social stratification) with application-style questions and detailed explanations for **every** answer choice, so a wrong answer teaches you the distinction you missed, not just the fact.

Everything is mapped to the official AAMC sections and content categories, so you can drill exactly the idea you're weak on. All questions are **original**, written to mirror MCAT reasoning — never reproduced from any commercial question bank — and the project is, and will stay, free.

🔗 **Live site:** https://mlmacdiarmada.github.io/open-mcat/

---

## Why "testable idea"?

Most study tools organize by broad topic ("Psych/Soc") or by isolated fact ("convergence is a binocular cue"). Neither is the right grain size for drilling: one is too vague to act on, the other too small to build a real question around.

A **testable idea** sits in between — a coherent cluster of facts a passage or question set naturally targets as a unit. It's the resolution at which a gap becomes an *action*:

| Level | Example |
|---|---|
| **Section** | Psychological, Social & Biological Foundations of Behavior |
| **Foundational Concept** | Concept 6 — Sensing the environment |
| **Content Category** | 6A — Sensory processing |
| **Testable idea** | Visual depth cues |
| **Individual fact** | Convergence is a binocular cue |

One testable idea = one quiz = one thing you can take from shaky to solid in a single sitting.

---

## How to use it

1. Open the site and browse the catalog, grouped by section and content category.
2. Pick a testable idea and take the quiz.
3. Read **every** explanation — including for the choices you didn't pick. The per-choice rationale is where the learning is.
4. Note what you missed, and come back to that idea after some spaced review.

Open-MCAT is a supplement, not a substitute. Pair it with the official **AAMC** materials and a full question bank (e.g., UWorld) for ground-truth difficulty and volume.

---

## How it's built

A single static `index.html` — no framework, no backend, no build step. The question bank lives in one JavaScript array (`BANK`) inside the file; the catalog, quiz player, and results screen are generated from that data. Hosting is free on GitHub Pages.

---

## Adding a quiz

Adding a quiz is **adding data** — you never touch the player or the layout. Append one object to the `BANK` array in `index.html`, commit, and GitHub Pages rebuilds the live site in a minute or two.

Each quiz object has this shape:

```js
{
  id: "ps-6a-visual-cues",          // unique slug: section-category-idea
  section: "Psychological, Social & Biological Foundations of Behavior",
  sectionCode: "P/S",               // C/P · B/B · P/S · CARS
  category: "Sensory processing",   // the AAMC content category name
  categoryCode: "6A",               // the AAMC content category code
  idea: "Visual depth cues",        // the testable idea (the quiz title)
  questions: [
    {
      tag: "Monocular vs. binocular · applied",   // short label shown above the stem
      stem: "A patient loses vision in one eye ...",  // the question (HTML allowed, e.g. <b>)
      choices: ["Option A", "Option B", "Option C", "Option D"],  // exactly 4
      answer: 1,                    // 0-indexed: 0=A, 1=B, 2=C, 3=D
      rationale: "Why the correct answer is correct ...",
      why: [                        // exactly 4 — one per choice, in A–D order
        "Why A is right/wrong ...",
        "Correct. ...",
        "Why C is wrong ...",
        "Why D is wrong ..."
      ],
      takeaway: "The one-line rule to bank from this question."
    }
    // ...more questions (5–6 per idea works well)
  ]
}
```

**Authoring guidelines**
- Keep each set to **one testable idea**, tight enough that a single focused review session could master it.
- Write **application** questions (scenarios, experiments, distinctions) — not bare recall.
- Give every distractor a *reason* it's wrong in the `why` array; that's the point of the whole project.
- **Write everything original.** See below.

---

## Originality — please read

Every question and explanation in this repository is **original work**, written to mirror the *style* and *reasoning* of the MCAT. Nothing here is copied, paraphrased, or adapted from any commercial prep company's question bank or explanations.

This matters both ethically and legally: original questions mapped to the publicly available AAMC content outline are freely shareable; reproductions of copyrighted commercial content are not. Any contribution must uphold this standard.

---

## License

This project uses a **dual license**, because it contains two different kinds of work:

- **Code** (the site: HTML, CSS, JavaScript) — licensed under the **MIT License**. See [`LICENSE`](LICENSE).
- **Content** (the quiz questions and explanations) — © Makenzi L. McDermott, licensed under **[Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)**. You may share and adapt the questions for non-commercial use with attribution; you may not sell them or repackage them into a paid product.

---

## Disclaimer

MCAT® is a program of, and AAMC® is a registered trademark of, the Association of American Medical Colleges. **Open-MCAT is an independent project and is not affiliated with, endorsed by, or sponsored by the AAMC.** All practice questions are original and are provided for study purposes only.

---

## Contributing

Contributions of new original quiz sets are welcome. Open a pull request that adds one or more objects to the `BANK` array, following the shape and authoring guidelines above. By contributing, you confirm your questions are your own original work and agree to license them under CC BY-NC 4.0.
