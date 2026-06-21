// Package fb writes images straight to the Linux framebuffer (/dev/fb0) on the
// Kobo, in pure Go. This sidesteps fbink's image support, which is compiled out
// of the minimal fbink builds shipped by KOReader/KFMon — every Kobo fbink can
// still *refresh* the e-ink, so the split is: Go draws into the framebuffer,
// fbink flips it onto the panel.
package fb

import (
	"fmt"
	"image"
	"os"
	"syscall"
	"unsafe"
)

const (
	fbioGetVScreenInfo = 0x4600
	fbioGetFScreenInfo = 0x4602
)

// FB is an mmap'd framebuffer.
type FB struct {
	f      *os.File
	mem    []byte
	XRes   int
	YRes   int
	BPP    int
	Stride int // bytes per row (line_length)
}

// Open maps the framebuffer device and reads its geometry.
func Open(path string) (*FB, error) {
	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return nil, err
	}

	var vbuf [160]byte
	if err := ioctl(f.Fd(), fbioGetVScreenInfo, unsafe.Pointer(&vbuf[0])); err != nil {
		f.Close()
		return nil, fmt.Errorf("VSCREENINFO: %w", err)
	}
	xres := int(le32(vbuf[0:]))
	yres := int(le32(vbuf[4:]))
	bpp := int(le32(vbuf[24:]))

	var fbuf [80]byte
	if err := ioctl(f.Fd(), fbioGetFScreenInfo, unsafe.Pointer(&fbuf[0])); err != nil {
		f.Close()
		return nil, fmt.Errorf("FSCREENINFO: %w", err)
	}
	smemLen := int(le32(fbuf[20:]))
	lineLen := int(le32(fbuf[44:]))

	if smemLen <= 0 || lineLen <= 0 || xres <= 0 || yres <= 0 {
		f.Close()
		return nil, fmt.Errorf("bad fb geometry: %dx%d bpp=%d stride=%d len=%d",
			xres, yres, bpp, lineLen, smemLen)
	}

	mem, err := syscall.Mmap(int(f.Fd()), 0, smemLen,
		syscall.PROT_READ|syscall.PROT_WRITE, syscall.MAP_SHARED)
	if err != nil {
		f.Close()
		return nil, fmt.Errorf("mmap: %w", err)
	}

	return &FB{f: f, mem: mem, XRes: xres, YRes: yres, BPP: bpp, Stride: lineLen}, nil
}

// Blit copies an RGBA image into the framebuffer. Supports 32bpp (BGRA byte
// order, as Kobo uses) and 16bpp (RGB565). The image is drawn upright at (0,0)
// and clipped to the panel.
func (fb *FB) Blit(img *image.RGBA) {
	w, h := fb.XRes, fb.YRes
	if img.Rect.Dx() < w {
		w = img.Rect.Dx()
	}
	if img.Rect.Dy() < h {
		h = img.Rect.Dy()
	}
	for y := 0; y < h; y++ {
		srcRow := img.PixOffset(0, y)
		dstRow := y * fb.Stride
		switch fb.BPP {
		case 32:
			for x := 0; x < w; x++ {
				s := srcRow + x*4
				d := dstRow + x*4
				r, g, b := img.Pix[s], img.Pix[s+1], img.Pix[s+2]
				fb.mem[d+0] = b
				fb.mem[d+1] = g
				fb.mem[d+2] = r
				fb.mem[d+3] = 0xff
			}
		case 16:
			for x := 0; x < w; x++ {
				s := srcRow + x*4
				d := dstRow + x*2
				r, g, b := img.Pix[s], img.Pix[s+1], img.Pix[s+2]
				v := uint16(r&0xf8)<<8 | uint16(g&0xfc)<<3 | uint16(b)>>3
				fb.mem[d+0] = byte(v)
				fb.mem[d+1] = byte(v >> 8)
			}
		}
	}
}

// Close unmaps and closes the framebuffer.
func (fb *FB) Close() error {
	if fb.mem != nil {
		_ = syscall.Munmap(fb.mem)
		fb.mem = nil
	}
	return fb.f.Close()
}

func ioctl(fd uintptr, req uintptr, arg unsafe.Pointer) error {
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, fd, req, uintptr(arg))
	if errno != 0 {
		return errno
	}
	return nil
}

func le32(b []byte) uint32 {
	return uint32(b[0]) | uint32(b[1])<<8 | uint32(b[2])<<16 | uint32(b[3])<<24
}
