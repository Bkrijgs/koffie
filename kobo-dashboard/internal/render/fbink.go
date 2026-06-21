package render

import (
	"image"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
)

// SavePNG encodes a canvas to a PNG file (used both for fbink display and for
// off-device previewing).
func SavePNG(c *Canvas, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if err := png.Encode(f, c.Img); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	// Atomic swap so fbink never reads a half-written file.
	return os.Rename(tmp, path)
}

// FBInk wraps the prebuilt fbink binary. All drawing is done by rendering a full
// PNG and asking fbink to blit it to the framebuffer — the single most stable
// fbink feature across firmware versions.
type FBInk struct {
	Bin string
}

// NewFBInk returns a wrapper around the fbink binary at bin.
func NewFBInk(bin string) *FBInk { return &FBInk{Bin: bin} }

// Available reports whether the fbink binary exists and is executable.
func (f *FBInk) Available() bool {
	info, err := os.Stat(f.Bin)
	return err == nil && !info.IsDir() && info.Mode()&0o111 != 0
}

// DisplayImage blits a PNG centered on the framebuffer with a full (flashing)
// refresh — the right mode for a full-screen redraw on e-ink.
func (f *FBInk) DisplayImage(pngPath string) error {
	// -g file=PATH : display image
	// -f           : full (flashing) refresh, avoids ghosting on full redraws
	// -c           : clear the screen first
	cmd := exec.Command(f.Bin, "-c", "-f", "-g", "file="+pngPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Print writes a single line of text via fbink's own font renderer. Used by the
// MVP/self-test path and for fatal-error fallbacks when PNG rendering itself
// fails. row is a cell row; negative rows count up from the bottom.
func (f *FBInk) Print(row int, msg string) error {
	cmd := exec.Command(f.Bin, "-y", itoa(row), "-S", "3", "-m", msg)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Clear blanks the screen with a flashing refresh.
func (f *FBInk) Clear() error {
	cmd := exec.Command(f.Bin, "-c", "-f")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [12]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// blankImage is a helper for tests/preview to ensure a canvas is non-nil.
var _ = image.NewRGBA
