package input

import (
	"testing"

	"github.com/bkrijgs/koffie/kobo-dashboard/internal/config"
)

func TestMapCoords(t *testing.T) {
	cases := []struct {
		name   string
		dev    config.Device
		rx, ry int
		wantX  int
		wantY  int
	}{
		{
			name: "identity center",
			dev:  config.Device{TouchMaxX: 1080, TouchMaxY: 1440},
			rx:   540, ry: 720,
			wantX: 540, wantY: 720,
		},
		{
			name: "invert Y bottom-left -> top-left",
			dev:  config.Device{TouchMaxX: 1080, TouchMaxY: 1440, TouchInvertY: true},
			rx:   0, ry: 1440,
			wantX: 0, wantY: 0,
		},
		{
			name: "swap axes",
			dev:  config.Device{TouchMaxX: 1440, TouchMaxY: 1080, TouchSwapXY: true},
			rx:   1440, ry: 0, // raw nx=1, ny=0 -> swap -> nx=0, ny=1
			wantX: 0, wantY: 1440,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := &Reader{dev: tc.dev}
			x, y := r.mapCoords(tc.rx, tc.ry)
			if x != tc.wantX || y != tc.wantY {
				t.Errorf("mapCoords(%d,%d) = (%d,%d), want (%d,%d)",
					tc.rx, tc.ry, x, y, tc.wantX, tc.wantY)
			}
		})
	}
	_ = config.ScreenWidth
}
