# Kobo Aura HD — herstel via Windows (WSL2)

Eén bestand terugzetten op de Linux-partitie van de SD, zodat de Kobo weer
normaal naar Nickel boot. ~10 minuten.

> Achtergrond: zie `POSTMORTEM.md`. Het inschakelen van de kiosk patchte
> `/etc/init.d/rcS`; deze gids draait die patch terug vanaf de back-up
> (`rcS.espresso-bak`) die de installer maakte. macOS kan niet naar ext4
> schrijven, een Windows-PC met WSL2 wel.

## Wat je nodig hebt
- De **microSD** uit de Kobo.
- Een **USB-(micro)SD-kaartlezer** (de laptop-sleuf werkt soms ook).
- Een **Windows 11**-laptop (of Windows 10 met bijgewerkte WSL).

> **Veiligheid:** herken de SD aan z'n grootte (~3,7–4 GB) — kies nooit de
> systeemschijf (256 GB+). Overschrijf pas als je `rcS` én `rcS.espresso-bak`
> met eigen ogen hebt zien staan (stap 5).

## Eenmalig: WSL2
In **PowerShell als administrator**:
```powershell
wsl --version          # niet geïnstalleerd? dan:
wsl --install          # en herstart de PC
```

## Stappen

**1. Vind de SD** (PowerShell als administrator):
```powershell
Get-CimInstance Win32_DiskDrive | Select-Object DeviceID, Model, @{N='GB';E={[math]::Round($_.Size/1GB,1)}}
```
Zoek de regel met GB ≈ 3,7–4. Noteer de `DeviceID`, bijv. `\\.\PHYSICALDRIVE2`
(gebruik dat nummer hieronder).

**2. Koppel de schijf aan WSL:**
```powershell
wsl --mount \\.\PHYSICALDRIVE2 --bare
```

**3. Open WSL:**
```powershell
wsl
```

**4. Herken de Kobo-partities** (aan het label `KOBOeReader`):
```bash
lsblk -f
```
De schijf met een `vfat`-partitie genaamd `KOBOeReader` is de Kobo. De `ext4`-
partitie op diezelfde schijf (bijv. `sdd2`) is de rootfs — die heb je nodig.

**5. Mount + controleer:**
```bash
sudo mkdir -p /mnt/kobo
sudo mount /dev/sdd2 /mnt/kobo
ls -l /mnt/kobo/etc/init.d/rcS /mnt/kobo/etc/init.d/rcS.espresso-bak
```
Je moet **beide** bestanden zien. Zo niet → `sudo umount /mnt/kobo` en probeer de
andere ext4-partitie.

**6. Zet het origineel terug:**
```bash
sudo cp /mnt/kobo/etc/init.d/rcS.espresso-bak /mnt/kobo/etc/init.d/rcS
sudo chmod 755 /mnt/kobo/etc/init.d/rcS
sudo sync
```
Bestaat `rcS.espresso-bak` niet? Verwijder dan alleen ons blok:
```bash
sudo sed -i '/# >>> espresso-kiosk >>>/,/# <<< espresso-kiosk <<</d' /mnt/kobo/etc/init.d/rcS
sudo sync
```

**7. Verifieer** (moet `0` teruggeven):
```bash
grep -c espresso-kiosk /mnt/kobo/etc/init.d/rcS
```

**8. Loskoppelen** — in WSL:
```bash
sudo umount /mnt/kobo
exit
```
en in PowerShell:
```powershell
wsl --unmount \\.\PHYSICALDRIVE2
```

**9.** Werp de SD veilig uit via Windows, terug in de Kobo, dichtmaken → boot
weer naar Nickel.

## Als het tóch niet boot
Dan zat het niet (alleen) in dit script. Maar deze stap zet de rootfs exact
terug zoals vóór alle wijzigingen, dus de kans is groot dat 'ie hierna weer
gewoon opstart.
