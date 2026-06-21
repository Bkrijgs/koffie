package render

// Icon tile dimensions. KFMon watches a PNG that Nickel indexes as a book
// cover; a portrait cover aspect makes it look at home in the library grid.
const (
	IconW = 480
	IconH = 600
)

// IconTile renders the KFMon launcher cover: an espresso cup over a label.
func IconTile(c *Canvas) {
	c.Fill(0, 0, c.W, c.H, Paper)
	c.Rect(0, 0, c.W, c.H, 4, Ink)

	cx := c.W / 2
	drawCup(c, cx, 150)

	c.TextCenter(cx, 430, "Espresso", 52, true, Ink)
	c.TextCenter(cx, 480, "Dashboard", 30, false, Ink400)
}
