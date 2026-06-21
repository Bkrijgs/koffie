// Package render turns dashboard data into a 1080x1440 grayscale PNG that is
// handed to fbink for display on the e-ink panel. Keeping all drawing in pure
// Go (no CGO) means the binary cross-compiles to armhf with a plain
// GOARCH=arm GOARM=7 build, and the exact same PNG can be rendered and eyeballed
// on a dev machine.
package render

import (
	"image"
	"image/color"
	"image/draw"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

// E-ink greys. 0 = black, 255 = white. We render to RGBA (fbink handles the
// grayscale conversion) but only ever use neutral greys.
var (
	Black   = color.RGBA{0x00, 0x00, 0x00, 0xff}
	Ink     = color.RGBA{0x1a, 0x1a, 0x1a, 0xff} // primary text
	Ink600  = color.RGBA{0x44, 0x44, 0x44, 0xff}
	Ink400  = color.RGBA{0x77, 0x77, 0x77, 0xff} // secondary text
	Ink300  = color.RGBA{0x99, 0x99, 0x99, 0xff} // labels
	Line    = color.RGBA{0xcc, 0xcc, 0xcc, 0xff} // hairlines / empty cells
	Line200 = color.RGBA{0xe2, 0xe2, 0xe2, 0xff}
	Paper   = color.RGBA{0xff, 0xff, 0xff, 0xff}
)

// Canvas is a drawable RGBA image with a handful of preloaded font faces.
type Canvas struct {
	Img   *image.RGBA
	W, H  int
	reg   *opentype.Font
	bold  *opentype.Font
	faces map[faceKey]font.Face
}

type faceKey struct {
	bold bool
	size int // whole-point size; we never need fractional sizes
}

// NewCanvas allocates a white w×h canvas with the Go fonts loaded.
func NewCanvas(w, h int) (*Canvas, error) {
	reg, err := opentype.Parse(goregular.TTF)
	if err != nil {
		return nil, err
	}
	bold, err := opentype.Parse(gobold.TTF)
	if err != nil {
		return nil, err
	}
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(img, img.Bounds(), &image.Uniform{Paper}, image.Point{}, draw.Src)
	return &Canvas{
		Img:   img,
		W:     w,
		H:     h,
		reg:   reg,
		bold:  bold,
		faces: map[faceKey]font.Face{},
	}, nil
}

func (c *Canvas) face(size int, bold bool) font.Face {
	k := faceKey{bold: bold, size: size}
	if f, ok := c.faces[k]; ok {
		return f
	}
	src := c.reg
	if bold {
		src = c.bold
	}
	f, err := opentype.NewFace(src, &opentype.FaceOptions{
		Size:    float64(size),
		DPI:     72, // 1pt == 1px keeps layout arithmetic in pixels
		Hinting: font.HintingFull,
	})
	if err != nil {
		// A failed face means a programming error (bad size); fall back so we
		// never panic mid-render on the device.
		f = c.faces[faceKey{bold: bold, size: 24}]
		if f == nil {
			return basicFallback
		}
	}
	c.faces[k] = f
	return f
}

// Fill paints a solid rectangle.
func (c *Canvas) Fill(x, y, w, h int, col color.Color) {
	r := image.Rect(x, y, x+w, y+h).Intersect(c.Img.Bounds())
	draw.Draw(c.Img, r, &image.Uniform{col}, image.Point{}, draw.Src)
}

// Rect strokes a 1px (or thickness px) rectangle outline.
func (c *Canvas) Rect(x, y, w, h, thick int, col color.Color) {
	c.Fill(x, y, w, thick, col)
	c.Fill(x, y+h-thick, w, thick, col)
	c.Fill(x, y, thick, h, col)
	c.Fill(x+w-thick, y, thick, h, col)
}

// HLine draws a horizontal hairline.
func (c *Canvas) HLine(x, y, w, thick int, col color.Color) {
	c.Fill(x, y, w, thick, col)
}

// Text draws a left-aligned string at baseline (x, y) and returns the advance
// width in pixels.
func (c *Canvas) Text(x, y int, s string, size int, bold bool, col color.Color) int {
	face := c.face(size, bold)
	d := &font.Drawer{
		Dst:  c.Img,
		Src:  &image.Uniform{col},
		Face: face,
		Dot:  fixed.P(x, y),
	}
	start := d.Dot.X
	d.DrawString(s)
	return (d.Dot.X - start).Round()
}

// TextWidth measures a string without drawing it.
func (c *Canvas) TextWidth(s string, size int, bold bool) int {
	face := c.face(size, bold)
	d := &font.Drawer{Face: face}
	return d.MeasureString(s).Round()
}

// TextRight draws a string whose right edge sits at x.
func (c *Canvas) TextRight(x, y int, s string, size int, bold bool, col color.Color) {
	w := c.TextWidth(s, size, bold)
	c.Text(x-w, y, s, size, bold, col)
}

// TextCenter draws a string centered on cx.
func (c *Canvas) TextCenter(cx, y int, s string, size int, bold bool, col color.Color) {
	w := c.TextWidth(s, size, bold)
	c.Text(cx-w/2, y, s, size, bold, col)
}

// LineHeight reports a comfortable line height for a font size.
func (c *Canvas) LineHeight(size int) int {
	m := c.face(size, false).Metrics()
	return (m.Height).Round()
}

// TruncateToWidth clips s with an ellipsis so it fits maxW pixels.
func (c *Canvas) TruncateToWidth(s string, size int, bold bool, maxW int) string {
	if c.TextWidth(s, size, bold) <= maxW {
		return s
	}
	r := []rune(s)
	for len(r) > 1 {
		r = r[:len(r)-1]
		if c.TextWidth(string(r)+"…", size, bold) <= maxW {
			return string(r) + "…"
		}
	}
	return "…"
}

var basicFallback = opentypeMust()

func opentypeMust() font.Face {
	f, _ := opentype.Parse(goregular.TTF)
	face, _ := opentype.NewFace(f, &opentype.FaceOptions{Size: 24, DPI: 72})
	return face
}
