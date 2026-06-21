package render

import "time"

// HelloSplash is the Phase-1 proof-of-pipeline screen: if this shows up on the
// panel after a KFMon launch, then build → deploy → launch → display all work.
func HelloSplash(c *Canvas) {
	cx := c.W / 2

	// A simple cup glyph drawn from rectangles so we don't depend on any image
	// asset for the MVP.
	drawCup(c, cx, 420)

	c.TextCenter(cx, 760, "Hello espresso", 64, true, Ink)
	c.TextCenter(cx, 830, "Kobo dashboard — MVP pijplijn", 30, false, Ink400)

	stamp := time.Now().Format("Mon 2 Jan 15:04")
	c.TextCenter(cx, c.H-120, stamp, 26, false, Ink300)
	c.TextCenter(cx, c.H-80, "fbink + KFMon", 24, false, Ink300)
}

// LoadingScreen is shown while the first fetch is in flight, so the panel isn't
// blank during the (potentially slow) e-ink wifi round-trip.
func LoadingScreen(c *Canvas) {
	c.Fill(0, 0, c.W, c.H, Paper)
	cx := c.W / 2
	drawCup(c, cx, 560)
	c.TextCenter(cx, 900, "Espresso", 56, true, Ink)
	c.TextCenter(cx, 956, "Shots laden…", 30, false, Ink400)
}

// ErrorScreen shows a readable failure message (e.g. wifi down + no cache) so
// the panel never goes silently blank.
func ErrorScreen(c *Canvas, msg string) {
	c.Fill(0, 0, c.W, c.H, Paper)
	cx := c.W / 2
	drawCup(c, cx, 360)
	c.TextCenter(cx, 700, "Geen dashboard", 48, true, Ink)
	c.TextCenter(cx, 756, "Kon de gegevens niet laden", 28, false, Ink400)

	maxW := c.W - 2*margin
	y := 840
	for _, line := range c.WrapText(msg, 24, false, maxW) {
		c.TextCenter(cx, y, c.TruncateToWidth(line, 24, false, maxW), 24, false, Ink300)
		y += 34
		if y > 1100 {
			break
		}
	}
	c.TextCenter(cx, c.H-90, "Tik om opnieuw te proberen · controleer wifi", 24, false, Ink400)
}

// drawCup sketches an espresso cup centered at (cx, top) using filled rects.
func drawCup(c *Canvas, cx, top int) {
	bodyW, bodyH := 220, 170
	x := cx - bodyW/2
	// Cup body.
	c.Fill(x, top, bodyW, bodyH, Ink)
	c.Fill(x+10, top+10, bodyW-20, bodyH-20, Paper)
	// Coffee surface.
	c.Fill(x+24, top+24, bodyW-48, 26, Ink600)
	// Handle.
	c.Rect(x+bodyW-6, top+34, 70, 80, 14, Ink)
	// Saucer.
	c.Fill(cx-150, top+bodyH+18, 300, 16, Ink)
	// Steam.
	for i, sx := range []int{cx - 40, cx, cx + 40} {
		c.Fill(sx-4, top-70+(i%2)*10, 8, 50, Line)
	}
}
