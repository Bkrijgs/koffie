package render

import (
	"image/color"
	"math"
)

// StarRating draws a 5-star rating with half-star precision, centered
// vertically on cy, starting at x. Returns the total width drawn.
//
// The Go fonts don't carry a ★ glyph, so stars are rasterized as filled
// polygons. Half stars are handled by filling each scanline only up to a
// horizontal cut, which gives a clean left-half fill.
func (c *Canvas) StarRating(x, cy, r, gap int, rating float64) int {
	for i := 0; i < 5; i++ {
		cx := x + r + i*(2*r+gap)
		// Fraction of this star that is filled: 1, 0.5 or 0.
		frac := rating - float64(i)
		if frac > 1 {
			frac = 1
		}
		if frac < 0 {
			frac = 0
		}
		c.fillStar(cx, cy, r, frac, Ink, Line)
	}
	return 5*(2*r) + 4*gap
}

// fillStar rasterizes a 5-pointed star centered at (cx, cy) with outer radius r.
// Pixels left of the fill cut use `on`, the rest `off`.
func (c *Canvas) fillStar(cx, cy, r int, fillFrac float64, on, off color.Color) {
	const inner = 0.42 // inner/outer radius ratio for a classic star
	pts := make([][2]float64, 0, 10)
	for i := 0; i < 10; i++ {
		ang := -math.Pi/2 + float64(i)*math.Pi/5
		rad := float64(r)
		if i%2 == 1 {
			rad = float64(r) * inner
		}
		pts = append(pts, [2]float64{
			float64(cx) + rad*math.Cos(ang),
			float64(cy) + rad*math.Sin(ang),
		})
	}

	cut := float64(cx-r) + fillFrac*float64(2*r)
	minY, maxY := cy-r, cy+r
	for y := minY; y <= maxY; y++ {
		xs := polygonScanline(pts, float64(y)+0.5)
		for k := 0; k+1 < len(xs); k += 2 {
			x0 := int(math.Ceil(xs[k] - 0.5))
			x1 := int(math.Floor(xs[k+1] - 0.5))
			for x := x0; x <= x1; x++ {
				col := off
				if float64(x) < cut {
					col = on
				}
				c.set(x, y, col)
			}
		}
	}
}

// polygonScanline returns the sorted x crossings of a closed polygon at height y.
func polygonScanline(pts [][2]float64, y float64) []float64 {
	var xs []float64
	n := len(pts)
	for i := 0; i < n; i++ {
		a := pts[i]
		b := pts[(i+1)%n]
		ay, by := a[1], b[1]
		if ay == by {
			continue
		}
		if (y >= ay && y < by) || (y >= by && y < ay) {
			t := (y - ay) / (by - ay)
			xs = append(xs, a[0]+t*(b[0]-a[0]))
		}
	}
	// insertion sort — at most 4 crossings for a star
	for i := 1; i < len(xs); i++ {
		for j := i; j > 0 && xs[j-1] > xs[j]; j-- {
			xs[j-1], xs[j] = xs[j], xs[j-1]
		}
	}
	return xs
}

func (c *Canvas) set(x, y int, col color.Color) {
	if x < 0 || y < 0 || x >= c.W || y >= c.H {
		return
	}
	c.Img.Set(x, y, col)
}
