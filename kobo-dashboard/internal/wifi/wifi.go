// Package wifi zet de Kobo-wifi aan/uit door de scripts te hergebruiken die
// KOReader al op het toestel heeft geplaatst. Alles is best-effort: als er al
// verbinding is, doen we niets; ontbreken de scripts, dan proberen we gewoon
// de fetch (misschien staat wifi al aan).
package wifi

import (
	"context"
	"log"
	"net"
	"os"
	"os/exec"
	"time"
)

// Kandidaat-scripts, in volgorde van voorkeur.
var enableScripts = []string{
	"/mnt/onboard/.adds/koreader/enable-wifi.sh",
	"/mnt/onboard/.adds/kfmon/bin/enable-wifi.sh",
	"/mnt/onboard/.niluje/usbnet/bin/enable-wifi.sh",
}

var disableScripts = []string{
	"/mnt/onboard/.adds/koreader/disable-wifi.sh",
	"/mnt/onboard/.adds/kfmon/bin/disable-wifi.sh",
}

func firstExisting(paths []string) string {
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// online test of host:443 bereikbaar is.
func online(host string) bool {
	c, err := net.DialTimeout("tcp", net.JoinHostPort(host, "443"), 4*time.Second)
	if err != nil {
		return false
	}
	_ = c.Close()
	return true
}

// EnsureOnline zorgt dat er verbinding is met `host`. Retourneert nil zodra
// bereikbaar, of de laatste fout bij timeout van ctx.
func EnsureOnline(ctx context.Context, host string) error {
	if online(host) {
		return nil
	}
	if script := firstExisting(enableScripts); script != "" {
		log.Printf("wifi: %s", script)
		cmd := exec.CommandContext(ctx, "/bin/sh", script)
		if out, err := cmd.CombinedOutput(); err != nil {
			log.Printf("wifi: enable-script gaf fout: %v (%s)", err, out)
		}
	} else {
		log.Printf("wifi: geen enable-script gevonden, ga uit van bestaande verbinding")
	}

	// Poll tot online of ctx verloopt.
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		if online(host) {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

// Disable zet wifi uit om batterij te sparen. Best-effort, nooit fataal.
func Disable() {
	if script := firstExisting(disableScripts); script != "" {
		log.Printf("wifi: %s", script)
		cmd := exec.Command("/bin/sh", script)
		if out, err := cmd.CombinedOutput(); err != nil {
			log.Printf("wifi: disable-script gaf fout: %v (%s)", err, out)
		}
	}
}
