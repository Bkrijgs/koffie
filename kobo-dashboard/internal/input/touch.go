// Package input reads taps from the Kobo touch panel via raw evdev, in pure Go
// (no CGO). It handles both single-touch (ABS_X/ABS_Y + BTN_TOUCH) and
// multitouch type-B (ABS_MT_POSITION_* + ABS_MT_TRACKING_ID) panels, and maps
// raw panel coordinates onto the 1080x1440 framebuffer using the device profile.
package input

import (
	"encoding/binary"
	"os"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/config"
)

// evdev type/code constants we care about.
const (
	evSyn = 0x00
	evKey = 0x01
	evAbs = 0x03

	synReport = 0x00

	btnTouch = 0x14a

	absX             = 0x00
	absY             = 0x01
	absMTPositionX   = 0x35
	absMTPositionY   = 0x36
	absMTTrackingID  = 0x39
	absMTSlot        = 0x2f
	mtTrackingIDNone = -1

	// struct input_event on a 32-bit (armhf) kernel: timeval(2x int32) + type
	// (u16) + code (u16) + value (int32) = 16 bytes.
	eventSize = 16
)

// Tap is a touch release. X,Y are mapped to framebuffer pixels; RawX,RawY are
// the unmapped panel coordinates (used for calibration).
type Tap struct {
	X, Y       int
	RawX, RawY int
}

// Reader streams taps from a touch device.
type Reader struct {
	f    *os.File
	dev  config.Device
	taps chan Tap
}

// Open opens the configured touch node and starts decoding taps.
func Open(dev config.Device) (*Reader, error) {
	f, err := os.Open(dev.TouchDev)
	if err != nil {
		return nil, err
	}
	r := &Reader{f: f, dev: dev, taps: make(chan Tap, 4)}
	go r.loop()
	return r, nil
}

// Taps returns the channel of decoded taps.
func (r *Reader) Taps() <-chan Tap { return r.taps }

// Close stops the reader.
func (r *Reader) Close() error {
	err := r.f.Close()
	return err
}

func (r *Reader) loop() {
	defer close(r.taps)
	buf := make([]byte, eventSize)

	var rawX, rawY int
	haveX, haveY := false, false
	down := false
	pending := false // a press happened this gesture

	for {
		if _, err := readFull(r.f, buf); err != nil {
			return
		}
		typ := binary.LittleEndian.Uint16(buf[8:10])
		code := binary.LittleEndian.Uint16(buf[10:12])
		val := int32(binary.LittleEndian.Uint32(buf[12:16]))

		switch typ {
		case evAbs:
			switch code {
			case absX, absMTPositionX:
				rawX, haveX = int(val), true
				down, pending = true, true
			case absY, absMTPositionY:
				rawY, haveY = int(val), true
				down, pending = true, true
			case absMTTrackingID:
				if val == mtTrackingIDNone {
					down = false
				} else {
					down, pending = true, true
				}
			}
		case evKey:
			if code == btnTouch {
				if val == 1 {
					down, pending = true, true
				} else {
					down = false
				}
			}
		case evSyn:
			if code == synReport && !down && pending && haveX && haveY {
				x, y := r.mapCoords(rawX, rawY)
				select {
				case r.taps <- Tap{X: x, Y: y, RawX: rawX, RawY: rawY}:
				default:
				}
				pending = false
			}
		}
	}
}

// mapCoords transforms raw panel coordinates to framebuffer pixels using the
// device profile (max ranges, axis swap, axis inversion).
func (r *Reader) mapCoords(rx, ry int) (int, int) {
	maxX, maxY := r.dev.TouchMaxX, r.dev.TouchMaxY
	if maxX <= 0 {
		maxX = config.ScreenWidth
	}
	if maxY <= 0 {
		maxY = config.ScreenHeight
	}
	nx := clamp01(float64(rx) / float64(maxX))
	ny := clamp01(float64(ry) / float64(maxY))

	if r.dev.TouchSwapXY {
		nx, ny = ny, nx
	}
	if r.dev.TouchInvertX {
		nx = 1 - nx
	}
	if r.dev.TouchInvertY {
		ny = 1 - ny
	}
	return int(nx * float64(config.ScreenWidth)), int(ny * float64(config.ScreenHeight))
}

func clamp01(f float64) float64 {
	if f < 0 {
		return 0
	}
	if f > 1 {
		return 1
	}
	return f
}

func readFull(f *os.File, buf []byte) (int, error) {
	got := 0
	for got < len(buf) {
		n, err := f.Read(buf[got:])
		if n > 0 {
			got += n
		}
		if err != nil {
			return got, err
		}
	}
	return got, nil
}
