# Steer design system (extracted from the reference file; used in the frontend package)

Fonts: Fraunces (headings, italic emphasis, 400/600) + Inter (UI, 400/500/600)

Light: bg #F5EBDF | paper #F8F2EB | ink #351D1D | rust #C04E2A | maroon #661414 | clay #8f6656 | blush #E6CBBD
Dark:  bg #2a0f0f | paper #381616 | ink #F5EBDF | rust #E2764F | clay #CDA899 | blush #5a2a2a
Hero card: bg maroon, text #F5EBDF, em #F0A27F, sub #D9B9AA, buttons #7a1f1f / border #8c3030

Signature elements
- Headings: Fraunces, weight 400, tight leading (1.08), letter-spacing -.02em, key phrase in <em> (italic, rust)
- Buttons: radius 18px, 1.5px border, chunky 3D bottom shadow (0 4px 0), press = translateY(4px)
- Primary button: rust fill, maroon shadow. Ghost: transparent
- Hero card: maroon, radius 26px. Cards: paper, 1.5px blush border, radius 22px
- Chat: maroon header strip with green status dot; incoming bubble (bg, 4px/18px radius), outgoing bubble rust
- Verdict "stamp": paper card, 2.5px rust border (dashed = negative), slam-in animation
- Motion respects prefers-reduced-motion
